import { contextBridge, ipcRenderer } from 'electron'

// Define the IPC API interface
export interface ElectronAPI {
  // Server profile management
  listServers: () => Promise<ServerSummary[]>
  createServer: (name: string) => Promise<ServerProfile>
  getServer: (serverId: string) => Promise<ServerProfile>
  
  // Region import
  importRegions: (
    serverId: string,
    world: 'overworld' | 'nether',
    filePath: string
  ) => Promise<ImportResult>
  showImportDialog: () => Promise<string | null>
  
  // Onboarding
  updateOnboarding: (
    serverId: string,
    onboarding: OnboardingConfig
  ) => Promise<ServerProfile>
  
  // Build
  buildConfigs: (
    serverId: string,
    inputs: { cePath: string; aaPath: string; outDir: string }
  ) => Promise<BuildResult>
  
  // Build reports
  readBuildReport: (serverId: string, buildId: string) => Promise<BuildReport>
}

// Type definitions (will be imported from shared types later)
interface ServerSummary {
  id: string
  name: string
}

interface ServerProfile {
  id: string
  name: string
  sources: {
    overworld?: ImportedSource
    nether?: ImportedSource
  }
  regions: RegionRecord[]
  onboarding: OnboardingConfig
  build: {
    lastBuildId?: string
    outputDirectory?: string
  }
}

interface ImportedSource {
  label: string
  originalFilename: string
  importedAtIso: string
  fileHash: string
}

interface RegionRecord {
  world: 'overworld' | 'nether'
  id: string
  kind: 'system' | 'region' | 'village' | 'heart'
  discover: {
    method: 'disabled' | 'on_enter' | 'first_join'
    recipeId: 'region' | 'heart' | 'nether_region' | 'nether_heart' | 'none'
    commandIdOverride?: string
    displayNameOverride?: string
  }
}

interface OnboardingConfig {
  startRegionId: string
  teleport: {
    world: string
    x: number
    y: number
    z: number
    yaw?: number
    pitch?: number
  }
}

interface ImportResult {
  success: boolean
  regionCount?: number
  error?: string
}

interface BuildResult {
  success: boolean
  buildId?: string
  error?: string
}

interface BuildReport {
  buildId: string
  timestamp: string
  regionCounts: {
    overworld: number
    nether: number
    hearts: number
  }
  warnings: string[]
  errors: string[]
}

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  listServers: () => ipcRenderer.invoke('list-servers'),
  createServer: (name: string) => ipcRenderer.invoke('create-server', name),
  getServer: (serverId: string) => ipcRenderer.invoke('get-server', serverId),
  importRegions: (serverId: string, world: 'overworld' | 'nether', filePath: string) =>
    ipcRenderer.invoke('import-regions', serverId, world, filePath),
  showImportDialog: () => ipcRenderer.invoke('show-import-dialog'),
  updateOnboarding: (serverId: string, onboarding: OnboardingConfig) =>
    ipcRenderer.invoke('update-onboarding', serverId, onboarding),
  buildConfigs: (serverId: string, inputs: { cePath: string; aaPath: string; outDir: string }) =>
    ipcRenderer.invoke('build-configs', serverId, inputs),
  readBuildReport: (serverId: string, buildId: string) =>
    ipcRenderer.invoke('read-build-report', serverId, buildId),
} as ElectronAPI)

// Extend Window interface for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
