const yaml = require('yaml')

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
}

interface RegionCounts {
  overworldRegions: number
  overworldHearts: number
  netherRegions: number
  netherHearts: number
  villages: number
  total: number
}

/**
 * Compute region counts from region records
 */
export function computeRegionCounts(regions: RegionRecord[]): RegionCounts {
  const counts: RegionCounts = {
    overworldRegions: 0,
    overworldHearts: 0,
    netherRegions: 0,
    netherHearts: 0,
    villages: 0,
    total: 0,
  }

  for (const region of regions) {
    // Only count regions where discover.method != 'disabled'
    if (region.discover.method === 'disabled') {
      continue
    }

    if (region.kind === 'village') {
      counts.villages++
    } else if (region.kind === 'heart') {
      if (region.world === 'nether') {
        counts.netherHearts++
      } else {
        counts.overworldHearts++
      }
    } else if (region.kind === 'region') {
      if (region.world === 'nether') {
        counts.netherRegions++
      } else {
        counts.overworldRegions++
      }
    }

    counts.total++
  }

  return counts
}

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
 * Generate footer section with top explorers
 */
function generateFooter(): string[] {
  return [
    '',
    '&d%condition:top-explorers-title%',
    '&b%condition:top-explorer-1%',
    '&b%condition:top-explorer-2%',
    '&b%condition:top-explorer-3%',
    '&b%condition:top-explorer-4%',
    '&b%condition:top-explorer-5%',
    '',
    '<#FFFFFF>&m                                                </#FFFF00>',
  ]
}

/**
 * Generate overworld scoreboard section
 */
function generateOverworldScoreboard(serverName: string, counts: RegionCounts): any {
  return {
    title: `<#E0B11E>${serverName}</#FF0000>`,
    'display-condition': '%player-version-id%>=765;%bedrock%=false;%world%=world',
    lines: [
      '%animation:MyAnimation1%',
      '&bRegions',
      '&eCurrent&7:||%condition:region-name%',
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

/**
 * Generate nether scoreboard section
 */
function generateNetherScoreboard(serverName: string, counts: RegionCounts): any {
  return {
    title: `<#E0B11E>${serverName}</#FF0000>`,
    'display-condition': '%player-version-id%>=765;%bedrock%=false;%world%=world_nether',
    lines: [
      '%animation:MyAnimation1%',
      '&bNether Regions',
      '&eCurrent&7:||%condition:region-name%',
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
      yes: 'TOP EXPLORERS',
      no: '',
    },
    'top-explorer-1': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_1_alltime_name%!="],
      yes: `1. %ajlb_lb_aach_custom_total_discovered_1_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_1_alltime_value}/${totalCount}*100,0)%%`,
      no: '',
    },
    'top-explorer-2': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_2_alltime_name%!=---"],
      yes: `2. %ajlb_lb_aach_custom_total_discovered_2_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_2_alltime_value}/${totalCount}*100,0)%%`,
      no: '',
    },
    'top-explorer-3': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_3_alltime_name%!=---"],
      yes: `3. %ajlb_lb_aach_custom_total_discovered_3_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_3_alltime_value}/${totalCount}*100,0)%%`,
      no: '',
    },
    'top-explorer-4': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_4_alltime_name%!=---"],
      yes: `4. %ajlb_lb_aach_custom_total_discovered_4_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_4_alltime_value}/${totalCount}*100,0)%%`,
      no: '',
    },
    'top-explorer-5': {
      conditions: ["%ajlb_lb_aach_custom_total_discovered_5_alltime_name%!=---"],
      yes: `5. %ajlb_lb_aach_custom_total_discovered_5_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_5_alltime_value}/${totalCount}*100,0)%%`,
      no: '',
    },
  }

  return conditions
}

/**
 * Generate owned TAB config sections
 */
export function generateOwnedTABSections(
  regions: RegionRecord[],
  serverName: string
): {
  headerFooter: { header: string[]; footer: string[] }
  scoreboards: Record<string, any>
  topExplorersConditions: Record<string, any>
} {
  const counts = computeRegionCounts(regions)

  // Generate header/footer
  const headerFooter = {
    header: generateHeader(serverName),
    footer: generateFooter(),
  }

  // Generate scoreboards (conditional by world)
  const scoreboards: Record<string, any> = {}
  if (counts.overworldRegions > 0 || counts.overworldHearts > 0 || counts.villages > 0) {
    scoreboards['scoreboard-overworld'] = generateOverworldScoreboard(serverName, counts)
  }
  if (counts.netherRegions > 0 || counts.netherHearts > 0) {
    scoreboards['scoreboard-nether'] = generateNetherScoreboard(serverName, counts)
  }

  // Generate top explorers conditions
  const topExplorersConditions = generateTopExplorersConditions(counts.total)

  return {
    headerFooter,
    scoreboards,
    topExplorersConditions,
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
    key === 'top-explorer-5'
  )
}

/**
 * Check if a scoreboard key is owned (generated)
 */
function isOwnedScoreboardKey(key: string): boolean {
  return key === 'scoreboard-overworld' || key === 'scoreboard-nether' || key === 'scoreboard-end'
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
  }
): string {
  const fs = require('fs')
  const content = fs.readFileSync(existingConfigPath, 'utf-8')
  const config = yaml.parse(content) || {}

  // Merge header-footer
  if (!config['header-footer']) {
    config['header-footer'] = { enabled: true }
  }
  config['header-footer'].header = ownedSections.headerFooter.header
  config['header-footer'].footer = ownedSections.headerFooter.footer

  // Merge scoreboards
  if (!config.scoreboard) {
    config.scoreboard = {
      enabled: true,
      'toggle-command': '/sb',
      'remember-toggle-choice': false,
      'hidden-by-default': false,
      'use-numbers': true,
      'static-number': 0,
      'delay-on-join-milliseconds': 0,
      scoreboards: {},
    }
  } else {
    // Ensure scoreboard is enabled (owned section)
    config.scoreboard.enabled = true
  }
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

  // Ensure static conditions are present (add from reference if missing)
  const staticConditions = {
    'region-name': {
      conditions: ["%worldguard_region_name_2%!="],
      type: 'AND',
      yes: '%capitalize_pascal-case-forced_{worldguard_region_name_2}%',
      no: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%',
    },
    'village-name': {
      conditions: [
        "%worldguard_region_name_2%!=",
        '%worldguard_region_name_1%!=%worldguard_region_name_2%',
        "%worldguard_region_name_1%!=spawn",
      ],
      type: 'AND',
      yes: '%condition:heart-region%',
      no: '-',
    },
    'heart-region': {
      conditions: ["%worldguard_region_name_1%|-heart"],
      yes: '-',
      no: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%',
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
  config.conditions = mergedConditions

  // Stringify with proper formatting (2-space indentation)
  return yaml.stringify(config, {
    indent: 2,
    lineWidth: 0,
    simpleKeys: false,
  })
}

module.exports = {
  computeRegionCounts,
  generateOwnedTABSections,
  mergeTABConfig,
}
