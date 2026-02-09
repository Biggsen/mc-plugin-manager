const { ipcMain, dialog } = require('electron')
const electron = require('electron')
const yaml = require('yaml')
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
const path = require('path')
const { importRegions, importRegionsMeta } = require('./regionParser')
const { generateAACommands, generateAACustom, mergeAAConfig } = require('./aaGenerator')
const { generateOwnedCEEvents, mergeCEConfig, getStartRegionAachId } = require('./ceGenerator')
const { generateOwnedTABSections, mergeTABConfig, computeRegionCounts } = require('./tabGenerator')
const { generateOwnedLMRules, mergeLMConfig } = require('./lmGenerator')
const { generateMCConfig } = require('./mcGenerator')
const { validateAADiff, validateCEDiff, validateTABDiff, validateLMDiff } = require('./diffValidator')

type ServerProfile = any
type ServerSummary = any
type ImportResult = any
type BuildResult = any
type BuildReport = any
type OnboardingConfig = any

// Resolve config path: use user-provided path if available, otherwise use bundled default
function resolveConfigPath(type: 'aa' | 'ce' | 'tab' | 'lm' | 'mc' | 'cw', userProvidedPath?: string): string {
  // If user provided path, validate and use it
  if (userProvidedPath && userProvidedPath.trim().length > 0) {
    if (!existsSync(userProvidedPath)) {
      throw new Error(`${type.toUpperCase()} config file not found: ${userProvidedPath}`)
    }
    return userProvidedPath
  }
  
  // Otherwise, use bundled default
  // In dev mode, __dirname points to dist-electron (where this file is compiled to)
  // In packaged mode, app.getAppPath() returns resources/app, but templates are in dist-electron/assets/templates
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : __dirname
  const filename = type === 'aa' ? 'advancedachievements-config.yml'
    : type === 'ce' ? 'conditionalevents-config.yml'
    : type === 'tab' ? 'tab-config.yml'
    : type === 'lm' ? 'levelledmobs-rules.yml'
    : type === 'mc' ? 'mycommand-commands.yml'
    : 'commandwhitelist-config.yml'
  // In packaged mode, templates are in dist-electron/assets/templates relative to app.getAppPath()
  // In dev mode, __dirname is already dist-electron, so we just need assets/templates
  const templatesPath = isPackaged 
    ? path.join(basePath, 'dist-electron', 'assets', 'templates', filename)
    : path.join(basePath, 'assets', 'templates', filename)
  const defaultPath = templatesPath
  
  if (!existsSync(defaultPath)) {
    throw new Error(`Bundled ${type.toUpperCase()} default config not found at: ${defaultPath}. This may indicate a packaging issue. Please ensure templates were copied during build.`)
  }
  
  return defaultPath
}

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
      
      // Merge spawnCenter (only from overworld imports)
      if (result.spawnCenter && result.world === 'overworld') {
        profile.spawnCenter = result.spawnCenter
        result.source.spawnCenter = result.spawnCenter
      }
      
      // Merge onboarding (only from overworld imports)
      if (result.onboarding && result.world === 'overworld') {
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
    inputs: {
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
      if (!inputs.generateAA && !inputs.generateCE && !inputs.generateTAB && !inputs.generateLM && !inputs.generateMC && !inputs.generateCW) {
        return {
          success: false,
          error: 'At least one plugin (AA, CE, TAB, LM, MC, or CommandWhitelist) must be selected',
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
      let mcGenerated = false
      let cwGenerated = false
      
      // Track config sources
      const configSources: any = {}
      
      // Compute region counts for TAB (used in build report)
      const regionCountsForTAB = computeRegionCounts(profile.regions)
      
      // Generate AA if checked
      if (inputs.generateAA) {
        try {
          const aaConfigPath = resolveConfigPath('aa', inputs.aaPath)
          const usingDefaultAA = !inputs.aaPath || inputs.aaPath.trim().length === 0
          
          // Generate AA Commands
          const newCommands = generateAACommands(profile.regions)
          
          // Generate AA Custom sections (requires reading template for reward definitions)
          const fs = require('fs')
          const templateContent = fs.readFileSync(aaConfigPath, 'utf-8')
          const templateConfig = yaml.parse(templateContent)
          const newCustom = generateAACustom(profile.regions, templateConfig)
          
          // Merge into AA config (Commands and Custom)
          const mergedAAContent = mergeAAConfig(aaConfigPath, newCommands, newCustom)
          
          // Validate diff (diff gate)
          const aaValidation = validateAADiff(aaConfigPath, mergedAAContent)
          if (!aaValidation.valid) {
            return {
              success: false,
              error: aaValidation.error || 'AA diff validation failed',
              buildId,
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
          configSources.aa = {
            path: aaConfigPath,
            isDefault: usingDefaultAA,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'AA generation failed',
            buildId,
          }
        }
      }

      // Generate CE if checked
      if (inputs.generateCE) {
        try {
          const ceConfigPath = resolveConfigPath('ce', inputs.cePath)
          const usingDefaultCE = !inputs.cePath || inputs.cePath.trim().length === 0

          const ownedEvents = generateOwnedCEEvents(profile.regions, profile.onboarding)
          let mergedCEContent = mergeCEConfig(ceConfigPath, ownedEvents)
          mergedCEContent = mergedCEContent.replace(/\{SERVER_NAME\}/g, profile.name)
          mergedCEContent = mergedCEContent.replace(/\{START_REGION_AACH\}/g, getStartRegionAachId(profile.onboarding, profile.regions))
          
          // Validate diff (diff gate)
          const ceValidation = validateCEDiff(ceConfigPath, mergedCEContent)
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
          configSources.ce = {
            path: ceConfigPath,
            isDefault: usingDefaultCE,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'CE generation failed',
            buildId,
          }
        }
      }

      // Generate TAB if checked
      if (inputs.generateTAB) {
        try {
          const tabConfigPath = resolveConfigPath('tab', inputs.tabPath)
          const usingDefaultTAB = !inputs.tabPath || inputs.tabPath.trim().length === 0

          const ownedTABSections = generateOwnedTABSections(
            profile.regions,
            profile.name,
            profile.regionsMeta?.levelledMobs?.regionBands
          )
          const mergedTABContent = mergeTABConfig(tabConfigPath, ownedTABSections)
          
          // Validate diff (diff gate)
          const tabValidation = validateTABDiff(tabConfigPath, mergedTABContent)
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
          configSources.tab = {
            path: tabConfigPath,
            isDefault: usingDefaultTAB,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'TAB generation failed',
            buildId,
          }
        }
      }

      // Generate LM if checked
      if (inputs.generateLM) {
        try {
          const lmConfigPath = resolveConfigPath('lm', inputs.lmPath)
          const usingDefaultLM = !inputs.lmPath || inputs.lmPath.trim().length === 0

          // Generate owned LM rules
          const ownedLMRules = generateOwnedLMRules(
            profile.regions,
            profile.regionsMeta?.levelledMobs
          )
          
          // Merge into LM config
          const mergedLMContent = mergeLMConfig(lmConfigPath, ownedLMRules)
          
          // Validate diff (diff gate)
          const lmValidation = validateLMDiff(lmConfigPath, mergedLMContent)
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
          configSources.lm = {
            path: lmConfigPath,
            isDefault: usingDefaultLM,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'LM generation failed',
            buildId,
          }
        }
      }

      // Generate MC if checked
      if (inputs.generateMC) {
        try {
          const mcConfigPath = resolveConfigPath('mc', inputs.mcPath)
          const usingDefaultMC = !inputs.mcPath || inputs.mcPath.trim().length === 0

          // Generate MC config with server name substitution
          const generatedMCContent = generateMCConfig(mcConfigPath, profile.name)
          
          // Generate filename with server name prefix
          const serverNameSanitized = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
          const mcFilename = `${serverNameSanitized}-mycommand-commands.yml`
          
          // Write to output directory
          const mcOutputPath = path.join(inputs.outDir, mcFilename)
          writeFileSync(mcOutputPath, generatedMCContent, 'utf-8')
          
          // Copy to build directory
          const buildDir = ensureBuildDirectory(serverId, buildId)
          const mcBuildPath = path.join(buildDir, mcFilename)
          writeFileSync(mcBuildPath, generatedMCContent, 'utf-8')
          
          mcGenerated = true
          configSources.mc = {
            path: mcConfigPath,
            isDefault: usingDefaultMC,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'MC generation failed',
            buildId,
          }
        }
      }

      // CommandWhitelist: copy from bundle/override (no generator yet)
      if (inputs.generateCW) {
        try {
          const cwConfigPath = resolveConfigPath('cw', inputs.cwPath)
          const usingDefaultCW = !inputs.cwPath || inputs.cwPath.trim().length === 0
          const fs = require('fs')
          const cwContent = fs.readFileSync(cwConfigPath, 'utf-8')

          const serverNameSanitized = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
          const cwFilename = `${serverNameSanitized}-commandwhitelist-config.yml`

          const cwOutputPath = path.join(inputs.outDir, cwFilename)
          writeFileSync(cwOutputPath, cwContent, 'utf-8')

          const buildDir = ensureBuildDirectory(serverId, buildId)
          const cwBuildPath = path.join(buildDir, cwFilename)
          writeFileSync(cwBuildPath, cwContent, 'utf-8')

          cwGenerated = true
          configSources.cw = {
            path: cwConfigPath,
            isDefault: usingDefaultCW,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'CommandWhitelist copy failed',
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
