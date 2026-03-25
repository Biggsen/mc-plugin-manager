const { ipcMain } = require('electron')
const path = require('path')
const { existsSync, writeFileSync } = require('fs')
const {
  loadServerProfile,
  saveServerProfile,
  ensureBuildDirectory,
  saveBuildReport,
  loadBuildReport,
  listBuildIds,
} = require('../../storage')
const { computeRegionCounts, computeRegionStats } = require('../../utils/regionStats')
const { sanitizeServerName } = require('../../utils/stringFormatters')
const { runPluginBuild } = require('../../build/buildPluginConfig')
const {
  readDiscordSrvTemplatePaths,
  generateDiscordSrvConfigContent,
  readDiscordSrvMessagesContent,
} = require('../../discordSrvGenerator')
const { prependGeneratorVersionHeader } = require('../../utils/generatorVersionHeader')

import type { BuildResult, BuildReport, DiscordSrvSettings } from '../../types'
import { resolveConfigServerName } from '../../utils/resolveConfigServerName'
import { getGuideBooksSourceDir } from '../../utils/guideBooksDir'

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
        discordSrv?: DiscordSrvSettings
        aaPath?: string
        cePath?: string
        tabPath?: string
        lmPath?: string
        mcPath?: string
        cwPath?: string
        outDir: string
        propagateToPluginFolders?: boolean
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
          !inputs.generateDiscordSRV
        ) {
          return {
            success: false,
            error:
              'At least one plugin (AA, BookGUI, CE, TAB, LM, MC, CommandWhitelist, or DiscordSRV) must be selected',
          }
        }
        if (!inputs.outDir || inputs.outDir.trim().length === 0) {
          return { success: false, error: 'Output directory must be set' }
        }

        const fs = require('fs')
        if (!existsSync(inputs.outDir)) {
          fs.mkdirSync(inputs.outDir, { recursive: true })
        }

        const propagate = Boolean(inputs.propagateToPluginFolders)
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
        const configSources: BuildResult['configSources'] = {}

        const regionCountsForTAB = computeRegionCounts(profile.regions)
        const buildContextBase = {
          serverId,
          buildId,
          serverNameSanitized,
          propagate,
          profileId: serverId,
          generatedAt: timestamp,
        }

        if (inputs.generateAA) {
          const nextGeneratorVersion = (profile.generatorVersions?.aa ?? 0) + 1
          const result = runPluginBuild('aa', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          profile.generatorVersions = { ...(profile.generatorVersions ?? {}), aa: nextGeneratorVersion }
          aaGenerated = true
          configSources.aa = result.configSource
        }
        if (inputs.generateCE) {
          const nextGeneratorVersion = (profile.generatorVersions?.ce ?? 0) + 1
          const result = runPluginBuild('ce', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          profile.generatorVersions = { ...(profile.generatorVersions ?? {}), ce: nextGeneratorVersion }
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
            const nextGeneratorVersion = (profile.generatorVersions?.discordsrv ?? 0) + 1
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
            })
            const messagesBody = readDiscordSrvMessagesContent(srvMessagesTpl)
            const messagesContent = prependGeneratorVersionHeader(messagesBody, {
              plugin: 'discordsrv',
              profileId: headerCtx.profileId ?? serverId,
              buildId: headerCtx.buildId,
              nextVersion: headerCtx.nextGeneratorVersion,
              generatedAt: headerCtx.generatedAt ?? timestamp,
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
            profile.generatorVersions = {
              ...(profile.generatorVersions ?? {}),
              discordsrv: nextGeneratorVersion,
            }
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
          const nextGeneratorVersion = (profile.generatorVersions?.tab ?? 0) + 1
          const result = runPluginBuild('tab', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          profile.generatorVersions = { ...(profile.generatorVersions ?? {}), tab: nextGeneratorVersion }
          tabGenerated = true
          configSources.tab = result.configSource
        }
        if (inputs.generateLM) {
          const nextGeneratorVersion = (profile.generatorVersions?.lm ?? 0) + 1
          const result = runPluginBuild('lm', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          profile.generatorVersions = { ...(profile.generatorVersions ?? {}), lm: nextGeneratorVersion }
          lmGenerated = true
          configSources.lm = result.configSource
        }
        if (inputs.generateMC) {
          const nextGeneratorVersion = (profile.generatorVersions?.mc ?? 0) + 1
          const result = runPluginBuild('mc', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          profile.generatorVersions = { ...(profile.generatorVersions ?? {}), mc: nextGeneratorVersion }
          mcGenerated = true
          configSources.mc = result.configSource
        }
        if (inputs.generateCW) {
          const nextGeneratorVersion = (profile.generatorVersions?.cw ?? 0) + 1
          const result = runPluginBuild('cw', profile, inputs, {
            ...buildContextBase,
            nextGeneratorVersion,
          })
          if (!result.success) return { success: false, error: result.error, buildId }
          profile.generatorVersions = { ...(profile.generatorVersions ?? {}), cw: nextGeneratorVersion }
          cwGenerated = true
          configSources.cw = result.configSource
        }

        if (inputs.generateBookGUI) {
          try {
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
              writeFileSync(path.join(bookGuiOutputDir, filename), substituted, 'utf-8')
            }
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

        const gvSnap = profile.generatorVersions
        const report: BuildReport = {
          buildId,
          timestamp,
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
    async (_event: unknown, serverId: string): Promise<string[]> => {
      return listBuildIds(serverId)
    }
  )
}
