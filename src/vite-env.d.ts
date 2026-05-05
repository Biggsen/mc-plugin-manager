/// <reference types="vite/client" />

// Extend Window interface for electronAPI
interface ElectronAPI {
  listServers: () => Promise<ServerSummaryWithStats[]>
  createServer: (name: string, serverName?: string) => Promise<ServerProfile>
  updateServerIdentity: (
    serverId: string,
    partial: { name?: string; serverName?: string }
  ) => Promise<ServerProfile | null>
  getServer: (serverId: string) => Promise<ServerProfile | null>
  deleteServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
  setDiscordSrvSettings: (
    serverId: string,
    target: import('./types').BuildTarget,
    partial: import('./types').DiscordSrvSettings
  ) => Promise<void>
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
  updateOnboarding: (
    serverId: string,
    onboarding: OnboardingConfig
  ) => Promise<ServerProfile | null>
  updateRegionLoreBook: (
    serverId: string,
    regionId: string,
    updates: { anchors?: string[]; description?: string }
  ) => Promise<ServerProfile | null>
  scanItemIndex: () => Promise<{
    items: import('./types').ItemIndexEntry[]
    warnings: string[]
    sourcePath: string
  }>
  listDropTableLibrary: () => Promise<import('./types').DropTableLibraryEntry[]>
  createDropTable: (input?: { name?: string; description?: string }) => Promise<import('./types').DropTableLibraryEntry>
  updateDropTable: (input: {
    id: string
    name?: string
    description?: string
    selectedItems?: string[]
    itemOverrides?: Record<string, import('./types').DropTableItemOverride>
  }) => Promise<import('./types').DropTableLibraryEntry>
  deleteDropTable: (id: string) => Promise<import('./types').DropTableLibraryDeleteResult>
  updateServerDropTables: (
    serverId: string,
    payload: { libraryTableIds: string[] }
  ) => Promise<ServerProfile | null>
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
      buildTarget?: import('./types').BuildTarget
      discordSrv?: import('./types').DiscordSrvSettings
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
  comparePluginFolders: (
    leftRoot: string,
    rightRoot: string
  ) => Promise<import('./types').PluginFolderCompareResponse>
  listComparePresets: () => Promise<import('./types').ComparePreset[]>
  saveComparePreset: (input: {
    name: string
    leftPath: string
    rightPath: string
  }) => Promise<import('./types').ComparePresetMutationResult>
  updateComparePreset: (input: {
    id: string
    name: string
    leftPath: string
    rightPath: string
  }) => Promise<import('./types').ComparePresetMutationResult>
  deleteComparePreset: (id: string) => Promise<import('./types').ComparePresetDeleteResult>
  exportLoreBooks: (
    serverId: string,
    inputs: { outDir: string; author?: string }
  ) => Promise<{ success: boolean; count?: number; error?: string }>
  readBuildReport: (serverId: string, buildId: string) => Promise<BuildReport | null>
  listBuilds: (serverId: string) => Promise<import('./types').BuildListItem[]>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// Re-export types for use in renderer
import type {
  ServerSummary,
  ServerSummaryWithStats,
  ServerProfile,
  ImportResult,
  BuildResult,
  BuildReport,
  OnboardingConfig,
} from './types'

export {}
