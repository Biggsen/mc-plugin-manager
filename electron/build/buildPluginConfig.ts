/**
 * Build plugin config: generate content for each plugin type and optionally run validation + write.
 * Used by the build-configs IPC handler to avoid repeated per-plugin blocks.
 */
const fs = require('fs')
const path = require('path')
const yaml = require('yaml')
const { resolveConfigPath, getPluginOutputPaths } = require('../utils/configPathResolver')
const { ensureBuildDirectory } = require('../storage')
const { generateAACommands, generateAACustom, mergeAAConfig } = require('../aaGenerator')
const { generateOwnedCEEvents, mergeCEConfig, getStartRegionAachId } = require('../ceGenerator')
const { generateOwnedTABSections, mergeTABConfig } = require('../tabGenerator')
const { generateOwnedLMRules, mergeLMConfig } = require('../lmGenerator')
const { generateMCConfig } = require('../mcGenerator')
const { generateCWConfig } = require('../cwGenerator')
const { validateAADiff, validateCEDiff, validateTABDiff, validateLMDiff } = require('../diffValidator')
const { prependGeneratorVersionHeader } = require('../utils/generatorVersionHeader')

import type { PluginType, ServerProfile } from '../types'

export interface BuildInputs {
  generateAA?: boolean
  generateCE?: boolean
  generateTAB?: boolean
  generateLM?: boolean
  generateMC?: boolean
  generateCW?: boolean
  aaPath?: string
  cePath?: string
  tabPath?: string
  lmPath?: string
  mcPath?: string
  cwPath?: string
  outDir: string
  propagateToPluginFolders?: boolean
}

export interface ConfigSource {
  path: string
  isDefault: boolean
}

export interface BuildPluginContext {
  serverId: string
  buildId: string
  serverNameSanitized: string
  propagate: boolean
  /** Defaults to `serverId` if omitted (e.g. stale dist-electron). */
  profileId?: string
  /** Defaults to `new Date().toISOString()` if omitted. */
  generatedAt?: string
  /** Defaults to `1` if omitted — run `npm run build:electron` so buildHandlers passes the real serial. */
  nextGeneratorVersion?: number
}

function isDefaultPath(userPath: string | undefined): boolean {
  return !userPath || userPath.trim().length === 0
}

function resolveDiscordInviteUrl(profile: ServerProfile): string {
  return String(profile.discordSrv?.discordInviteUrl ?? '').trim()
}

/** Region has lore book or description text. */
function serverProfileHasLore(profile: ServerProfile): boolean {
  return (profile.regions || []).some(
    (r: { loreBookDescription?: string; description?: string }) =>
      Boolean((r.loreBookDescription ?? r.description)?.trim())
  )
}

/**
 * Generate config content for a single plugin. Does not validate or write.
 */
export function buildPluginContent(
  type: PluginType,
  profile: ServerProfile,
  inputs: BuildInputs
): { content: string; configPath: string; isDefault: boolean } {
  const pathInput = type === 'aa' ? inputs.aaPath
    : type === 'ce' ? inputs.cePath
    : type === 'tab' ? inputs.tabPath
    : type === 'lm' ? inputs.lmPath
    : type === 'mc' ? inputs.mcPath
    : inputs.cwPath
  const configPath = resolveConfigPath(type, pathInput)
  const isDefault = isDefaultPath(pathInput)

  switch (type) {
    case 'aa': {
      const newCommands = generateAACommands(profile.regions)
      const templateContent = fs.readFileSync(configPath, 'utf-8')
      const templateConfig = yaml.parse(templateContent)
      const newCustom = generateAACustom(profile.regions, templateConfig)
      const content = mergeAAConfig(configPath, newCommands, newCustom)
      return { content, configPath, isDefault }
    }
    case 'ce': {
      const ownedEvents = generateOwnedCEEvents(
        profile.regions,
        profile.onboarding,
        profile.regionsMeta?.levelledMobs?.regionBands
      )
      let content = mergeCEConfig(configPath, ownedEvents)
      content = content.replace(/\{SERVER_NAME\}/g, profile.name)
      content = content.replace(/\{START_REGION_AACH\}/g, getStartRegionAachId(profile.onboarding, profile.regions))
      return { content, configPath, isDefault }
    }
    case 'tab': {
      const discordInvite = resolveDiscordInviteUrl(profile)
      const ownedTABSections = generateOwnedTABSections(
        profile.regions,
        profile.name,
        profile.regionsMeta?.levelledMobs?.regionBands,
        discordInvite
      )
      const content = mergeTABConfig(configPath, ownedTABSections)
      return { content, configPath, isDefault }
    }
    case 'lm': {
      const ownedLMRules = generateOwnedLMRules(profile.regions, profile.regionsMeta?.levelledMobs)
      const content = mergeLMConfig(configPath, ownedLMRules)
      return { content, configPath, isDefault }
    }
    case 'mc': {
      const hasLore = serverProfileHasLore(profile)
      const content = generateMCConfig(configPath, profile.name, profile.regions || [], hasLore)
      return { content, configPath, isDefault }
    }
    case 'cw': {
      const discordInvite = resolveDiscordInviteUrl(profile)
      const hasLore = serverProfileHasLore(profile)
      const content = generateCWConfig(configPath, discordInvite, hasLore)
      return { content, configPath, isDefault }
    }
    default: {
      const _: never = type
      throw new Error(`Unknown plugin type: ${type}`)
    }
  }
}

function validatePluginDiff(
  type: PluginType,
  configPath: string,
  content: string
): { valid: boolean; error?: string } {
  switch (type) {
    case 'aa':
      return validateAADiff(configPath, content)
    case 'ce':
      return validateCEDiff(configPath, content)
    case 'tab':
      return validateTABDiff(configPath, content)
    case 'lm':
      return validateLMDiff(configPath, content)
    case 'mc':
    case 'cw':
      return { valid: true }
    default: {
      const _: never = type
      return { valid: true }
    }
  }
}

/**
 * Generate content, validate diff, and write output for a single plugin.
 * Returns error message on failure; otherwise returns configSource.
 */
export function runPluginBuild(
  type: PluginType,
  profile: ServerProfile,
  inputs: BuildInputs,
  context: BuildPluginContext
): { success: true; configSource: ConfigSource } | { success: false; error: string } {
  try {
    const { content, configPath, isDefault } = buildPluginContent(type, profile, inputs)
    const validation = validatePluginDiff(type, configPath, content)
    if (!validation.valid) {
      return { success: false, error: validation.error || `${type.toUpperCase()} diff validation failed` }
    }
    const nextRaw = context.nextGeneratorVersion
    const nextVersion =
      typeof nextRaw === 'number' && Number.isInteger(nextRaw) && nextRaw >= 1 ? nextRaw : 1
    const contentToWrite = prependGeneratorVersionHeader(content, {
      plugin: type,
      profileId: context.profileId ?? context.serverId,
      buildId: context.buildId,
      nextVersion,
      generatedAt: context.generatedAt ?? new Date().toISOString(),
    })
    const buildDir = ensureBuildDirectory(context.serverId, context.buildId)
    const { outputPath, buildPath } = getPluginOutputPaths(
      type,
      inputs.outDir,
      buildDir,
      context.serverNameSanitized,
      context.propagate
    )
    if (context.propagate) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    }
    fs.writeFileSync(outputPath, contentToWrite, 'utf-8')
    fs.writeFileSync(buildPath, contentToWrite, 'utf-8')
    return {
      success: true,
      configSource: { path: configPath, isDefault },
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
