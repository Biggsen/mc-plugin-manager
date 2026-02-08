const yaml = require('yaml')

// Reuse AA command-id generation so CE calls the right /aach give IDs.
const { generateCommandId } = require('./aaGenerator')

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

function recipeForRegion(region: RegionRecord): { counters: string[]; crate?: string } {
  if (region.kind === 'village') {
    return {
      counters: ['Custom.villages_discovered', 'Custom.total_discovered'],
      crate: 'VillageCrate',
    }
  }

  if (region.kind === 'heart') {
    if (region.world === 'nether') {
      return { counters: ['Custom.nether_hearts_discovered'], crate: 'HeartCrate' }
    }
    return { counters: ['Custom.hearts_discovered'], crate: 'HeartCrate' }
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

function generateDiscoverOnceEvent(region: RegionRecord): CEEvent {
  const cmd = getAACommandId(region)
  const recipe = recipeForRegion(region)

  const actions: string[] = [
    'wait: 5',
    `console_command: aach give ${cmd} %player%`,
    ...recipe.counters.map((c) => `console_command: aach add 1 ${c} %player%`),
  ]

  if (recipe.crate) {
    actions.push(`console_command: cc give virtual ${recipe.crate} 1 %player%`)
  }

  return {
    type: 'wgevents_region_enter',
    one_time: true,
    conditions: [`%region% == ${region.id}`],
    actions: { default: actions },
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
        'message: &7Region hearts have an unbreakable lodestone',
        'message: &dBind a compass to it to always find this region again',
      ],
    },
  }
}

/**
 * Returns the AA command ID for the start region (used for first_join placeholder substitution).
 * Template uses {START_REGION_AACH}; first_join is preserved from template, not generated.
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
  onboarding: OnboardingConfig
): CEEventsSection {
  const owned: CEEventsSection = {}

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
    owned[key] = generateDiscoverOnceEvent(region)
  }

  return owned
}

function isOwnedEventKey(key: string): boolean {
  return key === 'region_heart_discover_once' || key.endsWith('_discover_once')
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

