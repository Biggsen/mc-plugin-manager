// Shared type definitions for both main and renderer processes

export type ServerId = string

export type PluginType = 'aa' | 'ce' | 'tab' | 'lm' | 'lmcd' | 'mc' | 'cw'

export const PLUGIN_TYPES: PluginType[] = ['aa', 'ce', 'tab', 'lm', 'lmcd', 'mc', 'cw']

export type RegionKind = 'system' | 'region' | 'village' | 'heart' | 'structure' | 'water'

export type DiscoverMethod = 'disabled' | 'on_enter' | 'first_join' | 'passive'

export type RewardRecipeId =
  | 'region'
  | 'heart'
  | 'nether_region'
  | 'nether_heart'
  | 'end_region'
  | 'end_heart'
  | 'none'
  | 'village'

/** Keys stored in `generatorVersions` (plugin YAML emit serial). */
export type GeneratorVersionKey =
  | PluginType
  | 'essentials'
  | 'discordsrv'
  | 'bookgui'
  | 'griefprevention'
  | 'worldguardregions'
  | 'worldguardregionsnether'

export type BuildTarget = 'next' | 'live'

export interface ServerProfile {
  id: ServerId
  /** Display name in this app (e.g. live vs next). */
  name: string
  /**
   * String used in generated plugin configs (`{SERVER_NAME}`, TAB header, etc.).
   * When omitted or empty, `name` is used.
   */
  serverName?: string
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
    y?: number
    z: number
  }
  regionsMeta?: {
    levelledMobs?: {
      villageBandStrategy?: string
      regionBands?: Record<string, string>
    }
    /** Merged from regions-meta root `structureFamilies`. Keys = structureType. */
    structureFamilies?: Record<string, { label: string; counter: string }>
  }
  build: {
    lastBuildId?: string
    buildTarget?: BuildTarget
    outputDirectory?: string
    loreBooksOutputDirectory?: string
    propagateToPluginFolders?: boolean
    /** Last selected Region Forge / WorldGuard regions.yml source for builds. */
    worldGuardRegionsSourcePath?: string
    /**
     * WorldGuard world folder name under plugins/WorldGuard/worlds/ (e.g. `world`).
     * Used when "propagate to plugin folders" is on.
     */
    worldGuardRegionsWorldFolder?: string
    /** Nether WorldGuard regions.yml source (Region Forge export for nether world). */
    worldGuardRegionsNetherSourcePath?: string
    /** Nether world folder under WorldGuard/worlds/ (e.g. `world_nether`). */
    worldGuardRegionsNetherWorldFolder?: string
    /** MyCommand Tebex store subdomain (left side of `.tebex.io`). */
    mcTebexSubdomain?: string
  }
  /** Which global drop-table library entries apply to this server (by library entry id). */
  dropTables?: DropTablesServerAssignment
  /** Per-plugin successful emit serial (1-based), keyed by plugin id. */
  generatorVersions?: Partial<Record<GeneratorVersionKey, number>>
  /** DiscordSRV build inputs (legacy single-target shape). */
  discordSrv?: DiscordSrvSettings
  /** DiscordSRV build inputs keyed by build target. */
  discordSrvByTarget?: Partial<Record<BuildTarget, DiscordSrvSettings>>
}

export interface DiscordSrvSettings {
  botToken?: string
  globalChannelId?: string
  statusChannelId?: string
  consoleChannelId?: string
  discordInviteUrl?: string
}

export interface ImportedSource {
  label: string // "overworld" | "nether" | "end"
  originalFilename: string
  importedAtIso: string
  fileHash: string
  spawnCenter?: {
    world: string
    x: number
    y?: number
    z: number
  }
}

export interface RegionRecord {
  world: 'overworld' | 'nether' | 'end'
  id: string // canonical id (lowercase, snake_case)
  kind: RegionKind
  /** When `kind` is `structure`, which POI family (matches regions-meta `structureFamilies`). */
  structureType?: string
  discover: {
    method: DiscoverMethod
    recipeId: RewardRecipeId
    commandIdOverride?: string
    displayNameOverride?: string
  }
  /** Biome breakdown from map scan. For kind: region and kind: water when a biome map is available. */
  biomes?: Array<{ biome: string; percentage: number }>
  /** Minecraft item category (e.g. ores, stone, wood). VZ price guide. */
  category?: string
  /** Up to 3 items for economy/discovery rewards. VZ price guide. */
  items?: Array<{ id: string; name: string }>
  /** Up to 3 theme pairs (A + B) from Storyteller's Automaton. */
  theme?: Array<{ a: string; b: string }>
  /** Free-form description for display, quest hooks, discovery. */
  description?: string
  /** Lore book page break anchors: phrases (text before each break). Stored separately from imports; survives re-import when anchors still match. */
  loreBookAnchors?: string[]
  /** Lore book description override: editable text for lore books. When set, used instead of description for export. Cleared on re-import. */
  loreBookDescription?: string
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

export interface ServerSummaryWithStats {
  id: string
  name: string
  regionCount: number
  villageCount: number
  heartCount: number
  netherRegionCount: number
  netherHeartCount: number
  structureCount: number
  lastImportIso: string | null
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
    bookgui?: { path: string; isDefault: boolean }
    ce?: { path: string; isDefault: boolean }
    tab?: { path: string; isDefault: boolean }
    lm?: { path: string; isDefault: boolean }
    lmcd?: { path: string; isDefault: boolean }
    mc?: { path: string; isDefault: boolean }
    cw?: { path: string; isDefault: boolean }
    essentials?: { path: string; isDefault: boolean }
    discordsrv?: { path: string; isDefault: boolean }
    griefprevention?: { path: string; isDefault: boolean }
    worldguardregions?: { path: string; isDefault: boolean }
    worldguardregionsnether?: { path: string; isDefault: boolean }
  }
}

export interface BuildReport {
  buildId: string
  timestamp: string
  buildTarget?: BuildTarget
  regionCounts: {
    overworld: number
    nether: number
    hearts: number
    villages: number
    regions: number
    system: number
    structures: number
    water: number
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
    bookgui: boolean
    ce: boolean
    tab: boolean
    lm: boolean
    lmcd?: boolean
    mc: boolean
    cw: boolean
    essentials?: boolean
    /** Present from builds that include DiscordSRV support; treat absent as false. */
    discordsrv?: boolean
    /** Bundled GriefPreventionData/config.yml copy; treat absent as false. */
    griefprevention?: boolean
    /** WorldGuard regions.yml from user-provided source (e.g. Region Forge). */
    worldguardregions?: boolean
    worldguardregionsnether?: boolean
  }
  configSources?: {
    aa?: { path: string; isDefault: boolean }
    bookgui?: { path: string; isDefault: boolean }
    ce?: { path: string; isDefault: boolean }
    tab?: { path: string; isDefault: boolean }
    lm?: { path: string; isDefault: boolean }
    lmcd?: { path: string; isDefault: boolean }
    mc?: { path: string; isDefault: boolean }
    cw?: { path: string; isDefault: boolean }
    essentials?: { path: string; isDefault: boolean }
    discordsrv?: { path: string; isDefault: boolean }
    griefprevention?: { path: string; isDefault: boolean }
    worldguardregions?: { path: string; isDefault: boolean }
    worldguardregionsnether?: { path: string; isDefault: boolean }
  }
  warnings: string[]
  errors: string[]
  /** Counter values persisted on the profile after this build (plugins that were emitted). */
  generatorVersionsSnapshot?: Partial<Record<GeneratorVersionKey, number>>
  /** Short note; required for normal builds, optional for test builds. */
  buildNote?: string
  /** When true, generator versions were not bumped (test / iterative emit). */
  testBuild?: boolean
}

export interface DropTableItemOverride {
  chance?: number
  amount?: string
  minLevel?: number
  maxLevel?: number
}

export interface DropTableSelectedEntry {
  /** Stable row id so duplicate item selections can coexist. */
  entryId: string
  itemId: string
  override?: DropTableItemOverride
}

/** Per-server: references into the global drop table library. */
export interface DropTablesServerAssignment {
  libraryTableIds: string[]
}

/** One row in the global library (editable in Drop Table Library screen). */
export interface DropTableLibraryEntry {
  id: string
  /** LevelledMobs `drop-table` key in customdrops.yml (unique in library). */
  name: string
  description?: string
  /** Preferred v2 shape: ordered per-instance entries; supports duplicate item ids. */
  selectedEntries?: DropTableSelectedEntry[]
  /** Legacy shape retained for compatibility/migration. */
  selectedItems: string[]
  /** Legacy shape retained for compatibility/migration. */
  itemOverrides?: Record<string, DropTableItemOverride>
  createdAt: string
  updatedAt: string
}

/** Bundled `all.json` row for search / economy (normalized item id). */
export interface ItemIndexEntry {
  id: string
  rawKey: string
  name: string
  category?: string
  stack?: number | string
  unitBuy?: number
}

/** Resolved for LM / LMCD emit (main process build). */
export interface ResolvedDropTable {
  tableName: string
  libraryEntryId: string
  selectedEntries?: DropTableSelectedEntry[]
  selectedItems: string[]
  itemOverrides?: Record<string, DropTableItemOverride>
  itemValues: Record<string, number | undefined>
}

export interface DropTableLibraryDeleteResult {
  ok: boolean
  error?: string
  /** Servers that had this table id removed from their assignment lists. */
  removedFromServers?: { id: string; name: string }[]
}

/** Row for build history list (from saved report.json). */
export interface BuildListItem {
  buildId: string
  testBuild?: boolean
  buildNote?: string
}

/** Single PM-generated path when comparing two plugin folder trees. */
export type PluginFolderCompareStatus =
  | 'identical'
  | 'different'
  | 'missing_left'
  | 'missing_right'
  | 'missing_both'
  | 'read_error'

export interface PluginFolderCompareFileResult {
  id: string
  label: string
  relativePath: string
  status: PluginFolderCompareStatus
  /** Unified diff when status is `different` */
  unifiedDiff?: string
  error?: string
}

export interface PluginFolderCompareResult {
  leftRoot: string
  rightRoot: string
  /** Set when bundled guide books could not be listed — BookGUI rows are omitted. */
  bookGuiWarning?: string
  files: PluginFolderCompareFileResult[]
  summary: {
    identical: number
    different: number
    missingLeft: number
    missingRight: number
    missingBoth: number
    readErrors: number
  }
}

export type PluginFolderCompareResponse =
  | { ok: true; result: PluginFolderCompareResult }
  | { ok: false; error: string }

/** Saved left/right plugins roots for the folder compare tool. */
export interface ComparePreset {
  id: string
  name: string
  leftPath: string
  rightPath: string
  updatedAt: string
}

export type ComparePresetMutationResult =
  | { ok: true; preset: ComparePreset }
  | { ok: false; error: string }

export type ComparePresetDeleteResult = { ok: true } | { ok: false; error: string }
