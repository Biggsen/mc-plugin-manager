const { ipcMain, dialog } = require('electron')
const {
  loadServerProfile,
  saveServerProfile,
  listServerIds,
  getServerDirectory,
} = require('./storage')
const { randomUUID } = require('crypto')
const { existsSync, writeFileSync } = require('fs')
const { importRegions } = require('./regionParser')
const { generateAACommands, mergeAAConfig } = require('./aaGenerator')

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
          y: 0,
          z: 0,
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
    inputs: { cePath: string; aaPath: string; outDir: string }
  ): Promise<BuildResult> => {
    try {
      const profile = loadServerProfile(serverId)
      if (!profile) {
        return {
          success: false,
          error: `Server profile not found: ${serverId}`,
        }
      }
      
      // Validate input files exist
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
      
      // Write output (create output directory if needed)
      const path = require('path')
      const fs = require('fs')
      if (!existsSync(inputs.outDir)) {
        fs.mkdirSync(inputs.outDir, { recursive: true })
      }
      
      const aaOutputPath = path.join(inputs.outDir, 'advancedachievements-config.yml')
      writeFileSync(aaOutputPath, mergedAAContent, 'utf-8')
      
      // Generate build ID
      const buildId = `build-${Date.now()}`
      
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

// Read build report (placeholder)
ipcMain.handle(
  'read-build-report',
  async (_event: any, serverId: string, buildId: string): Promise<BuildReport | null> => {
    // TODO: Implement in M5
    return null
  }
)

// IPC handlers are registered via ipcMain.handle() calls above
// They are automatically available once this module is imported
