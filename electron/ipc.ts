const { ipcMain, dialog } = require('electron')
const {
  loadServerProfile,
  saveServerProfile,
  listServerIds,
  getServerDirectory,
} = require('./storage')
const { randomUUID } = require('crypto')
const { existsSync } = require('fs')

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

// Import regions (placeholder for M2)
ipcMain.handle(
  'import-regions',
  async (
    _event: any,
    serverId: string,
    world: 'overworld' | 'nether',
    filePath: string
  ): Promise<ImportResult> => {
    // TODO: Implement in M2
    return {
      success: false,
      error: 'Import functionality not yet implemented (M2)',
    }
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

// Build configs (placeholder for M3/M4)
ipcMain.handle(
  'build-configs',
  async (
    _event: any,
    serverId: string,
    inputs: { cePath: string; aaPath: string; outDir: string }
  ): Promise<BuildResult> => {
    // TODO: Implement in M3/M4
    return {
      success: false,
      error: 'Build functionality not yet implemented (M3/M4)',
    }
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
