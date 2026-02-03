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
  | 'village'

export interface ServerProfile {
  id: ServerId
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

export interface ImportedSource {
  label: string // "overworld" | "nether" | "end"
  originalFilename: string
  importedAtIso: string
  fileHash: string
  spawnCenter?: {
    world: string
    x: number
    z: number
  }
}

export interface RegionRecord {
  world: 'overworld' | 'nether' | 'end'
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
    y?: number
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
  configSources?: {
    aa?: { path: string; isDefault: boolean }
    ce?: { path: string; isDefault: boolean }
    tab?: { path: string; isDefault: boolean }
    lm?: { path: string; isDefault: boolean }
    mc?: { path: string; isDefault: boolean }
    cw?: { path: string; isDefault: boolean }
  }
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
