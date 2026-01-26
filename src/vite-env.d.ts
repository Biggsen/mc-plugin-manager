/// <reference types="vite/client" />

// Extend Window interface for electronAPI
interface ElectronAPI {
  listServers: () => Promise<ServerSummary[]>
  createServer: (name: string) => Promise<ServerProfile>
  getServer: (serverId: string) => Promise<ServerProfile | null>
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
  buildConfigs: (
    serverId: string,
    inputs: { cePath: string; aaPath: string; tabPath: string; lmPath: string; outDir: string }
  ) => Promise<BuildResult>
  showConfigFileDialog: (title: string, defaultPath?: string) => Promise<string | null>
  showOutputDialog: () => Promise<string | null>
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
