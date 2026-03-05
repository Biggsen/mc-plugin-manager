/// <reference types="vite/client" />

// Extend Window interface for electronAPI
interface ElectronAPI {
  listServers: () => Promise<ServerSummary[]>
  createServer: (name: string) => Promise<ServerProfile>
  getServer: (serverId: string) => Promise<ServerProfile | null>
  setMyCommandDiscordInvite: (serverId: string, value: string) => Promise<void>
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
      propagateToPluginFolders?: boolean
      myCommandDiscordInvite?: string
    }
  ) => Promise<BuildResult>
  showConfigFileDialog: (title: string, defaultPath?: string) => Promise<string | null>
  showOutputDialog: () => Promise<string | null>
  exportLoreBooks: (
    serverId: string,
    inputs: { outDir: string; author?: string }
  ) => Promise<{ success: boolean; count?: number; error?: string }>
  readBuildReport: (serverId: string, buildId: string) => Promise<BuildReport | null>
  listBuilds: (serverId: string) => Promise<string[]>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// Re-export types for use in renderer
import type {
  ServerSummary,
  ServerProfile,
  ImportResult,
  BuildResult,
  BuildReport,
  OnboardingConfig,
} from './types'

export {}
