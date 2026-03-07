import { contextBridge, ipcRenderer } from 'electron'
import type {
  ServerProfile,
  ServerSummaryWithStats,
  ImportResult,
  BuildResult,
  BuildReport,
  OnboardingConfig,
  RegionRecord,
} from './types'

// Define the IPC API interface
export interface ElectronAPI {
  // Server profile management
  listServers: () => Promise<ServerSummaryWithStats[]>
  createServer: (name: string) => Promise<ServerProfile>
  getServer: (serverId: string) => Promise<ServerProfile>
  deleteServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
  setMyCommandDiscordInvite: (serverId: string, value: string) => Promise<void>
  
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
  updateRegionLoreBook: (
    serverId: string,
    regionId: string,
    updates: { anchors?: string[]; description?: string }
  ) => Promise<ServerProfile | null>
  
  // Build
  buildConfigs: (
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
    }
  ) => Promise<BuildResult>
  showConfigFileDialog: (title: string, defaultPath?: string) => Promise<string | null>
  showOutputDialog: () => Promise<string | null>
  exportLoreBooks: (
    serverId: string,
    inputs: { outDir: string; author?: string }
  ) => Promise<{ success: boolean; count?: number; error?: string }>
  
  // Build reports
  readBuildReport: (serverId: string, buildId: string) => Promise<BuildReport | null>
  listBuilds: (serverId: string) => Promise<string[]>
}

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  listServers: () => ipcRenderer.invoke('list-servers'),
  createServer: (name: string) => ipcRenderer.invoke('create-server', name),
  getServer: (serverId: string) => ipcRenderer.invoke('get-server', serverId),
  deleteServer: (serverId: string) => ipcRenderer.invoke('delete-server', serverId),
  setMyCommandDiscordInvite: (serverId: string, value: string) =>
    ipcRenderer.invoke('set-mycommand-discord-invite', serverId, value),
  importRegions: (serverId: string, world: 'overworld' | 'nether', filePath: string) =>
    ipcRenderer.invoke('import-regions', serverId, world, filePath),
  importRegionsMeta: (serverId: string, world: 'overworld' | 'nether' | 'end', filePath: string) =>
    ipcRenderer.invoke('import-regions-meta', serverId, world, filePath),
  showImportDialog: () => ipcRenderer.invoke('show-import-dialog'),
  updateOnboarding: (serverId: string, onboarding: OnboardingConfig) =>
    ipcRenderer.invoke('update-onboarding', serverId, onboarding),
  updateRegionLoreBook: (serverId: string, regionId: string, updates: { anchors?: string[]; description?: string }) =>
    ipcRenderer.invoke('update-region-lore-book', serverId, regionId, updates),
  buildConfigs: (
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
  ) => ipcRenderer.invoke('build-configs', serverId, inputs),
  showConfigFileDialog: (title: string, defaultPath?: string) =>
    ipcRenderer.invoke('show-config-file-dialog', title, defaultPath),
  showOutputDialog: () => ipcRenderer.invoke('show-output-dialog'),
  exportLoreBooks: (serverId: string, inputs: { outDir: string; author?: string }) =>
    ipcRenderer.invoke('export-lore-books', serverId, inputs),
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
