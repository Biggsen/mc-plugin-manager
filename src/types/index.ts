// Shared type definitions for both main and renderer processes

export type ServerId = string

export type RegionKind = 'system' | 'region' | 'village' | 'heart'

export type DiscoverMethod = 'disabled' | 'on_enter' | 'first_join'

export type RewardRecipeId =
  | 'region'
  | 'heart'
  | 'nether_region'
  | 'nether_heart'
  | 'none'

export interface ServerProfile {
  id: ServerId
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

export interface ImportedSource {
  label: string // "overworld" | "nether"
  originalFilename: string
  importedAtIso: string
  fileHash: string
}

export interface RegionRecord {
  world: 'overworld' | 'nether'
  id: string // canonical id (lowercase, snake_case)
  kind: RegionKind
  discover: {
    method: DiscoverMethod
    recipeId: RewardRecipeId
    commandIdOverride?: string
    displayNameOverride?: string
  }
}

export interface OnboardingConfig {
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

export interface ServerSummary {
  id: string
  name: string
}

export interface ImportResult {
  success: boolean
  regionCount?: number
  error?: string
}

export interface BuildResult {
  success: boolean
  buildId?: string
  error?: string
}

export interface BuildReport {
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
  generated: {
    aa: boolean
    ce: boolean
  }
  warnings: string[]
  errors: string[]
}
