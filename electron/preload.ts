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
  importRegionsMeta: (
    serverId: string,
    world: 'overworld' | 'nether' | 'end',
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
  ) => Promise<BuildResult>
  showConfigFileDialog: (title: string, defaultPath?: string) => Promise<string | null>
  showOutputDialog: () => Promise<string | null>
  
  // Build reports
  readBuildReport: (serverId: string, buildId: string) => Promise<BuildReport | null>
  listBuilds: (serverId: string) => Promise<string[]>
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
    world?: ImportedSource
    end?: ImportedSource
  }
  regions: RegionRecord[]
  onboarding: OnboardingConfig
  spawnCenter?: {
    world: string
    x: number
    z: number
  }
  regionsMeta?: {
    levelledMobs?: {
      villageBandStrategy?: string
      regionBands?: Record<string, string>
    }
  }
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
  spawnCenter?: {
    world: string
    x: number
    z: number
  }
}

interface RegionRecord {
  world: 'overworld' | 'nether' | 'end'
  id: string
  kind: 'system' | 'region' | 'village' | 'heart'
  discover: {
    method: 'disabled' | 'on_enter' | 'first_join'
    recipeId: 'region' | 'heart' | 'nether_region' | 'nether_heart' | 'none' | 'village'
    commandIdOverride?: string
    displayNameOverride?: string
  }
  biomes?: Array<{ biome: string; percentage: number }>
  category?: string
  items?: Array<{ id: string; name: string }>
  theme?: Array<{ a: string; b: string }>
  description?: string
}

interface OnboardingConfig {
  startRegionId: string
  teleport: {
    world: string
    x: number
    y?: number
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
  configSources?: {
    aa?: { path: string; isDefault: boolean }
    ce?: { path: string; isDefault: boolean }
    tab?: { path: string; isDefault: boolean }
    lm?: { path: string; isDefault: boolean }
    mc?: { path: string; isDefault: boolean }
    cw?: { path: string; isDefault: boolean }
  }
}

interface BuildReport {
  buildId: string
  timestamp: string
  regionCounts: {
    overworld: number
    nether: number
    hearts: number
    villages: number
    regions: number
    system: number
  }
  computedCounts?: {
    overworldRegions: number
    overworldHearts: number
    netherRegions: number
    netherHearts: number
    villages: number
    total: number
  }
  generated: {
    aa: boolean
    ce: boolean
    tab: boolean
    lm: boolean
    mc: boolean
    cw: boolean
  }
  configSources?: {
    aa?: { path: string; isDefault: boolean }
    ce?: { path: string; isDefault: boolean }
    tab?: { path: string; isDefault: boolean }
    lm?: { path: string; isDefault: boolean }
    mc?: { path: string; isDefault: boolean }
    cw?: { path: string; isDefault: boolean }
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
  importRegionsMeta: (serverId: string, world: 'overworld' | 'nether' | 'end', filePath: string) =>
    ipcRenderer.invoke('import-regions-meta', serverId, world, filePath),
  showImportDialog: () => ipcRenderer.invoke('show-import-dialog'),
  updateOnboarding: (serverId: string, onboarding: OnboardingConfig) =>
    ipcRenderer.invoke('update-onboarding', serverId, onboarding),
  buildConfigs: (
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
  ) => ipcRenderer.invoke('build-configs', serverId, inputs),
  showConfigFileDialog: (title: string, defaultPath?: string) =>
    ipcRenderer.invoke('show-config-file-dialog', title, defaultPath),
  showOutputDialog: () => ipcRenderer.invoke('show-output-dialog'),
  readBuildReport: (serverId: string, buildId: string) =>
    ipcRenderer.invoke('read-build-report', serverId, buildId),
  listBuilds: (serverId: string) => ipcRenderer.invoke('list-builds', serverId),
} as ElectronAPI)

// Extend Window interface for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
