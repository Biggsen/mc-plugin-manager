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
const { computeRegionCounts } = require('../../tabGenerator')
const { sanitizeServerName } = require('../../utils/stringFormatters')
const { runPluginBuild } = require('../../build/buildPluginConfig')

import type { BuildResult, BuildReport, RegionRecord } from '../../types'

function getGuideBooksSourceDir(): string {
  const electron = require('electron')
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '../..')
  const guideBooksDir = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'templates', 'guide-books')
    : path.join(basePath, 'assets', 'templates', 'guide-books')
  if (!existsSync(guideBooksDir)) {
    throw new Error(`Bundled BookGUI guide books not found at: ${guideBooksDir}. Run "npm run build:electron" to copy templates.`)
  }
  return guideBooksDir
}

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
        aaPath?: string
        cePath?: string
        tabPath?: string
        lmPath?: string
        mcPath?: string
        cwPath?: string
        outDir: string
        propagateToPluginFolders?: boolean
        myCommandDiscordInvite?: string
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
          !inputs.generateCW
        ) {
          return {
            success: false,
            error: 'At least one plugin (AA, BookGUI, CE, TAB, LM, MC, or CommandWhitelist) must be selected',
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
        const serverNameSanitized = sanitizeServerName(profile.name)
        const buildId = `build-${Date.now()}`
        const timestamp = new Date().toISOString()
        const warnings: string[] = []
        const errors: string[] = []
        const regionCounts = {
          overworld: profile.regions.filter((r: RegionRecord) => r.world === 'overworld').length,
          nether: profile.regions.filter((r: RegionRecord) => r.world === 'nether').length,
          hearts: profile.regions.filter((r: RegionRecord) => r.kind === 'heart').length,
          villages: profile.regions.filter((r: RegionRecord) => r.kind === 'village').length,
          regions: profile.regions.filter((r: RegionRecord) => r.kind === 'region').length,
          system: profile.regions.filter((r: RegionRecord) => r.kind === 'system').length,
        }

        let aaGenerated = false
        let bookGuiGenerated = false
        let ceGenerated = false
        let tabGenerated = false
        let lmGenerated = false
        let mcGenerated = false
        let cwGenerated = false
        const configSources: BuildResult['configSources'] = {}

        const regionCountsForTAB = computeRegionCounts(profile.regions)
        const buildContext = { serverId, buildId, serverNameSanitized, propagate }

        if (inputs.generateAA) {
          const result = runPluginBuild('aa', profile, inputs, buildContext)
          if (!result.success) return { success: false, error: result.error, buildId }
          aaGenerated = true
          configSources.aa = result.configSource
        }
        if (inputs.generateCE) {
          const result = runPluginBuild('ce', profile, inputs, buildContext)
          if (!result.success) return { success: false, error: result.error, buildId }
          ceGenerated = true
          configSources.ce = result.configSource
        }
        if (inputs.generateTAB) {
          const result = runPluginBuild('tab', profile, inputs, buildContext)
          if (!result.success) return { success: false, error: result.error, buildId }
          tabGenerated = true
          configSources.tab = result.configSource
        }
        if (inputs.generateLM) {
          const result = runPluginBuild('lm', profile, inputs, buildContext)
          if (!result.success) return { success: false, error: result.error, buildId }
          lmGenerated = true
          configSources.lm = result.configSource
        }
        if (inputs.generateMC) {
          const result = runPluginBuild('mc', profile, inputs, buildContext)
          if (!result.success) return { success: false, error: result.error, buildId }
          mcGenerated = true
          configSources.mc = result.configSource
        }
        if (inputs.generateCW) {
          const result = runPluginBuild('cw', profile, inputs, buildContext)
          if (!result.success) return { success: false, error: result.error, buildId }
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
            const serverName = profile.name
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
          },
          configSources,
          warnings,
          errors,
        }
        saveBuildReport(serverId, buildId, report)

        profile.build.lastBuildId = buildId
        profile.build.outputDirectory = inputs.outDir
        if (typeof inputs.propagateToPluginFolders === 'boolean') {
          profile.build.propagateToPluginFolders = inputs.propagateToPluginFolders
        }
        if (inputs.myCommandDiscordInvite !== undefined) {
          profile.myCommand = profile.myCommand ?? {}
          profile.myCommand.discordInvite = inputs.myCommandDiscordInvite
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
