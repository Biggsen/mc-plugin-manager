/**
 * Build plugin config: generate content for each plugin type and optionally run validation + write.
 * Used by the build-configs IPC handler to avoid repeated per-plugin blocks.
 */
const fs = require('fs')
const path = require('path')
const yaml = require('yaml')
const {
  resolveConfigPath,
  getPluginOutputPaths,
  getCEEventFragmentPropagatedRelativePath,
  getCEEventFragmentFlatName,
} = require('../utils/configPathResolver')
const { ensureBuildDirectory } = require('../storage')
const { generateAACommands, generateAACustom, mergeAAConfig } = require('../aaGenerator')
const {
  generateOwnedCEEvents,
  buildCEConfigBundle,
  getStartRegionAachId,
  CE_EVENT_FRAGMENT_BASENAMES,
} = require('../ceGenerator')
const { generateOwnedTABSections, mergeTABConfig } = require('../tabGenerator')
const { generateOwnedLMRules, mergeLMConfig } = require('../lmGenerator')
const { resolveDropTablesForServer, allLibraryTableNames } = require('../dropTableResolve')
const { loadBundledItemIndex } = require('../itemIndex')
const {
  generateOwnedLMCustomDropTables,
  mergeLMCustomDropsConfig,
} = require('../lmCustomDropsGenerator')
const { generateMCConfig } = require('../mcGenerator')
const { generateCWConfig } = require('../cwGenerator')
const {
  validateAADiff,
  validateCEDiff,
  validateTABDiff,
  validateLMDiff,
  validateLMCustomDropsDiff,
} = require('../diffValidator')
const { prependGeneratorVersionHeader } = require('../utils/generatorVersionHeader')

import type { PluginType, ServerProfile, BuildTarget } from '../types'
import { resolveConfigServerName } from '../shared/resolveConfigServerName'

export interface BuildInputs {
  generateAA?: boolean
  generateCE?: boolean
  generateTAB?: boolean
  generateLM?: boolean
  generateLMCustomDrops?: boolean
  generateMC?: boolean
  generateCW?: boolean
  aaPath?: string
  cePath?: string
  tabPath?: string
  lmPath?: string
  lmCustomDropsPath?: string
  mcPath?: string
  mcTebexSubdomain?: string
  cwPath?: string
  buildTarget?: BuildTarget
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
  /** Passed through to generator header `build-note=` when non-empty after sanitize. */
  buildNote?: string
  /** When true, header includes `emit=test`. */
  testEmit?: boolean
}

function isDefaultPath(userPath: string | undefined): boolean {
  return !userPath || userPath.trim().length === 0
}

function resolveDiscordInviteUrl(profile: ServerProfile): string {
  const target: BuildTarget = profile.build?.buildTarget === 'live' ? 'live' : 'next'
  return String(
    profile.discordSrvByTarget?.[target]?.discordInviteUrl ??
      profile.discordSrv?.discordInviteUrl ??
      ''
  ).trim()
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
 * CE also returns `ceEventFragments` for `ConditionalEvents/events/*.yml`.
 */
export function buildPluginContent(
  type: PluginType,
  profile: ServerProfile,
  inputs: BuildInputs
): {
  content: string
  configPath: string
  isDefault: boolean
  ceEventFragments?: Record<string, string>
  warnings?: string[]
  ownedDropTables?: string[]
} {
  const pathInput = type === 'aa' ? inputs.aaPath
    : type === 'ce' ? inputs.cePath
    : type === 'tab' ? inputs.tabPath
    : type === 'lm' ? inputs.lmPath
    : type === 'lmcd' ? inputs.lmCustomDropsPath
    : type === 'mc' ? inputs.mcPath
    : inputs.cwPath
  const configPath = resolveConfigPath(type, pathInput)
  const isDefault = isDefaultPath(pathInput)
  const configServerName = resolveConfigServerName(profile)

  switch (type) {
    case 'aa': {
      const newCommands = generateAACommands(profile.regions)
      const templateContent = fs.readFileSync(configPath, 'utf-8')
      const templateConfig = yaml.parse(templateContent)
      const newCustom = generateAACustom(
        profile.regions,
        templateConfig,
        profile.regionsMeta?.structureFamilies,
        configServerName
      )
      const content = mergeAAConfig(configPath, newCommands, newCustom)
      return { content, configPath, isDefault }
    }
    case 'ce': {
      const ownedEvents = generateOwnedCEEvents(
        profile.regions,
        profile.onboarding,
        profile.regionsMeta?.levelledMobs?.regionBands,
        profile.regionsMeta?.structureFamilies
      )
      const bundle = buildCEConfigBundle(configPath, ownedEvents, profile.regions || [])
      let content = bundle.mainYaml
      const ceEventFragments: Record<string, string> = {}
      const startAach = getStartRegionAachId(profile.onboarding, profile.regions)
      for (const basename of CE_EVENT_FRAGMENT_BASENAMES) {
        let body = bundle.eventFragmentYamls[basename]
        body = body.replace(/\{SERVER_NAME\}/g, configServerName)
        body = body.replace(/\{START_REGION_AACH\}/g, startAach)
        ceEventFragments[basename] = body
      }
      content = content.replace(/\{SERVER_NAME\}/g, configServerName)
      content = content.replace(/\{START_REGION_AACH\}/g, startAach)
      return { content, configPath, isDefault, ceEventFragments }
    }
    case 'tab': {
      const discordInvite = resolveDiscordInviteUrl(profile)
      const ownedTABSections = generateOwnedTABSections(
        profile.regions,
        configServerName,
        profile.regionsMeta?.levelledMobs?.regionBands,
        discordInvite,
        profile.regionsMeta?.structureFamilies
      )
      const content = mergeTABConfig(configPath, ownedTABSections)
      return { content, configPath, isDefault }
    }
    case 'lm': {
      const ownedLMRules = generateOwnedLMRules(profile.regions, profile.regionsMeta?.levelledMobs)
      const content = mergeLMConfig(configPath, ownedLMRules)
      return {
        content,
        configPath,
        isDefault,
      }
    }
    case 'mc': {
      const hasLore = serverProfileHasLore(profile)
      const content = generateMCConfig(
        configPath,
        configServerName,
        String(inputs.mcTebexSubdomain ?? profile.build?.mcTebexSubdomain ?? ''),
        profile.regions || [],
        hasLore
      )
      return { content, configPath, isDefault }
    }
    case 'lmcd': {
      const { warnings: indexWarnings } = loadBundledItemIndex()
      const { resolved, warnings: resolveWarnings } = resolveDropTablesForServer(profile)
      const generated = generateOwnedLMCustomDropTables(resolved)
      const ownedDropTables = allLibraryTableNames()
      const content = mergeLMCustomDropsConfig(configPath, generated, ownedDropTables)
      return {
        content,
        configPath,
        isDefault,
        warnings: [...indexWarnings, ...resolveWarnings, ...generated.warnings],
        ownedDropTables,
      }
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
  content: string,
  ownedDropTables?: string[]
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
    case 'lmcd':
      return validateLMCustomDropsDiff(configPath, content, ownedDropTables ?? [])
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
): { success: true; configSource: ConfigSource; warnings: string[] } | { success: false; error: string } {
  try {
    const { content, configPath, isDefault, ceEventFragments, warnings, ownedDropTables } = buildPluginContent(
      type,
      profile,
      inputs
    )
    const validation = validatePluginDiff(type, configPath, content, ownedDropTables)
    if (!validation.valid) {
      return { success: false, error: validation.error || `${type.toUpperCase()} diff validation failed` }
    }
    const nextRaw = context.nextGeneratorVersion
    const nextVersion =
      typeof nextRaw === 'number' && Number.isInteger(nextRaw) && nextRaw >= 1 ? nextRaw : 1
    const headerArgs = {
      plugin: type,
      profileId: context.profileId ?? context.serverId,
      buildId: context.buildId,
      nextVersion,
      generatedAt: context.generatedAt ?? new Date().toISOString(),
      buildNote: context.buildNote,
      testEmit: context.testEmit,
    }
    const contentToWrite = prependGeneratorVersionHeader(content, headerArgs)
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

    if (type === 'ce' && ceEventFragments) {
      const sn = context.serverNameSanitized
      for (const basename of CE_EVENT_FRAGMENT_BASENAMES) {
        const fragBody = ceEventFragments[basename]
        const fragToWrite = prependGeneratorVersionHeader(fragBody, headerArgs)
        const fragBuildPath = path.join(buildDir, getCEEventFragmentFlatName(sn, basename))
        const fragOutputPath = context.propagate
          ? path.join(inputs.outDir, getCEEventFragmentPropagatedRelativePath(basename))
          : path.join(inputs.outDir, getCEEventFragmentFlatName(sn, basename))
        fs.mkdirSync(path.dirname(fragOutputPath), { recursive: true })
        fs.writeFileSync(fragOutputPath, fragToWrite, 'utf-8')
        fs.writeFileSync(fragBuildPath, fragToWrite, 'utf-8')
      }
    }

    return {
      success: true,
      configSource: { path: configPath, isDefault },
      warnings: warnings ?? [],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
