const { ipcMain, dialog } = require('electron')
const {
  loadServerProfile,
  saveServerProfile,
  listServerIds,
  getServerDirectory,
  ensureBuildDirectory,
  saveBuildReport,
  loadBuildReport,
  listBuildIds,
} = require('./storage')
const { randomUUID } = require('crypto')
const { existsSync, writeFileSync, copyFileSync } = require('fs')
const { importRegions, importRegionsMeta } = require('./regionParser')
const { generateAACommands, mergeAAConfig } = require('./aaGenerator')
const { generateOwnedCEEvents, mergeCEConfig } = require('./ceGenerator')
const { generateOwnedTABSections, mergeTABConfig, computeRegionCounts } = require('./tabGenerator')
const { generateOwnedLMRules, mergeLMConfig } = require('./lmGenerator')
const { validateAADiff, validateCEDiff, validateTABDiff, validateLMDiff } = require('./diffValidator')

type ServerProfile = any
type ServerSummary = any
type ImportResult = any
type BuildResult = any
type BuildReport = any
type OnboardingConfig = any

// List all server profiles
ipcMain.handle('list-servers', async (_event: any): Promise<ServerSummary[]> => {
  const serverIds = listServerIds()
  const summaries: ServerSummary[] = []

  for (const id of serverIds) {
    const profile = loadServerProfile(id)
    if (profile) {
      summaries.push({
        id: profile.id,
        name: profile.name,
      })
    }
  }

  return summaries
})

// Create a new server profile
ipcMain.handle(
  'create-server',
  async (_event: any, name: string): Promise<ServerProfile> => {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
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
      
      // Update profile: Remove existing regions for this world, then add new ones
      profile.regions = profile.regions.filter((r: any) => r.world !== result.world)
      profile.regions.push(...result.regions)
      
      // Update sources
      if (result.world === 'overworld') {
        profile.sources.overworld = result.source
        profile.sources.world = result.source // Also set 'world' for backward compat
      } else if (result.world === 'nether') {
        profile.sources.nether = result.source
      } else if (result.world === 'end') {
        profile.sources.end = result.source
      }
      
      // Merge spawnCenter (last import wins)
      if (result.spawnCenter) {
        profile.spawnCenter = result.spawnCenter
        result.source.spawnCenter = result.spawnCenter
      }
      
      // Merge onboarding
      if (result.onboarding) {
        profile.onboarding = {
          ...profile.onboarding,
          ...result.onboarding,
          teleport: {
            ...profile.onboarding.teleport,
            ...result.onboarding.teleport,
            // Preserve y if file omits it
            y: result.onboarding.teleport.y ?? profile.onboarding.teleport.y,
          },
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
    inputs: { cePath: string; aaPath: string; tabPath: string; lmPath: string; outDir: string }
  ): Promise<BuildResult> => {
    try {
      const profile = loadServerProfile(serverId)
      if (!profile) {
        return {
          success: false,
          error: `Server profile not found: ${serverId}`,
        }
      }
      
      // Validate at least one input file
      if (!inputs.aaPath && !inputs.cePath && !inputs.tabPath && !inputs.lmPath) {
        return {
          success: false,
          error: 'At least one config file (AA, CE, TAB, or LM) must be provided',
        }
      }
      
      // Write output (create output directory if needed)
      const path = require('path')
      const fs = require('fs')
      if (!existsSync(inputs.outDir)) {
        fs.mkdirSync(inputs.outDir, { recursive: true })
      }

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
      let ceGenerated = false
      let tabGenerated = false
      let lmGenerated = false
      
      // Compute region counts for TAB (used in build report)
      const regionCountsForTAB = computeRegionCounts(profile.regions)
      
      // Generate AA if path provided
      if (inputs.aaPath && inputs.aaPath.trim().length > 0) {
        if (!existsSync(inputs.aaPath)) {
          return {
            success: false,
            error: `AA config file not found: ${inputs.aaPath}`,
          }
        }
        
        // Generate AA Commands
        const newCommands = generateAACommands(profile.regions)
        
        // Merge into AA config
        const mergedAAContent = mergeAAConfig(inputs.aaPath, newCommands)
        
        // Validate diff (diff gate)
        const aaValidation = validateAADiff(inputs.aaPath, mergedAAContent)
        if (!aaValidation.valid) {
          return {
            success: false,
            error: aaValidation.error || 'AA diff validation failed',
            buildId, // Include buildId even on failure for reference
          }
        }
        
        // Generate filename with server name prefix
        const serverNameSanitized = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const aaFilename = `${serverNameSanitized}-advancedachievements-config.yml`
        
        // Write to output directory
        const aaOutputPath = path.join(inputs.outDir, aaFilename)
        writeFileSync(aaOutputPath, mergedAAContent, 'utf-8')
        
        // Copy to build directory
        const buildDir = ensureBuildDirectory(serverId, buildId)
        const aaBuildPath = path.join(buildDir, aaFilename)
        writeFileSync(aaBuildPath, mergedAAContent, 'utf-8')
        
        aaGenerated = true
      }

      // Generate CE if path provided
      if (inputs.cePath && inputs.cePath.trim().length > 0) {
        if (!existsSync(inputs.cePath)) {
          return {
            success: false,
            error: `CE config file not found: ${inputs.cePath}`,
          }
        }

        const ownedEvents = generateOwnedCEEvents(profile.regions, profile.onboarding)
        const mergedCEContent = mergeCEConfig(inputs.cePath, ownedEvents)
        
        // Validate diff (diff gate)
        const ceValidation = validateCEDiff(inputs.cePath, mergedCEContent)
        if (!ceValidation.valid) {
          return {
            success: false,
            error: ceValidation.error || 'CE diff validation failed',
            buildId,
          }
        }
        
        // Generate filename with server name prefix
        const serverNameSanitized = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const ceFilename = `${serverNameSanitized}-conditionalevents-config.yml`
        
        // Write to output directory
        const ceOutputPath = path.join(inputs.outDir, ceFilename)
        writeFileSync(ceOutputPath, mergedCEContent, 'utf-8')
        
        // Copy to build directory
        const buildDir = ensureBuildDirectory(serverId, buildId)
        const ceBuildPath = path.join(buildDir, ceFilename)
        writeFileSync(ceBuildPath, mergedCEContent, 'utf-8')
        
        ceGenerated = true
      }

      // Generate TAB if path provided
      if (inputs.tabPath && inputs.tabPath.trim().length > 0) {
        if (!existsSync(inputs.tabPath)) {
          return {
            success: false,
            error: `TAB config file not found: ${inputs.tabPath}`,
          }
        }

        const ownedTABSections = generateOwnedTABSections(profile.regions, profile.name)
        const mergedTABContent = mergeTABConfig(inputs.tabPath, ownedTABSections)
        
        // Validate diff (diff gate)
        const tabValidation = validateTABDiff(inputs.tabPath, mergedTABContent)
        if (!tabValidation.valid) {
          return {
            success: false,
            error: tabValidation.error || 'TAB diff validation failed',
            buildId,
          }
        }
        
        // Generate filename with server name prefix
        const serverNameSanitized = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const tabFilename = `${serverNameSanitized}-tab-config.yml`
        
        // Write to output directory
        const tabOutputPath = path.join(inputs.outDir, tabFilename)
        writeFileSync(tabOutputPath, mergedTABContent, 'utf-8')
        
        // Copy to build directory
        const buildDir = ensureBuildDirectory(serverId, buildId)
        const tabBuildPath = path.join(buildDir, tabFilename)
        writeFileSync(tabBuildPath, mergedTABContent, 'utf-8')
        
        tabGenerated = true
      }

      // Generate LM if path provided
      if (inputs.lmPath && inputs.lmPath.trim().length > 0) {
        if (!existsSync(inputs.lmPath)) {
          return {
            success: false,
            error: `LM config file not found: ${inputs.lmPath}`,
          }
        }

        // Generate owned LM rules
        const ownedLMRules = generateOwnedLMRules(
          profile.regions,
          profile.regionsMeta?.levelledMobs
        )
        
        // Merge into LM config
        const mergedLMContent = mergeLMConfig(inputs.lmPath, ownedLMRules)
        
        // Validate diff (diff gate)
        const lmValidation = validateLMDiff(inputs.lmPath, mergedLMContent)
        if (!lmValidation.valid) {
          return {
            success: false,
            error: lmValidation.error || 'LM diff validation failed',
            buildId,
          }
        }
        
        // Generate filename with server name prefix
        const serverNameSanitized = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const lmFilename = `${serverNameSanitized}-levelledmobs-rules.yml`
        
        // Write to output directory
        const lmOutputPath = path.join(inputs.outDir, lmFilename)
        writeFileSync(lmOutputPath, mergedLMContent, 'utf-8')
        
        // Copy to build directory
        const buildDir = ensureBuildDirectory(serverId, buildId)
        const lmBuildPath = path.join(buildDir, lmFilename)
        writeFileSync(lmBuildPath, mergedLMContent, 'utf-8')
        
        lmGenerated = true
      }
      
      // Create build report
      const report = {
        buildId,
        timestamp,
        regionCounts,
        computedCounts: regionCountsForTAB,
        generated: {
          aa: aaGenerated,
          ce: ceGenerated,
          tab: tabGenerated,
          lm: lmGenerated,
        },
        warnings,
        errors,
      }
      
      // Save build report
      saveBuildReport(serverId, buildId, report)
      
      // Update profile with build info
      profile.build.lastBuildId = buildId
      profile.build.outputDirectory = inputs.outDir
      saveServerProfile(profile)
      
      return {
        success: true,
        buildId,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during build',
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
