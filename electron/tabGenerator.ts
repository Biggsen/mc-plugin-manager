const yaml = require('yaml')

import type { RegionRecord } from './types'
import { computeRegionCounts } from './utils/regionStats'
import type { RegionCounts } from './utils/regionStats'

export { computeRegionCounts }

const DIFFICULTIES = ['easy', 'normal', 'hard', 'severe', 'deadly'] as const
type Difficulty = (typeof DIFFICULTIES)[number]

const DIFFICULTY_COLOURS: Record<Difficulty, string> = {
  easy: '&a',
  normal: '&e',
  hard: '&6',
  severe: '&c',
  deadly: '&4',
}

export type StructureFamiliesMap = Record<string, { label: string; counter: string }>

function isActiveStructurePoi(r: RegionRecord, structureFamilies?: StructureFamiliesMap): boolean {
  return (
    r.kind === 'structure' &&
    r.discover.method !== 'disabled' &&
    Boolean(r.structureType && structureFamilies?.[r.structureType]?.counter)
  )
}

/** N(T) globally: all worlds, method !== disabled */
function structureTypeGlobalCount(regions: RegionRecord[], structureType: string): number {
  return regions.filter(
    (r) =>
      r.kind === 'structure' &&
      r.discover.method !== 'disabled' &&
      r.structureType === structureType
  ).length
}

/**
 * Overworld structure families with at least one POI in overworld (for TAB rows).
 * Sorted by structureType ascending.
 */
function overworldStructureTabRows(
  regions: RegionRecord[],
  structureFamilies?: StructureFamiliesMap
): Array<{ structureType: string; label: string; counter: string; nGlobal: number }> {
  if (!structureFamilies) return []
  const typesInOverworld = new Set<string>()
  for (const r of regions) {
    if (r.world !== 'overworld' || !isActiveStructurePoi(r, structureFamilies)) continue
    typesInOverworld.add(r.structureType!)
  }
  const rows: Array<{ structureType: string; label: string; counter: string; nGlobal: number }> = []
  for (const structureType of [...typesInOverworld].sort((a, b) => a.localeCompare(b))) {
    const fam = structureFamilies[structureType]
    if (!fam?.label || !fam.counter) continue
    rows.push({
      structureType,
      label: fam.label,
      counter: fam.counter,
      nGlobal: structureTypeGlobalCount(regions, structureType),
    })
  }
  return rows
}

function overworldStructureRegionIds(
  regions: RegionRecord[],
  structureFamilies?: StructureFamiliesMap
): string[] {
  return regions
    .filter((r) => r.world === 'overworld' && isActiveStructurePoi(r, structureFamilies))
    .map((r) => r.id)
    .sort((a, b) => a.localeCompare(b))
}

function generateStructureNameCondition(sortedIds: string[]): Record<string, unknown> {
  return {
    conditions: sortedIds.map((id) => `%worldguard_region_name_1%=${id}`),
    type: 'OR',
    true: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%',
    false: '-',
  }
}

const VILLAGE_NAME_WITH_STRUCTURE_GUARD: Record<string, unknown> = {
  conditions: [
    '%worldguard_region_name_2%!=',
    '%worldguard_region_name_1%!=%worldguard_region_name_2%',
    '%worldguard_region_name_1%!=spawn',
    '%condition:structure-name%=-',
  ],
  type: 'AND',
  true: '%condition:heart-region%',
  false: '-',
}

/**
 * Build map of difficulty -> list of main region IDs (overworld + nether only).
 * Only includes regions with kind === 'region' that appear in regionBands.
 */
function buildDifficultyRegionIds(
  regions: RegionRecord[],
  regionBands: Record<string, string> | undefined
): Record<Difficulty, string[]> {
  const result: Record<Difficulty, string[]> = {
    easy: [],
    normal: [],
    hard: [],
    severe: [],
    deadly: [],
  }
  if (!regionBands || Object.keys(regionBands).length === 0) {
    return result
  }
  const mainRegionIds = new Set(
    regions
      .filter((r) => r.kind === 'region' && (r.world === 'overworld' || r.world === 'nether'))
      .map((r) => r.id)
  )
  for (const [regionId, difficulty] of Object.entries(regionBands)) {
    const d = difficulty.toLowerCase() as Difficulty
    if (DIFFICULTIES.includes(d) && mainRegionIds.has(regionId)) {
      result[d].push(regionId)
    }
  }
  return result
}

/**
 * Generate TAB conditions for region name by difficulty (colour-coded).
 * Only main regions (no villages/hearts) from regionBands.
 */
function generateRegionNameDifficultyConditions(
  regions: RegionRecord[],
  regionBands: Record<string, string> | undefined
): Record<string, any> {
  const byDifficulty = buildDifficultyRegionIds(regions, regionBands)
  const conditions: Record<string, any> = {}
  for (const difficulty of DIFFICULTIES) {
    const ids = byDifficulty[difficulty]
    const condList: string[] = []
    for (const id of ids) {
      condList.push(`%worldguard_region_name_2%=${id}`)
      condList.push(`%worldguard_region_name_1%=${id}`)
    }
    conditions[`region-name-${difficulty}`] = {
      conditions: condList.length > 0 ? condList : ['%worldguard_region_name_1%=__none__'],
      type: 'OR',
      true: `${DIFFICULTY_COLOURS[difficulty]}%condition:region-name%`,
      false: '',
    }
  }
  return conditions
}

/**
 * Placeholder line for "Current" region when difficulty conditions are used (concatenation).
 */
const REGION_CURRENT_LINE_WITH_DIFFICULTY =
  '&eCurrent&7:||%condition:region-name-easy%%condition:region-name-normal%%condition:region-name-hard%%condition:region-name-severe%%condition:region-name-deadly%'

/**
 * Generate header section with server name
 */
function generateHeader(serverName: string): string[] {
  return [
    '<#FFFFFF>&m                                                </#FFFF00>',
    `&3&l${serverName}`,
    '&r&7&l>> %animation:Welcome%&3 &l%player%&7&l! &7&l<<',
    '&r&7Online players: &f%online%',
    '',
  ]
}

/**
 * Generate footer section with top explorers.
 * Discord hint line matches CommandWhitelist: only when DiscordSRV invite URL is set.
 */
function generateFooter(discordInvite: string = ''): string[] {
  const hasInvite = Boolean(discordInvite && String(discordInvite).trim())
  return [
    '',
    '&d%condition:top-explorers-title%',
    '&b%condition:top-explorer-1%',
    '&b%condition:top-explorer-2%',
    '&b%condition:top-explorer-3%',
    '&b%condition:top-explorer-4%',
    '&b%condition:top-explorer-5%',
    '',
    ...(hasInvite ? ['&bDiscord: &7/discord'] : []),
    '<#FFFFFF>&m                                                </#FFFF00>',
  ]
}

/**
 * Generate overworld scoreboard section
 */
function generateOverworldScoreboard(
  serverName: string,
  counts: RegionCounts,
  useDifficultyColour: boolean
): any {
  const currentRegionLine = useDifficultyColour
    ? REGION_CURRENT_LINE_WITH_DIFFICULTY
    : '&eCurrent&7:||%condition:region-name%'
  return {
    title: `<#E0B11E>${serverName}</#FF0000>`,
    'display-condition': '%player-version-id%>=765;%bedrock%=false;%world%=world',
    lines: [
      '%animation:MyAnimation1%',
      '&bRegions',
      currentRegionLine,
      `&eDiscovered&7:||%aach_custom_regions_discovered%/${counts.overworldRegions}`,
      '',
      '&bVillages',
      '&eCurrent&7:||%condition:village-name%',
      `&eDiscovered&7:||%aach_custom_villages_discovered%/${counts.villages}`,
      '',
      '&bRegion Hearts',
      `&eDiscovered&7:||%aach_custom_hearts_discovered%/${counts.overworldHearts}`,
      '%animation:MyAnimation1%',
      '&2🧭 %player_direction%||&7%player_x% %player_y% %player_z%',
    ],
  }
}

function generateStructuresOverworldScoreboard(
  serverName: string,
  structureLines: string[]
): any {
  return {
    title: `<#E0B11E>${serverName}</#FF0000>`,
    'display-condition': '%player-version-id%>=765;%bedrock%=false;%world%=world',
    lines: [
      '%animation:MyAnimation1%',
      '&bStructures',
      ...structureLines,
      '%animation:MyAnimation1%',
      '&2🧭 %player_direction%||&7%player_x% %player_y% %player_z%',
    ],
  }
}

/**
 * Generate nether scoreboard section
 */
function generateNetherScoreboard(
  serverName: string,
  counts: RegionCounts,
  useDifficultyColour: boolean
): any {
  const currentRegionLine = useDifficultyColour
    ? REGION_CURRENT_LINE_WITH_DIFFICULTY
    : '&eCurrent&7:||%condition:region-name%'
  return {
    title: `<#E0B11E>${serverName}</#FF0000>`,
    'display-condition': '%player-version-id%>=765;%bedrock%=false;%world%=world_nether',
    lines: [
      '%animation:MyAnimation1%',
      '&bNether Regions',
      currentRegionLine,
      `&eDiscovered&7:||%aach_custom_nether_regions_discovered%/${counts.netherRegions}`,
      '',
      '&bNether Region Hearts',
      `&eDiscovered&7:||%aach_custom_nether_hearts_discovered%/${counts.netherHearts}`,
      '%animation:MyAnimation1%',
      '&2🧭 %player_direction%||&7%player_x% %player_y% %player_z%',
    ],
  }
}

/**
 * Generate top explorers conditions
 */
function generateTopExplorersConditions(totalCount: number): Record<string, any> {
  const conditions: Record<string, any> = {
    'top-explorers-title': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_1_alltime_name%!="],
      true: 'TOP EXPLORERS',
      false: '',
    },
    'top-explorer-1': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_1_alltime_name%!="],
      true: `1. %ajlb_lb_aach_custom_total_discovered_1_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_1_alltime_value}/${totalCount}*100,0)%%`,
      false: '',
    },
    'top-explorer-2': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_2_alltime_name%!=---"],
      true: `2. %ajlb_lb_aach_custom_total_discovered_2_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_2_alltime_value}/${totalCount}*100,0)%%`,
      false: '',
    },
    'top-explorer-3': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_3_alltime_name%!=---"],
      true: `3. %ajlb_lb_aach_custom_total_discovered_3_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_3_alltime_value}/${totalCount}*100,0)%%`,
      false: '',
    },
    'top-explorer-4': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_4_alltime_name%!=---"],
      true: `4. %ajlb_lb_aach_custom_total_discovered_4_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_4_alltime_value}/${totalCount}*100,0)%%`,
      false: '',
    },
    'top-explorer-5': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_5_alltime_name%!=---"],
      true: `5. %ajlb_lb_aach_custom_total_discovered_5_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_5_alltime_value}/${totalCount}*100,0)%%`,
      false: '',
    },
  }

  return conditions
}

/**
 * Generate owned TAB config sections
 */
export function generateOwnedTABSections(
  regions: RegionRecord[],
  serverName: string,
  regionBands?: Record<string, string>,
  discordInvite: string = '',
  structureFamilies?: StructureFamiliesMap
): {
  headerFooter: { header: string[]; footer: string[] }
  scoreboards: Record<string, any>
  topExplorersConditions: Record<string, any>
  regionNameDifficultyConditions: Record<string, any>
  structureConditions?: Record<string, unknown>
} {
  const counts = computeRegionCounts(regions)
  const byDifficulty = buildDifficultyRegionIds(regions, regionBands)
  const hasAnyDifficultyRegions =
    DIFFICULTIES.some((d) => byDifficulty[d].length > 0)
  const useDifficultyColour = Boolean(regionBands && hasAnyDifficultyRegions)

  const overworldStructureRows = overworldStructureTabRows(regions, structureFamilies)
  const structurePoiIds = overworldStructureRegionIds(regions, structureFamilies)
  const structureLines: string[] = []
  let structureConditions: Record<string, unknown> | undefined
  if (overworldStructureRows.length > 0 && structurePoiIds.length > 0) {
    structureLines.push('&eCurrent&7:||%condition:structure-name%')
    for (const row of overworldStructureRows) {
      structureLines.push(
        `&e${row.label}&7:||%aach_custom_${row.counter}%/${row.nGlobal}`
      )
    }
    structureConditions = {
      'structure-name': generateStructureNameCondition(structurePoiIds),
      'village-name': VILLAGE_NAME_WITH_STRUCTURE_GUARD,
    }
  }

  const hasOverworldStructures = overworldStructureRows.length > 0

  // Generate header/footer
  const headerFooter = {
    header: generateHeader(serverName),
    footer: generateFooter(discordInvite),
  }

  // Generate scoreboards (conditional by world)
  const scoreboards: Record<string, any> = {}
  if (
    counts.overworldRegions > 0 ||
    counts.overworldHearts > 0 ||
    counts.villages > 0 ||
    hasOverworldStructures
  ) {
    scoreboards['main-overworld'] = generateOverworldScoreboard(serverName, counts, useDifficultyColour)
  }
  if (hasOverworldStructures) {
    scoreboards['structures-overworld'] = generateStructuresOverworldScoreboard(
      serverName,
      structureLines
    )
  }
  if (counts.netherRegions > 0 || counts.netherHearts > 0) {
    scoreboards['scoreboard-nether'] = generateNetherScoreboard(
      serverName,
      counts,
      useDifficultyColour
    )
  }

  // Generate top explorers conditions
  const topExplorersConditions = generateTopExplorersConditions(counts.total)

  // Generate region-name difficulty conditions (only when we have regionBands with main regions)
  const regionNameDifficultyConditions = useDifficultyColour
    ? generateRegionNameDifficultyConditions(regions, regionBands)
    : {}

  return {
    headerFooter,
    scoreboards,
    topExplorersConditions,
    regionNameDifficultyConditions,
    ...(structureConditions ? { structureConditions } : {}),
  }
}

/**
 * Check if a condition key is owned (generated)
 */
function isOwnedConditionKey(key: string): boolean {
  return (
    key === 'top-explorers-title' ||
    key === 'top-explorer-1' ||
    key === 'top-explorer-2' ||
    key === 'top-explorer-3' ||
    key === 'top-explorer-4' ||
    key === 'top-explorer-5' ||
    key === 'region-name-easy' ||
    key === 'region-name-normal' ||
    key === 'region-name-hard' ||
    key === 'region-name-severe' ||
    key === 'region-name-deadly'
  )
}

/**
 * Check if a scoreboard key is owned (generated)
 */
function isOwnedScoreboardKey(key: string): boolean {
  return (
    key === 'main-overworld' ||
    key === 'structures-overworld' ||
    key === 'scoreboard-nether' ||
    key === 'scoreboard-end'
  )
}

/**
 * Merge owned TAB sections into existing TAB config
 */
export function mergeTABConfig(
  existingConfigPath: string,
  ownedSections: {
    headerFooter: { header: string[]; footer: string[] }
    scoreboards: Record<string, any>
    topExplorersConditions: Record<string, any>
    regionNameDifficultyConditions: Record<string, any>
    structureConditions?: Record<string, unknown>
  }
): string {
  const fs = require('fs')
  const content = fs.readFileSync(existingConfigPath, 'utf-8')
  const config = yaml.parse(content) || {}

  // Merge header-footer (TAB 5.x: designs.default.header / footer)
  if (!config['header-footer']) {
    config['header-footer'] = { enabled: true }
  }
  const headerFooter = config['header-footer'] as Record<string, unknown>
  delete headerFooter.header
  delete headerFooter.footer
  delete headerFooter['disable-condition']
  delete headerFooter['per-world']
  delete headerFooter['per-server']
  if (!headerFooter.designs || typeof headerFooter.designs !== 'object') {
    headerFooter.designs = {}
  }
  const designs = headerFooter.designs as Record<string, unknown>
  if (!designs.default || typeof designs.default !== 'object') {
    designs.default = { 'display-condition': '%world%!=disabledworld' }
  }
  const defaultDesign = designs.default as Record<string, unknown>
  if (!defaultDesign['display-condition']) {
    defaultDesign['display-condition'] = '%world%!=disabledworld'
  }
  defaultDesign.header = ownedSections.headerFooter.header
  defaultDesign.footer = ownedSections.headerFooter.footer

  // Merge scoreboards
  if (!config.scoreboard) {
    config.scoreboard = {
      enabled: true,
      'toggle-command': '/sb',
      'remember-toggle-choice': false,
      'hidden-by-default': false,
      'delay-on-join-milliseconds': 0,
      scoreboards: {},
    }
  } else {
    config.scoreboard.enabled = true
  }
  const scoreboardRoot = config.scoreboard as Record<string, unknown>
  delete scoreboardRoot['use-numbers']
  delete scoreboardRoot['static-number']
  if (!config.scoreboard.scoreboards) {
    config.scoreboard.scoreboards = {}
  }

  // Replace scoreboards entirely with only generated ones (remove all non-owned scoreboards)
  const mergedScoreboards: Record<string, any> = {}
  const ownedKeys = Object.keys(ownedSections.scoreboards).sort()
  for (const key of ownedKeys) {
    mergedScoreboards[key] = ownedSections.scoreboards[key]
  }
  config.scoreboard.scoreboards = mergedScoreboards

  // Merge conditions
  if (!config.conditions) {
    config.conditions = {}
  }

  // Remove owned conditions first
  const preservedConditions: Record<string, any> = {}
  for (const [key, value] of Object.entries(config.conditions)) {
    if (!isOwnedConditionKey(key)) {
      preservedConditions[key] = value
    }
  }

  if (ownedSections.structureConditions) {
    delete preservedConditions['structure-name']
    delete preservedConditions['village-name']
  }

  // Ensure static conditions are present (add from reference if missing)
  const staticConditions = {
    'region-name': {
      conditions: ["%worldguard_region_name_2%!="],
      type: 'AND',
      true: '%capitalize_pascal-case-forced_{worldguard_region_name_2}%',
      false: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%',
    },
    'village-name': {
      conditions: [
        '%worldguard_region_name_2%!=',
        '%worldguard_region_name_1%!=%worldguard_region_name_2%',
        '%worldguard_region_name_1%!=spawn',
      ],
      type: 'AND',
      true: '%condition:heart-region%',
      false: '-',
    },
    'heart-region': {
      conditions: ["%worldguard_region_name_1%|-heart"],
      true: '-',
      false: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%',
    },
  }

  // Add static conditions if missing
  for (const [key, value] of Object.entries(staticConditions)) {
    if (!preservedConditions[key]) {
      preservedConditions[key] = value
    }
  }

  // Merge: preserved conditions first, then owned conditions (sorted)
  const mergedConditions: Record<string, any> = { ...preservedConditions }
  const ownedConditionKeys = Object.keys(ownedSections.topExplorersConditions).sort()
  for (const key of ownedConditionKeys) {
    mergedConditions[key] = ownedSections.topExplorersConditions[key]
  }
  const difficultyConditionKeys = Object.keys(ownedSections.regionNameDifficultyConditions).sort()
  for (const key of difficultyConditionKeys) {
    mergedConditions[key] = ownedSections.regionNameDifficultyConditions[key]
  }

  if (ownedSections.structureConditions) {
    for (const key of Object.keys(ownedSections.structureConditions).sort()) {
      mergedConditions[key] = ownedSections.structureConditions[key]
    }
  }

  config.conditions = mergedConditions

  // Stringify with proper formatting (2-space indentation)
  const { YAML_STRINGIFY_OPTIONS } = require('./utils/yamlOptions')
  return yaml.stringify(config, YAML_STRINGIFY_OPTIONS)
}

module.exports = {
  computeRegionCounts,
  generateOwnedTABSections,
  mergeTABConfig,
}
