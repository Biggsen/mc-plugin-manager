const { ipcMain } = require('electron')
const path = require('path')
const { existsSync, writeFileSync } = require('fs')
const {
  loadServerProfile,
  saveServerProfile,
  ensureBuildDirectory,
  saveBuildReport,
  loadBuildReport,
  listBuildSummaries,
} = require('../../storage')
const { computeRegionCounts, computeRegionStats } = require('../../utils/regionStats')
const { sanitizeServerName } = require('../../shared/stringFormatters')
const { runPluginBuild } = require('../../build/buildPluginConfig')
const {
  readDiscordSrvTemplatePaths,
  generateDiscordSrvConfigContent,
  readDiscordSrvMessagesContent,
} = require('../../discordSrvGenerator')
const {
  prependGeneratorVersionHeader,
  stripGeneratorVersionCommentLines,
} = require('../../utils/generatorVersionHeader')
const {
  sanitizeWorldGuardWorldFolder,
  getWorldGuardRegionsPropagatedRelativePath,
} = require('../../utils/worldGuardRegionsPaths')

import type { BuildResult, BuildReport, DiscordSrvSettings, GeneratorVersionKey } from '../../types'
import { resolveConfigServerName } from '../../shared/resolveConfigServerName'
import { getGuideBooksSourceDir } from '../../utils/guideBooksDir'
import { getGriefPreventionBundledConfigPath } from '../../utils/griefPreventionBundledConfig'

export function registerBuildHandlers(): void {
  ipcMain.handle(
    'build-configs',
    async (
      _event: unknown,
      serverId: string,
      inputs: {
        generateAA?: boolean
        generateBookGUI?: boolean
        generateCE?: boolean
        generateTAB?: boolean
        generateLM?: boolean
        generateMC?: boolean
        generateCW?: boolean
        generateDiscordSRV?: boolean
        generateGriefPrevention?: boolean
        generateWorldGuardRegions?: boolean
        worldGuardRegionsPath?: string
        /** World folder under WorldGuard/worlds/ when propagating (default world). */
        worldGuardRegionsWorldFolder?: string
        generateWorldGuardRegionsNether?: boolean
        worldGuardRegionsNetherPath?: string
        worldGuardRegionsNetherWorldFolder?: string
        discordSrv?: DiscordSrvSettings
        aaPath?: string
        cePath?: string
        tabPath?: string
        lmPath?: string
        mcPath?: string
        cwPath?: string
        outDir: string
        propagateToPluginFolders?: boolean
        /** When true, emit as test: current generator version, no bump, optional note, `emit=test` in header. */
        testBuild?: boolean
        /** Required when testBuild is false; optional short note for test builds. */
        buildNote?: string
      }
    ): Promise<BuildResult> => {
      try {
        const profile = loadServerProfile(serverId)
        if (!profile) {
          return { success: false, error: `Server profile not found: ${serverId}` }
        }
        if (
          !inputs.generateAA &&
          !inputs.generateBookGUI &&
          !inputs.generateCE &&
          !inputs.generateTAB &&
          !inputs.generateLM &&
          !inputs.generateMC &&
          !inputs.generateCW &&
          !inputs.generateDiscordSRV &&
          !inputs.generateGriefPrevention &&
          !inputs.generateWorldGuardRegions &&
          !inputs.generateWorldGuardRegionsNether
        ) {
          return {
            success: false,
            error:
              'At least one plugin (AA, BookGUI, CE, TAB, LM, MC, CommandWhitelist, DiscordSRV, GriefPreventionData, WorldGuard overworld regions.yml, or WorldGuard nether regions.yml) must be selected',
          }
        }
        if (!inputs.outDir || inputs.outDir.trim().length === 0) {
          return { success: false, error: 'Output directory must be set' }
        }

        const testBuild = Boolean(inputs.testBuild)
        const buildNoteTrimmed = String(inputs.buildNote ?? '').trim()
        if (!testBuild && !buildNoteTrimmed) {
          return {
            success: false,
            error:
              'Build note is required. Enable “Test build” for iterative emits without bumping generator versions.',
          }
        }

        const fs = require('fs')
        if (!existsSync(inputs.outDir)) {
          fs.mkdirSync(inputs.outDir, { recursive: true })
        }

        const propagate = Boolean(inputs.propagateToPluginFolders)

        function versionForEmit(key: GeneratorVersionKey): number {
          const cur = profile.generatorVersions?.[key] ?? 0
          if (testBuild) return Math.max(1, cur)
          return cur + 1
        }

        function persistGeneratorVersion(key: GeneratorVersionKey, emittedVersion: number): void {
          if (testBuild) return
          profile.generatorVersions = { ...(profile.generatorVersions ?? {}), [key]: emittedVersion }
        }

        const headerStampNote = testBuild ? (buildNoteTrimmed || undefined) : buildNoteTrimmed

        const configServerName = resolveConfigServerName(profile)
        const serverNameSanitized = sanitizeServerName(configServerName)
        const buildId = `build-${Date.now()}`
        const timestamp = new Date().toISOString()
        const warnings: string[] = []
        const errors: string[] = []
        const regionCounts = computeRegionStats(profile.regions)

        let aaGenerated = false
        let bookGuiGenerated = false
        let ceGenerated = false
        let tabGenerated = false
        let lmGenerated = false
        let mcGenerated = false
        let cwGenerated = false
        let discordsrvGenerated = false
        let griefPreventionGenerated = false
        let worldGuardRegionsGenerated = false
        let worldGuardRegionsNetherGenerated = false
        const configSources: BuildResult['configSources'] = {}

        const regionCountsForTAB = computeRegionCounts(profile.regions)
        const buildContextBase = {
          serverId,
          buildId,
          serverNameSanitized,
          propagate,
          profileId: serverId,
          generatedAt: timestamp,
          buildNote: headerStampNote,
          testEmit: testBuild,
        }

        if (inputs.generateAA) {
          const nextGeneratorVersion = versionForEmit('aa')
          const result = runPluginBuild('aa', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          persistGeneratorVersion('aa', nextGeneratorVersion)
          aaGenerated = true
          configSources.aa = result.configSource
        }
        if (inputs.generateCE) {
          const nextGeneratorVersion = versionForEmit('ce')
          const result = runPluginBuild('ce', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          persistGeneratorVersion('ce', nextGeneratorVersion)
          ceGenerated = true
          configSources.ce = result.configSource
        }
        if (inputs.generateDiscordSRV) {
          const merged: Required<DiscordSrvSettings> = {
            botToken: (inputs.discordSrv?.botToken ?? profile.discordSrv?.botToken ?? '').trim(),
            globalChannelId: (
              inputs.discordSrv?.globalChannelId ?? profile.discordSrv?.globalChannelId ?? ''
            ).trim(),
            statusChannelId: (
              inputs.discordSrv?.statusChannelId ?? profile.discordSrv?.statusChannelId ?? ''
            ).trim(),
            consoleChannelId: (
              inputs.discordSrv?.consoleChannelId ?? profile.discordSrv?.consoleChannelId ?? ''
            ).trim(),
            discordInviteUrl: (
              inputs.discordSrv?.discordInviteUrl ?? profile.discordSrv?.discordInviteUrl ?? ''
            ).trim(),
          }
          const missing: string[] = []
          if (!merged.botToken) missing.push('bot token')
          if (!merged.globalChannelId) missing.push('global channel ID')
          if (!merged.statusChannelId) missing.push('status channel ID')
          if (!merged.discordInviteUrl) missing.push('Discord invite URL')
          if (missing.length > 0) {
            return {
              success: false,
              error: `DiscordSRV requires: ${missing.join(', ')}`,
              buildId,
            }
          }
          try {
            const { configPath: srvConfigTpl, messagesPath: srvMessagesTpl } =
              readDiscordSrvTemplatePaths()
            const nextGeneratorVersion = versionForEmit('discordsrv')
            const headerCtx = {
              ...buildContextBase,
              nextGeneratorVersion,
            }
            const configBody = generateDiscordSrvConfigContent(srvConfigTpl, merged)
            const configContent = prependGeneratorVersionHeader(configBody, {
              plugin: 'discordsrv',
              profileId: headerCtx.profileId ?? serverId,
              buildId: headerCtx.buildId,
              nextVersion: headerCtx.nextGeneratorVersion,
              generatedAt: headerCtx.generatedAt ?? timestamp,
              buildNote: headerStampNote,
              testEmit: testBuild,
            })
            const messagesBody = readDiscordSrvMessagesContent(srvMessagesTpl)
            const messagesContent = prependGeneratorVersionHeader(messagesBody, {
              plugin: 'discordsrv',
              profileId: headerCtx.profileId ?? serverId,
              buildId: headerCtx.buildId,
              nextVersion: headerCtx.nextGeneratorVersion,
              generatedAt: headerCtx.generatedAt ?? timestamp,
              buildNote: headerStampNote,
              testEmit: testBuild,
            })
            const configFlat = `${serverNameSanitized}-discordsrv-config.yml`
            const messagesFlat = `${serverNameSanitized}-discordsrv-messages.yml`
            const buildDir = ensureBuildDirectory(serverId, buildId)
            if (propagate) {
              const pluginRoot = path.join(inputs.outDir, 'DiscordSRV')
              fs.mkdirSync(pluginRoot, { recursive: true })
              fs.writeFileSync(path.join(pluginRoot, 'config.yml'), configContent, 'utf-8')
              fs.writeFileSync(path.join(pluginRoot, 'messages.yml'), messagesContent, 'utf-8')
            } else {
              fs.writeFileSync(path.join(inputs.outDir, configFlat), configContent, 'utf-8')
              fs.writeFileSync(path.join(inputs.outDir, messagesFlat), messagesContent, 'utf-8')
            }
            fs.writeFileSync(path.join(buildDir, configFlat), configContent, 'utf-8')
            fs.writeFileSync(path.join(buildDir, messagesFlat), messagesContent, 'utf-8')
            persistGeneratorVersion('discordsrv', nextGeneratorVersion)
            profile.discordSrv = { ...merged }
            discordsrvGenerated = true
            configSources.discordsrv = {
              path: 'Bundled DiscordSRV templates',
              isDefault: true,
            }
          } catch (error: unknown) {
            const err = error as Error
            return {
              success: false,
              error: err.message || 'DiscordSRV generation failed',
              buildId,
            }
          }
        }

        if (inputs.generateTAB) {
          const nextGeneratorVersion = versionForEmit('tab')
          const result = runPluginBuild('tab', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          persistGeneratorVersion('tab', nextGeneratorVersion)
          tabGenerated = true
          configSources.tab = result.configSource
        }
        if (inputs.generateLM) {
          const nextGeneratorVersion = versionForEmit('lm')
          const result = runPluginBuild('lm', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          persistGeneratorVersion('lm', nextGeneratorVersion)
          lmGenerated = true
          configSources.lm = result.configSource
        }
        if (inputs.generateMC) {
          const nextGeneratorVersion = versionForEmit('mc')
          const result = runPluginBuild('mc', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          persistGeneratorVersion('mc', nextGeneratorVersion)
          mcGenerated = true
          configSources.mc = result.configSource
        }
        if (inputs.generateCW) {
          const nextGeneratorVersion = versionForEmit('cw')
          const result = runPluginBuild('cw', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          persistGeneratorVersion('cw', nextGeneratorVersion)
          cwGenerated = true
          configSources.cw = result.configSource
        }

        if (inputs.generateBookGUI) {
          try {
            const nextGeneratorVersion = versionForEmit('bookgui')
            const bookGuiHeaderArgs = {
              plugin: 'bookgui' as const,
              profileId: serverId,
              buildId,
              nextVersion: nextGeneratorVersion,
              generatedAt: timestamp,
              buildNote: headerStampNote,
              testEmit: testBuild,
            }
            const hasLore = (profile.regions || []).some(
              (r: { loreBookDescription?: string; description?: string }) =>
                Boolean((r.loreBookDescription ?? r.description)?.trim())
            )
            const guideBooksDir = getGuideBooksSourceDir()
            const bookFiles = fs.readdirSync(guideBooksDir).filter((f: string) => f.endsWith('.yml'))
            const booksToWrite = hasLore
              ? bookFiles
              : bookFiles.filter((f: string) => f !== 'guide_lore.yml')
            const bookGuiOutputDir = path.join(inputs.outDir, 'BookGUI', 'books')
            fs.mkdirSync(bookGuiOutputDir, { recursive: true })
            const serverName = configServerName
            for (const filename of booksToWrite) {
              const content = fs.readFileSync(path.join(guideBooksDir, filename), 'utf-8')
              const substituted = content.replace(/\{SERVER_NAME\}/g, serverName)
              const toWrite = prependGeneratorVersionHeader(substituted, bookGuiHeaderArgs)
              writeFileSync(path.join(bookGuiOutputDir, filename), toWrite, 'utf-8')
            }
            persistGeneratorVersion('bookgui', nextGeneratorVersion)
            bookGuiGenerated = true
            configSources.bookgui = { path: 'Bundled guide books', isDefault: true }
          } catch (error: unknown) {
            const err = error as Error
            return {
              success: false,
              error: err.message || 'BookGUI guide books generation failed',
              buildId,
            }
          }
        }

        if (inputs.generateGriefPrevention) {
          try {
            const bundledPath = getGriefPreventionBundledConfigPath()
            const nextGeneratorVersion = versionForEmit('griefprevention')
            const rawBody = fs.readFileSync(bundledPath, 'utf-8')
            const content = prependGeneratorVersionHeader(rawBody, {
              plugin: 'griefprevention',
              profileId: serverId,
              buildId,
              nextVersion: nextGeneratorVersion,
              generatedAt: timestamp,
              buildNote: headerStampNote,
              testEmit: testBuild,
            })
            const flatName = `${serverNameSanitized}-griefpreventiondata-config.yml`
            const buildDir = ensureBuildDirectory(serverId, buildId)
            if (propagate) {
              const dataRoot = path.join(inputs.outDir, 'GriefPreventionData')
              fs.mkdirSync(dataRoot, { recursive: true })
              fs.writeFileSync(path.join(dataRoot, 'config.yml'), content, 'utf-8')
            } else {
              fs.writeFileSync(path.join(inputs.outDir, flatName), content, 'utf-8')
            }
            fs.writeFileSync(path.join(buildDir, flatName), content, 'utf-8')
            persistGeneratorVersion('griefprevention', nextGeneratorVersion)
            griefPreventionGenerated = true
            configSources.griefprevention = {
              path: 'Bundled GriefPreventionData template',
              isDefault: true,
            }
          } catch (error: unknown) {
            const err = error as Error
            return {
              success: false,
              error: err.message || 'GriefPreventionData config copy failed',
              buildId,
            }
          }
        }

        if (inputs.generateWorldGuardRegions) {
          const srcPath = (inputs.worldGuardRegionsPath ?? '').trim()
          if (!srcPath) {
            return {
              success: false,
              error:
                'WorldGuard overworld regions.yml requires a source file (browse to your Region Forge export)',
              buildId,
            }
          }
          if (!existsSync(srcPath)) {
            return {
              success: false,
              error: `WorldGuard overworld regions source not found: ${srcPath}`,
              buildId,
            }
          }
          try {
            const nextGeneratorVersion = versionForEmit('worldguardregions')
            const rawBody = fs.readFileSync(srcPath, 'utf-8')
            const body = stripGeneratorVersionCommentLines(rawBody)
            const content = prependGeneratorVersionHeader(body, {
              plugin: 'worldguardregions',
              profileId: serverId,
              buildId,
              nextVersion: nextGeneratorVersion,
              generatedAt: timestamp,
              buildNote: headerStampNote,
              testEmit: testBuild,
            })
            const flatName = `${serverNameSanitized}-worldguard-regions.yml`
            const buildDir = ensureBuildDirectory(serverId, buildId)
            const worldFolder = sanitizeWorldGuardWorldFolder(inputs.worldGuardRegionsWorldFolder)
            if (propagate) {
              const rel = getWorldGuardRegionsPropagatedRelativePath(worldFolder)
              const outPath = path.join(inputs.outDir, rel)
              fs.mkdirSync(path.dirname(outPath), { recursive: true })
              fs.writeFileSync(outPath, content, 'utf-8')
            } else {
              fs.writeFileSync(path.join(inputs.outDir, flatName), content, 'utf-8')
            }
            fs.writeFileSync(path.join(buildDir, flatName), content, 'utf-8')
            persistGeneratorVersion('worldguardregions', nextGeneratorVersion)
            worldGuardRegionsGenerated = true
            configSources.worldguardregions = { path: srcPath, isDefault: false }
            profile.build.worldGuardRegionsSourcePath = srcPath
            profile.build.worldGuardRegionsWorldFolder = worldFolder
          } catch (error: unknown) {
            const err = error as Error
            return {
              success: false,
              error: err.message || 'WorldGuard overworld regions.yml copy failed',
              buildId,
            }
          }
        }

        if (inputs.generateWorldGuardRegionsNether) {
          const srcPath = (inputs.worldGuardRegionsNetherPath ?? '').trim()
          if (!srcPath) {
            return {
              success: false,
              error:
                'WorldGuard nether regions.yml requires a source file (browse to your Region Forge nether export)',
              buildId,
            }
          }
          if (!existsSync(srcPath)) {
            return {
              success: false,
              error: `WorldGuard nether regions source not found: ${srcPath}`,
              buildId,
            }
          }
          try {
            const nextGeneratorVersion = versionForEmit('worldguardregionsnether')
            const rawBody = fs.readFileSync(srcPath, 'utf-8')
            const body = stripGeneratorVersionCommentLines(rawBody)
            const content = prependGeneratorVersionHeader(body, {
              plugin: 'worldguardregionsnether',
              profileId: serverId,
              buildId,
              nextVersion: nextGeneratorVersion,
              generatedAt: timestamp,
              buildNote: headerStampNote,
              testEmit: testBuild,
            })
            const flatName = `${serverNameSanitized}-worldguard-regions-nether.yml`
            const buildDir = ensureBuildDirectory(serverId, buildId)
            const worldFolder = sanitizeWorldGuardWorldFolder(inputs.worldGuardRegionsNetherWorldFolder)
            if (propagate) {
              const rel = getWorldGuardRegionsPropagatedRelativePath(worldFolder)
              const outPath = path.join(inputs.outDir, rel)
              fs.mkdirSync(path.dirname(outPath), { recursive: true })
              fs.writeFileSync(outPath, content, 'utf-8')
            } else {
              fs.writeFileSync(path.join(inputs.outDir, flatName), content, 'utf-8')
            }
            fs.writeFileSync(path.join(buildDir, flatName), content, 'utf-8')
            persistGeneratorVersion('worldguardregionsnether', nextGeneratorVersion)
            worldGuardRegionsNetherGenerated = true
            configSources.worldguardregionsnether = { path: srcPath, isDefault: false }
            profile.build.worldGuardRegionsNetherSourcePath = srcPath
            profile.build.worldGuardRegionsNetherWorldFolder = worldFolder
          } catch (error: unknown) {
            const err = error as Error
            return {
              success: false,
              error: err.message || 'WorldGuard nether regions.yml copy failed',
              buildId,
            }
          }
        }

        const gvSnap = profile.generatorVersions
        const report: BuildReport = {
          buildId,
          timestamp,
          testBuild,
          ...(buildNoteTrimmed.length > 0 ? { buildNote: buildNoteTrimmed } : {}),
          regionCounts,
          computedCounts: regionCountsForTAB,
          generated: {
            aa: aaGenerated,
            bookgui: bookGuiGenerated,
            ce: ceGenerated,
            tab: tabGenerated,
            lm: lmGenerated,
            mc: mcGenerated,
            cw: cwGenerated,
            discordsrv: discordsrvGenerated,
            griefprevention: griefPreventionGenerated,
            worldguardregions: worldGuardRegionsGenerated,
            worldguardregionsnether: worldGuardRegionsNetherGenerated,
          },
          configSources,
          warnings,
          errors,
          ...(gvSnap && Object.keys(gvSnap).length > 0
            ? { generatorVersionsSnapshot: { ...gvSnap } }
            : {}),
        }
        saveBuildReport(serverId, buildId, report)

        profile.build.lastBuildId = buildId
        profile.build.outputDirectory = inputs.outDir
        if (typeof inputs.propagateToPluginFolders === 'boolean') {
          profile.build.propagateToPluginFolders = inputs.propagateToPluginFolders
        }
        if (inputs.discordSrv !== undefined) {
          profile.discordSrv = { ...(profile.discordSrv ?? {}), ...inputs.discordSrv }
        }
        saveServerProfile(profile)

        return { success: true, buildId, configSources }
      } catch (error: unknown) {
        const err = error as Error
        return {
          success: false,
          error: err.message || 'Unknown error during build',
        }
      }
    }
  )

  ipcMain.handle(
    'read-build-report',
    async (_event: unknown, serverId: string, buildId: string): Promise<BuildReport | null> => {
      return loadBuildReport(serverId, buildId)
    }
  )

  ipcMain.handle(
    'list-builds',
    async (_event: unknown, serverId: string) => {
      return listBuildSummaries(serverId)
    }
  )
}
