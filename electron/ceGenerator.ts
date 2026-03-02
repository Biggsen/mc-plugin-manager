const yaml = require('yaml')

// Reuse AA command-id generation so CE calls the right /aach give IDs.
const { generateCommandId } = require('./aaGenerator')

interface RegionRecord {
  world: 'overworld' | 'nether' | 'end'
  id: string
  kind: 'system' | 'region' | 'village' | 'heart'
  description?: string
  discover: {
    method: 'disabled' | 'on_enter' | 'first_join'
    recipeId: 'region' | 'heart' | 'nether_region' | 'nether_heart' | 'none' | 'village'
    commandIdOverride?: string
    displayNameOverride?: string
  }
}

interface OnboardingConfig {
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

type CEEvent = {
  type: string
  one_time: boolean
  conditions?: string[]
  actions: {
    default: string[]
  }
}

type CEEventsSection = Record<string, CEEvent>

function tpCommand(tp: OnboardingConfig['teleport']): string {
  const y = tp.y ?? 64
  const base = `console_command: tp %player% ${tp.x} ${y} ${tp.z}`
  if (typeof tp.yaw === 'number' && typeof tp.pitch === 'number') {
    return `${base} ${tp.yaw} ${tp.pitch}`
  }
  return base
}

function getAACommandId(region: RegionRecord): string {
  return region.discover.commandIdOverride || generateCommandId(region.id)
}

function formatRegionDisplayName(region: RegionRecord): string {
  if (region.discover.displayNameOverride) return region.discover.displayNameOverride
  return region.id
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
}

const DIFFICULTY_TO_DIFF: Record<string, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
  severe: 4,
  deadly: 5,
}

function difficultyToDiff(difficulty: string | undefined): number {
  if (!difficulty) return 0
  return DIFFICULTY_TO_DIFF[difficulty.toLowerCase()] ?? 0
}

function recipeForRegion(region: RegionRecord): { counters: string[]; crate?: string } {
  if (region.kind === 'village') {
    return {
      counters: ['Custom.villages_discovered', 'Custom.total_discovered'],
      crate: 'VillageCrate',
    }
  }

  if (region.kind === 'heart') {
    if (region.world === 'nether') {
      return {
        counters: ['Custom.nether_hearts_discovered', 'Custom.total_discovered'],
        crate: 'HeartCrate',
      }
    }
    return {
      counters: ['Custom.hearts_discovered', 'Custom.total_discovered'],
      crate: 'HeartCrate',
    }
  }

  // regular regions
  if (region.world === 'nether') {
    return {
      counters: ['Custom.nether_regions_discovered', 'Custom.total_discovered'],
      crate: 'RegionCrate',
    }
  }

  return {
    counters: ['Custom.regions_discovered', 'Custom.total_discovered'],
    crate: 'RegionCrate',
  }
}

function generateDiscoverOnceEvent(
  region: RegionRecord,
  regionBands?: Record<string, string>
): CEEvent {
  const cmd = getAACommandId(region)
  const recipe = recipeForRegion(region)

  let actions: string[]

  if (region.kind === 'village') {
    const displayName = formatRegionDisplayName(region)
    actions = [
      'wait: 3',
      `console_command: aach give ${cmd} %player%`,
      `console_message: [EXPMETRIC] type=discovery entity=village player=%player% uuid=%player_uuid% region=${displayName} diff=0`,
      `console_command: cc give virtual ${recipe.crate} 1 %player%`,
      'wait: 6',
      'console_command: aach add 1 Custom.villages_discovered %player%',
      'wait: 6',
      'console_command: aach add 1 Custom.total_discovered %player%',
      'console_message: [EXPMETRIC] type=state entity=village player=%player% uuid=%player_uuid% total=%aach_custom_total_discovered% villages=%aach_custom_villages_discovered%',
    ]
  } else if (region.kind === 'region') {
    const diff = difficultyToDiff(regionBands?.[region.id])
    const displayName = formatRegionDisplayName(region)
    actions = [
      'wait: 3',
      `console_command: aach give ${cmd} %player%`,
      `console_message: [EXPMETRIC] type=discovery entity=region player=%player% uuid=%player_uuid% region=${displayName} diff=${diff}`,
      `console_command: cc give virtual ${recipe.crate} 1 %player%`,
    ]
    if (region.description?.trim()) {
      actions.push(`console_command: lp user %player% permission set bookgui.book.${region.id} true`)
    }
    actions.push(
      'wait: 6',
      `console_command: aach add 1 ${recipe.counters[0]} %player%`,
      'wait: 6',
      `console_command: aach add 1 ${recipe.counters[1]} %player%`,
      'console_message: [EXPMETRIC] type=state entity=region player=%player% uuid=%player_uuid% total=%aach_custom_total_discovered% regions=%aach_custom_regions_discovered%'
    )
  } else {
    const parentRegionId = region.id.startsWith('heart_of_') ? region.id.slice(9) : region.id
    const parentDisplayName = parentRegionId
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
      .join(' ')
    actions = [
      `console_command: aach give ${cmd} %player%`,
      `console_message: [EXPMETRIC] type=discovery entity=heart player=%player% uuid=%player_uuid% region=${parentDisplayName} diff=0`,
      `console_command: cc give virtual ${recipe.crate} 1 %player%`,
      'wait: 6',
      `console_command: aach add 1 ${recipe.counters[0]} %player%`,
      'wait: 6',
      `console_command: aach add 1 ${recipe.counters[1]} %player%`,
      'console_message: [EXPMETRIC] type=state entity=heart player=%player% uuid=%player_uuid% total=%aach_custom_total_discovered% hearts=%aach_custom_hearts_discovered%',
    ]
  }

  return {
    type: 'wgevents_region_enter',
    one_time: true,
    conditions: [`%region% == ${region.id}`],
    actions: { default: actions },
  }
}

function generateJoinLogEvent(): CEEvent {
  return {
    type: 'player_join',
    one_time: false,
    actions: {
      default: ['console_message: [EXPMETRIC] type=join player=%player% uuid=%player_uuid%'],
    },
  }
}

function generateLeaveLogEvent(): CEEvent {
  return {
    type: 'player_leave',
    one_time: false,
    actions: {
      default: ['console_message: [EXPMETRIC] type=leave player=%player% uuid=%player_uuid%'],
    },
  }
}

function generateRegionHeartDiscoverOnce(): CEEvent {
  // Match existing server style (lodestone tip).
  return {
    type: 'wgevents_region_enter',
    one_time: true,
    conditions: ['%region% startsWith heart'],
    actions: {
      default: [
        'wait: 13',
        'message: &7Region hearts have an unbreakable lodestone',
        'message: &dBind a compass to it to always find this region again',
      ],
    },
  }
}

function generateFirstJoinEvent(
  onboarding: OnboardingConfig,
  regions: RegionRecord[],
  regionBands?: Record<string, string>
): CEEvent {
  const tp = tpCommand(onboarding.teleport)
  const startRegion =
    regions.find((r) => r.id === onboarding.startRegionId && r.world === 'overworld') ||
    regions.find((r) => r.id === onboarding.startRegionId)
  const hasStartRegionWithDescription =
    startRegion?.description?.trim() && startRegion.kind !== 'village' && startRegion.kind !== 'heart'

  const startRegionId = startRegion?.id ?? onboarding.startRegionId
  const startDisplayName = startRegion ? formatRegionDisplayName(startRegion) : startRegionId
  const startDiff = difficultyToDiff(regionBands?.[startRegionId])
  const actions: string[] = [
    tp,
    'wait: 1',
    'title: 20;100;20;Welcome to {SERVER_NAME};Where the journey matters',
    'wait: 10',
    'console_command: aach give {START_REGION_AACH} %player%',
    `console_message: [EXPMETRIC] type=discovery entity=region player=%player% uuid=%player_uuid% region=${startDisplayName} diff=${startDiff}`,
    'console_command: aach add 1 Custom.regions_discovered %player%',
  ]

  if (hasStartRegionWithDescription) {
    actions.push(
      `console_command: lp user %player% permission set bookgui.book.${startRegion!.id} true`
    )
  }

  actions.push(
    'wait: 10',
    'console_command: aach add 1 Custom.total_discovered %player%',
    'title: 20;100;20;Your first reward!;Open crates with /cc',
    'console_command: cc give virtual RegionCrate 1 %player%',
    'wait: 30',
    'message: &bFor help on how to play use &e/guides'
  )

  if (hasStartRegionWithDescription) {
    const displayName = formatRegionDisplayName(startRegion!)
    actions.push('wait: 30', `message: &bCurious about ${displayName}? &e/lore ${startRegion!.id}`)
  }

  actions.push(
    'console_message: [EXPMETRIC] type=state entity=region player=%player% uuid=%player_uuid% total=%aach_custom_total_discovered% regions=%aach_custom_regions_discovered%'
  )

  return {
    type: 'player_join',
    one_time: true,
    actions: { default: actions },
  }
}

/**
 * Returns the AA command ID for the start region (used for first_join placeholder substitution).
 */
export function getStartRegionAachId(
  onboarding: OnboardingConfig,
  regions: RegionRecord[]
): string {
  const startId = onboarding.startRegionId
  const startRegion =
    regions.find((r) => r.id === startId && r.world === 'overworld') ||
    regions.find((r) => r.id === startId)
  return startRegion ? getAACommandId(startRegion) : generateCommandId(startId)
}

export function generateOwnedCEEvents(
  regions: RegionRecord[],
  onboarding: OnboardingConfig,
  regionBands?: Record<string, string>
): CEEventsSection {
  const owned: CEEventsSection = {}

  owned.first_join = generateFirstJoinEvent(onboarding, regions, regionBands)
  owned.join_log = generateJoinLogEvent()
  owned.leave_log = generateLeaveLogEvent()
  owned.region_heart_discover_once = generateRegionHeartDiscoverOnce()

  // on-enter discoveries (skip start region — it's discovered in first_join, not on enter)
  const startId = onboarding.startRegionId
  const discoverOnceRegions = regions.filter(
    (r) => r.discover.method === 'on_enter' && r.id !== startId
  )
  const keys = discoverOnceRegions
    .map((r) => ({ key: `${r.id}_discover_once`, region: r }))
    .sort((a, b) => a.key.localeCompare(b.key))

  for (const { key, region } of keys) {
    owned[key] = generateDiscoverOnceEvent(region, regionBands)
  }

  return owned
}

function isOwnedEventKey(key: string): boolean {
  return key === 'first_join' || key === 'join_log' || key === 'leave_log' || key === 'region_heart_discover_once' || key.endsWith('_discover_once')
}

export function mergeCEConfig(existingConfigPath: string, ownedEvents: CEEventsSection): string {
  const fs = require('fs')
  const content = fs.readFileSync(existingConfigPath, 'utf-8')
  const config = yaml.parse(content) || {}

  const existingEvents = (config.Events || {}) as Record<string, any>
  const preserved: Record<string, any> = {}
  for (const key of Object.keys(existingEvents)) {
    if (!isOwnedEventKey(key)) {
      preserved[key] = existingEvents[key]
    }
  }

  // Deterministic: owned first (first_join, region_heart..., then sorted discover_once), then preserved.
  const mergedEvents: Record<string, any> = { ...ownedEvents, ...preserved }
  config.Events = mergedEvents

  return yaml.stringify(config, {
    indent: 2,
    lineWidth: 0,
    singleQuote: true,
  })
}

module.exports = { generateOwnedCEEvents, mergeCEConfig, getStartRegionAachId }

