import { contextBridge, ipcRenderer } from 'electron'
import type {
  ServerProfile,
  ServerSummaryWithStats,
  ImportResult,
  BuildResult,
  BuildReport,
  BuildListItem,
  OnboardingConfig,
  RegionRecord,
  DiscordSrvSettings,
  BuildTarget,
  PluginFolderCompareResponse,
  ComparePreset,
  ComparePresetMutationResult,
  ComparePresetDeleteResult,
  DropTablesConfig,
  DropTableCatalogSummary,
} from './types'

// Define the IPC API interface
export interface ElectronAPI {
  // Server profile management
  listServers: () => Promise<ServerSummaryWithStats[]>
  createServer: (name: string, serverName?: string) => Promise<ServerProfile>
  updateServerIdentity: (
    serverId: string,
    partial: { name?: string; serverName?: string }
  ) => Promise<ServerProfile | null>
  getServer: (serverId: string) => Promise<ServerProfile>
  deleteServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
  setDiscordSrvSettings: (
    serverId: string,
    target: BuildTarget,
    partial: DiscordSrvSettings
  ) => Promise<void>
  
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
  scanDropTableCatalogs: () => Promise<{
    catalogs: DropTableCatalogSummary[]
    warnings: string[]
    sourceDir: string
  }>
  updateDropTablesConfig: (
    serverId: string,
    payload: { config: DropTablesConfig }
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
      generateLMCustomDrops?: boolean
      generateMC?: boolean
      generateCW?: boolean
      generateDiscordSRV?: boolean
      generateGriefPrevention?: boolean
      generateWorldGuardRegions?: boolean
      worldGuardRegionsPath?: string
      worldGuardRegionsWorldFolder?: string
      generateWorldGuardRegionsNether?: boolean
      worldGuardRegionsNetherPath?: string
      worldGuardRegionsNetherWorldFolder?: string
      buildTarget?: BuildTarget
      discordSrv?: DiscordSrvSettings
      aaPath?: string
      cePath?: string
      tabPath?: string
      lmPath?: string
      lmCustomDropsPath?: string
      mcPath?: string
      mcTebexSubdomain?: string
      cwPath?: string
      outDir: string
      propagateToPluginFolders?: boolean
      testBuild?: boolean
      buildNote?: string
    }
  ) => Promise<BuildResult>
  showConfigFileDialog: (title: string, defaultPath?: string) => Promise<string | null>
  showOutputDialog: () => Promise<string | null>
  showFolderDialog: (title: string, defaultPath?: string) => Promise<string | null>
  openPathInExplorer: (path: string) => Promise<{ success: boolean; error?: string }>
  comparePluginFolders: (leftRoot: string, rightRoot: string) => Promise<PluginFolderCompareResponse>
  listComparePresets: () => Promise<ComparePreset[]>
  saveComparePreset: (input: {
    name: string
    leftPath: string
    rightPath: string
  }) => Promise<ComparePresetMutationResult>
  updateComparePreset: (input: {
    id: string
    name: string
    leftPath: string
    rightPath: string
  }) => Promise<ComparePresetMutationResult>
  deleteComparePreset: (id: string) => Promise<ComparePresetDeleteResult>
  exportLoreBooks: (
    serverId: string,
    inputs: { outDir: string; author?: string }
  ) => Promise<{ success: boolean; count?: number; error?: string }>
  
  // Build reports
  readBuildReport: (serverId: string, buildId: string) => Promise<BuildReport | null>
  listBuilds: (serverId: string) => Promise<BuildListItem[]>
}

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  listServers: () => ipcRenderer.invoke('list-servers'),
  createServer: (name: string, serverName?: string) =>
    ipcRenderer.invoke('create-server', name, serverName),
  updateServerIdentity: (serverId: string, partial: { name?: string; serverName?: string }) =>
    ipcRenderer.invoke('update-server-identity', serverId, partial),
  getServer: (serverId: string) => ipcRenderer.invoke('get-server', serverId),
  deleteServer: (serverId: string) => ipcRenderer.invoke('delete-server', serverId),
  setDiscordSrvSettings: (serverId: string, target: BuildTarget, partial: DiscordSrvSettings) =>
    ipcRenderer.invoke('set-discordsrv-settings', serverId, target, partial),
  importRegions: (serverId: string, world: 'overworld' | 'nether', filePath: string) =>
    ipcRenderer.invoke('import-regions', serverId, world, filePath),
  importRegionsMeta: (serverId: string, world: 'overworld' | 'nether' | 'end', filePath: string) =>
    ipcRenderer.invoke('import-regions-meta', serverId, world, filePath),
  showImportDialog: () => ipcRenderer.invoke('show-import-dialog'),
  updateOnboarding: (serverId: string, onboarding: OnboardingConfig) =>
    ipcRenderer.invoke('update-onboarding', serverId, onboarding),
  updateRegionLoreBook: (serverId: string, regionId: string, updates: { anchors?: string[]; description?: string }) =>
    ipcRenderer.invoke('update-region-lore-book', serverId, regionId, updates),
  scanDropTableCatalogs: () => ipcRenderer.invoke('scan-drop-table-catalogs'),
  updateDropTablesConfig: (
    serverId: string,
    payload: { config: DropTablesConfig }
  ) => ipcRenderer.invoke('update-drop-tables-config', serverId, payload),
  buildConfigs: (
    serverId: string,
    inputs: {
      generateAA?: boolean
      generateBookGUI?: boolean
      generateCE?: boolean
      generateTAB?: boolean
      generateLM?: boolean
      generateLMCustomDrops?: boolean
      generateMC?: boolean
      generateCW?: boolean
      generateDiscordSRV?: boolean
      generateGriefPrevention?: boolean
      generateWorldGuardRegions?: boolean
      worldGuardRegionsPath?: string
      worldGuardRegionsWorldFolder?: string
      generateWorldGuardRegionsNether?: boolean
      worldGuardRegionsNetherPath?: string
      worldGuardRegionsNetherWorldFolder?: string
      buildTarget?: BuildTarget
      discordSrv?: DiscordSrvSettings
      aaPath?: string
      cePath?: string
      tabPath?: string
      lmPath?: string
      lmCustomDropsPath?: string
      mcPath?: string
      mcTebexSubdomain?: string
      cwPath?: string
      outDir: string
      propagateToPluginFolders?: boolean
      testBuild?: boolean
      buildNote?: string
    }
  ) => ipcRenderer.invoke('build-configs', serverId, inputs),
  showConfigFileDialog: (title: string, defaultPath?: string) =>
    ipcRenderer.invoke('show-config-file-dialog', title, defaultPath),
  showOutputDialog: () => ipcRenderer.invoke('show-output-dialog'),
  showFolderDialog: (title: string, defaultPath?: string) =>
    ipcRenderer.invoke('show-folder-dialog', title, defaultPath),
  openPathInExplorer: (path: string) => ipcRenderer.invoke('open-path-in-explorer', path),
  comparePluginFolders: (leftRoot: string, rightRoot: string) =>
    ipcRenderer.invoke('compare-plugin-folders', leftRoot, rightRoot),
  listComparePresets: () => ipcRenderer.invoke('list-compare-presets'),
  saveComparePreset: (input: { name: string; leftPath: string; rightPath: string }) =>
    ipcRenderer.invoke('save-compare-preset', input),
  updateComparePreset: (input: { id: string; name: string; leftPath: string; rightPath: string }) =>
    ipcRenderer.invoke('update-compare-preset', input),
  deleteComparePreset: (id: string) => ipcRenderer.invoke('delete-compare-preset', id),
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
