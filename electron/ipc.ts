const { ipcMain, dialog } = require('electron')
const electron = require('electron')
const {
  loadServerProfile,
  saveServerProfile,
  deleteServer,
  listServerIds,
  getServerDirectory,
  ensureBuildDirectory,
  saveBuildReport,
  loadBuildReport,
  listBuildIds,
} = require('./storage')
const { randomUUID } = require('crypto')
const { existsSync, writeFileSync, copyFileSync } = require('fs')
const path = require('path')
const { importRegions, importRegionsMeta } = require('./regionParser')
const { computeRegionCounts } = require('./tabGenerator')
const { generateLoreBooks } = require('./loreBooksGenerator')
const { sanitizeServerName } = require('./utils/stringFormatters')
const { runPluginBuild } = require('./build/buildPluginConfig')

import type { ServerProfile, ImportResult, BuildResult, BuildReport, OnboardingConfig } from './types'

function getGuideBooksSourceDir(): string {
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : __dirname
  const guideBooksDir = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'templates', 'guide-books')
    : path.join(basePath, 'assets', 'templates', 'guide-books')
  if (!existsSync(guideBooksDir)) {
    throw new Error(`Bundled BookGUI guide books not found at: ${guideBooksDir}. Run "npm run build:electron" to copy templates.`)
  }
  return guideBooksDir
}

// List all server profiles with stats for dashboard cards
ipcMain.handle('list-servers', async (_event: any) => {
  const serverIds = listServerIds()
  const summaries = []

  for (const id of serverIds) {
    const profile = loadServerProfile(id)
    if (!profile) continue

    const regions: Array<{ world?: string; kind?: string }> = profile.regions || []
    const regionCount = regions.filter((r) => r.world === 'overworld' && r.kind === 'region').length
    const villageCount = regions.filter((r) => r.world === 'overworld' && r.kind === 'village').length
    const heartCount = regions.filter((r) => r.world === 'overworld' && r.kind === 'heart').length
    const netherRegionCount = regions.filter((r) => r.world === 'nether' && r.kind === 'region').length

    const dates = [
      profile.sources?.overworld?.importedAtIso,
      profile.sources?.nether?.importedAtIso,
      profile.sources?.end?.importedAtIso,
    ].filter(Boolean)
    const lastImportIso = dates.length > 0 ? dates.sort().reverse()[0] : null

    summaries.push({
      id: profile.id,
      name: profile.name,
      regionCount,
      villageCount,
      heartCount,
      netherRegionCount,
      lastImportIso,
    })
  }

  return summaries
})

// Create a new server profile
ipcMain.handle(
  'create-server',
  async (_event: any, name: string): Promise<ServerProfile> => {
    const id = sanitizeServerName(name)
    const serverId = `${id}-${randomUUID().substring(0, 8)}`

    const profile: ServerProfile = {
      id: serverId,
      name,
      sources: {},
      regions: [],
      onboarding: {
        startRegionId: '',
        teleport: {
          world: '',
          x: 0,
          z: 0,
          // y is optional - omit it for new profiles
        },
      },
      build: {},
    }

    saveServerProfile(profile)
    return profile
  }
)

// Get a server profile
ipcMain.handle(
  'get-server',
  async (_event: any, serverId: string): Promise<ServerProfile | null> => {
    return loadServerProfile(serverId)
  }
)

// Delete a server (removes its data directory)
ipcMain.handle(
  'delete-server',
  async (_event: any, serverId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      deleteServer(serverId)
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message ?? 'Failed to delete server',
      }
    }
  }
)

ipcMain.handle(
  'set-mycommand-discord-invite',
  async (_event: any, serverId: string, value: string): Promise<void> => {
    const profile = loadServerProfile(serverId)
    if (!profile) return
    profile.myCommand = profile.myCommand ?? {}
    profile.myCommand.discordInvite = value
    saveServerProfile(profile)
  }
)

// Import regions
ipcMain.handle(
  'import-regions',
  async (
    _event: any,
    serverId: string,
    world: 'overworld' | 'nether',
    filePath: string
  ): Promise<ImportResult> => {
    try {
      const profile = loadServerProfile(serverId)
      if (!profile) {
        return {
          success: false,
          error: `Server profile not found: ${serverId}`,
        }
      }
      
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        }
      }
      
      // Import regions
      const result = importRegions(
        filePath,
        world,
        profile.regions,
        profile.onboarding
      )
      
      // Update profile
      profile.regions = result.regions
      if (world === 'overworld') {
        profile.sources.overworld = result.source
      } else {
        profile.sources.nether = result.source
      }
      
      saveServerProfile(profile)
      
      return {
        success: true,
        regionCount: result.regions.filter((r: any) => r.world === world).length,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during import',
      }
    }
  }
)

// Import regions-meta
ipcMain.handle(
  'import-regions-meta',
  async (
    _event: any,
    serverId: string,
    world: 'overworld' | 'nether' | 'end',
    filePath: string
  ): Promise<ImportResult> => {
    try {
      const profile = loadServerProfile(serverId)
      if (!profile) {
        return {
          success: false,
          error: `Server profile not found: ${serverId}`,
        }
      }
      
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        }
      }
      
      // Import regions-meta
      const result = importRegionsMeta(filePath, world)
      
      // Preserve loreBookAnchors from existing regions when merging
      const existingByKey = new Map<string, any>()
      for (const r of profile.regions) {
        if (r.world === result.world) {
          existingByKey.set(r.id, r)
        }
      }
      
      // Update profile: Remove existing regions for this world, then add new ones
      profile.regions = profile.regions.filter((r: any) => r.world !== result.world)
      const mergedRegions = result.regions.map((r: any) => {
        const existing = existingByKey.get(r.id)
        const merged = { ...r }
        if (existing?.loreBookAnchors) merged.loreBookAnchors = existing.loreBookAnchors
        merged.loreBookDescription = undefined
        return merged
      })
      profile.regions.push(...mergedRegions)
      
      // Update sources
      if (result.world === 'overworld') {
        profile.sources.overworld = result.source
        profile.sources.world = result.source // Also set 'world' for backward compat
      } else if (result.world === 'nether') {
        profile.sources.nether = result.source
      } else if (result.world === 'end') {
        profile.sources.end = result.source
      }
      
      // Merge spawnCenter (only from overworld imports)
      if (result.spawnCenter && result.world === 'overworld') {
        profile.spawnCenter = result.spawnCenter
        result.source.spawnCenter = result.spawnCenter
      }
      
      // Merge onboarding (only from overworld imports). Import always overrides profile values.
      if (result.onboarding && result.world === 'overworld') {
        profile.onboarding = {
          ...profile.onboarding,
          ...result.onboarding,
          teleport: { ...result.onboarding.teleport },
        }
      }
      
      // Merge levelledMobs
      if (result.levelledMobs) {
        if (!profile.regionsMeta) {
          profile.regionsMeta = { levelledMobs: {} }
        }
        if (!profile.regionsMeta.levelledMobs) {
          profile.regionsMeta.levelledMobs = {}
        }
        
        // villageBandStrategy: last import wins
        if (result.levelledMobs.villageBandStrategy !== undefined) {
          profile.regionsMeta.levelledMobs.villageBandStrategy = result.levelledMobs.villageBandStrategy
        }
        
        // regionBands: merge objects (later imports overwrite)
        if (result.levelledMobs.regionBands) {
          profile.regionsMeta.levelledMobs.regionBands = {
            ...profile.regionsMeta.levelledMobs.regionBands,
            ...result.levelledMobs.regionBands,
          }
        }
      }
      
      saveServerProfile(profile)
      
      return {
        success: true,
        regionCount: result.regions.length,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during import',
      }
    }
  }
)

// Show file dialog for region import
ipcMain.handle(
  'show-import-dialog',
  async (_event: any): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Region Forge Export File',
      filters: [
        { name: 'YAML Files', extensions: ['yml', 'yaml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    return result.filePaths[0]
  }
)

// Update lore book anchors and/or description for a region
ipcMain.handle(
  'update-region-lore-book',
  async (
    _event: any,
    serverId: string,
    regionId: string,
    updates: { anchors?: string[]; description?: string }
  ): Promise<ServerProfile | null> => {
    const profile = loadServerProfile(serverId)
    if (!profile) return null
    const region = profile.regions.find((r: any) => r.id === regionId)
    if (!region) return null
    if (updates.anchors !== undefined) {
      region.loreBookAnchors = updates.anchors.length > 0 ? updates.anchors : undefined
    }
    if (updates.description !== undefined) {
      region.loreBookDescription = updates.description.trim() || undefined
    }
    saveServerProfile(profile)
    return profile
  }
)

// Update onboarding configuration
ipcMain.handle(
  'update-onboarding',
  async (
    _event: any,
    serverId: string,
    onboarding: OnboardingConfig
  ): Promise<ServerProfile | null> => {
    const profile = loadServerProfile(serverId)
    if (!profile) {
      return null
    }

    profile.onboarding = onboarding
    saveServerProfile(profile)
    return profile
  }
)

// Build configs
ipcMain.handle(
  'build-configs',
  async (
    _event: any,
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
        return {
          success: false,
          error: `Server profile not found: ${serverId}`,
        }
      }
      
      // Validate at least one plugin is checked
      if (!inputs.generateAA && !inputs.generateBookGUI && !inputs.generateCE && !inputs.generateTAB && !inputs.generateLM && !inputs.generateMC && !inputs.generateCW) {
        return {
          success: false,
          error: 'At least one plugin (AA, BookGUI, CE, TAB, LM, MC, or CommandWhitelist) must be selected',
        }
      }
      
      // Validate output directory is set
      if (!inputs.outDir || inputs.outDir.trim().length === 0) {
        return {
          success: false,
          error: 'Output directory must be set',
        }
      }
      
      // Write output (create output directory if needed)
      const fs = require('fs')
      if (!existsSync(inputs.outDir)) {
        fs.mkdirSync(inputs.outDir, { recursive: true })
      }

      const propagate = Boolean(inputs.propagateToPluginFolders)
      const serverNameSanitized = sanitizeServerName(profile.name)

      // Generate build ID
      const buildId = `build-${Date.now()}`
      const timestamp = new Date().toISOString()
      
      // Prepare build report
      const warnings: string[] = []
      const errors: string[] = []
      const regionCounts = {
        overworld: profile.regions.filter((r: any) => r.world === 'overworld').length,
        nether: profile.regions.filter((r: any) => r.world === 'nether').length,
        hearts: profile.regions.filter((r: any) => r.kind === 'heart').length,
        villages: profile.regions.filter((r: any) => r.kind === 'village').length,
        regions: profile.regions.filter((r: any) => r.kind === 'region').length,
        system: profile.regions.filter((r: any) => r.kind === 'system').length,
      }
      
      let aaGenerated = false
      let bookGuiGenerated = false
      let ceGenerated = false
      let tabGenerated = false
      let lmGenerated = false
      let mcGenerated = false
      let cwGenerated = false
      
      // Track config sources
      const configSources: any = {}
      
      // Compute region counts for TAB (used in build report)
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

      // BookGUI: copy guide books from bundle, substitute {SERVER_NAME}, skip guide_lore.yml if !hasLore
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
          configSources.bookgui = {
            path: 'Bundled guide books',
            isDefault: true,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'BookGUI guide books generation failed',
            buildId,
          }
        }
      }
      
      // Create build report
      const report = {
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
      
      // Save build report
      saveBuildReport(serverId, buildId, report)
      
      // Update profile with build info
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
      
      return {
        success: true,
        buildId,
        configSources,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during build',
      }
    }
  }
)

// Export lore books
ipcMain.handle(
  'export-lore-books',
  async (
    _event: any,
    serverId: string,
    inputs: { outDir: string; author?: string }
  ): Promise<{ success: boolean; count?: number; error?: string }> => {
    try {
      const profile = loadServerProfile(serverId)
      if (!profile) {
        return { success: false, error: `Server profile not found: ${serverId}` }
      }

      if (!inputs.outDir || inputs.outDir.trim().length === 0) {
        return { success: false, error: 'Output directory must be set' }
      }

      const fs = require('fs')
      if (!existsSync(inputs.outDir)) {
        fs.mkdirSync(inputs.outDir, { recursive: true })
      }

      const books = generateLoreBooks(profile.regions, inputs.author || 'Admin')

      for (const [regionId, yamlContent] of books) {
        const filename = `${regionId}.yml`
        const outputPath = path.join(inputs.outDir, filename)
        writeFileSync(outputPath, yamlContent, 'utf-8')
      }

      profile.build = profile.build || {}
      profile.build.loreBooksOutputDirectory = inputs.outDir
      saveServerProfile(profile)

      return { success: true, count: books.size }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Lore books export failed',
      }
    }
  }
)

// Show file dialog for config file selection
ipcMain.handle(
  'show-config-file-dialog',
  async (_event: any, title: string, defaultPath?: string): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title,
      defaultPath,
      filters: [
        { name: 'YAML Files', extensions: ['yml', 'yaml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    return result.filePaths[0]
  }
)

// Show directory dialog for output
ipcMain.handle(
  'show-output-dialog',
  async (_event: any): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Output Directory',
      properties: ['openDirectory'],
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    return result.filePaths[0]
  }
)

// Read build report
ipcMain.handle(
  'read-build-report',
  async (_event: any, serverId: string, buildId: string): Promise<BuildReport | null> => {
    return loadBuildReport(serverId, buildId)
  }
)

// List build IDs for a server
ipcMain.handle(
  'list-builds',
  async (_event: any, serverId: string): Promise<string[]> => {
    return listBuildIds(serverId)
  }
)

// IPC handlers are registered via ipcMain.handle() calls above
// They are automatically available once this module is imported
