const yaml = require('yaml')

import { generateCommandId } from './aaGenerator'
import type { StructureFamiliesMap } from './aaGenerator'
import type { RegionRecord, OnboardingConfig } from './types'
import { YAML_STRINGIFY_OPTIONS } from './utils/yamlOptions'

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
      `console_message: [EXPMETRIC] server={SERVER_NAME} type=discovery entity=village player=%player% uuid=%player_uuid% region=${displayName} diff=0`,
      `console_command: cc give virtual ${recipe.crate} 1 %player%`,
      'wait: 6',
      'console_command: aach add 1 Custom.villages_discovered %player%',
      'wait: 6',
      'console_command: aach add 1 Custom.total_discovered %player%',
      'console_message: [EXPMETRIC] server={SERVER_NAME} type=state entity=village player=%player% uuid=%player_uuid% total=%aach_custom_total_discovered% villages=%aach_custom_villages_discovered%',
    ]
  } else if (region.kind === 'region') {
    const diff = difficultyToDiff(regionBands?.[region.id])
    const displayName = formatRegionDisplayName(region)
    actions = [
      'wait: 3',
      `console_command: aach give ${cmd} %player%`,
      `console_message: [EXPMETRIC] server={SERVER_NAME} type=discovery entity=region player=%player% uuid=%player_uuid% region=${displayName} diff=${diff}`,
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
      'console_message: [EXPMETRIC] server={SERVER_NAME} type=state entity=region player=%player% uuid=%player_uuid% total=%aach_custom_total_discovered% regions=%aach_custom_regions_discovered%'
    )
  } else {
    const parentRegionId = region.id.startsWith('heart_of_') ? region.id.slice(9) : region.id
    const parentDisplayName = parentRegionId
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
      .join(' ')
    actions = [
      `console_command: aach give ${cmd} %player%`,
      `console_message: [EXPMETRIC] server={SERVER_NAME} type=discovery entity=heart player=%player% uuid=%player_uuid% region=${parentDisplayName} diff=0`,
      `console_command: cc give virtual ${recipe.crate} 1 %player%`,
      'wait: 6',
      `console_command: aach add 1 ${recipe.counters[0]} %player%`,
      'wait: 6',
      `console_command: aach add 1 ${recipe.counters[1]} %player%`,
      'console_message: [EXPMETRIC] server={SERVER_NAME} type=state entity=heart player=%player% uuid=%player_uuid% total=%aach_custom_total_discovered% hearts=%aach_custom_hearts_discovered%',
    ]
  }

  return {
    type: 'wgevents_region_enter',
    one_time: true,
    conditions: [`%region% == ${region.id}`],
    actions: { default: actions },
  }
}

function generateStructureDiscoverOnceEvent(region: RegionRecord, customCounter: string): CEEvent {
  const cmd = getAACommandId(region)
  const displayName = formatRegionDisplayName(region)
  return {
    type: 'wgevents_region_enter',
    one_time: true,
    conditions: [`%region% == ${region.id}`],
    actions: {
      default: [
        'wait: 3',
        `console_command: aach give ${cmd} %player%`,
        `console_message: [EXPMETRIC] server={SERVER_NAME} type=discovery entity=structure player=%player% uuid=%player_uuid% region=${displayName} diff=0`,
        'wait: 6',
        `console_command: aach add 1 Custom.${customCounter} %player%`,
        `console_message: [EXPMETRIC] server={SERVER_NAME} type=state entity=structure player=%player% uuid=%player_uuid% ${customCounter}=%aach_custom_${customCounter}%`,
      ],
    },
  }
}

function generateJoinLogEvent(): CEEvent {
  return {
    type: 'player_join',
    one_time: false,
    actions: {
      default: ['console_message: [EXPMETRIC] server={SERVER_NAME} type=join player=%player% uuid=%player_uuid%'],
    },
  }
}

function generateLeaveLogEvent(): CEEvent {
  return {
    type: 'player_leave',
    one_time: false,
    actions: {
      default: ['console_message: [EXPMETRIC] server={SERVER_NAME} type=leave player=%player% uuid=%player_uuid%'],
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
    `console_message: [EXPMETRIC] server={SERVER_NAME} type=discovery entity=region player=%player% uuid=%player_uuid% region=${startDisplayName} diff=${startDiff}`,
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
    'console_message: [EXPMETRIC] server={SERVER_NAME} type=state entity=region player=%player% uuid=%player_uuid% total=%aach_custom_total_discovered% regions=%aach_custom_regions_discovered%'
  )

  return {
    type: 'player_join',
    one_time: true,
    actions: { default: actions },
  }
}

/** Generator-owned splits under `plugins/ConditionalEvents/events/<name>.yml` (excludes enchantments). */
export const CE_OWNED_FRAGMENT_BASENAMES = [
  'server-core',
  'overworld-regions',
  'overworld-villages',
  'overworld-hearts',
  'overworld-structures',
  'nether-regions',
  'nether-hearts',
] as const

export type CEOwnedFragmentBasename = (typeof CE_OWNED_FRAGMENT_BASENAMES)[number]

/** All event fragment files written on CE build (includes preserved call-event packs from template keys). */
export const CE_EVENT_FRAGMENT_BASENAMES = [
  ...CE_OWNED_FRAGMENT_BASENAMES,
  'enchantments',
  'potions',
] as const

export type CEEventFragmentBasename = (typeof CE_EVENT_FRAGMENT_BASENAMES)[number]

export function isEnchantmentCallEventKey(key: string): boolean {
  return key.startsWith('get_book_')
}

export function isPotionCallEventKey(key: string): boolean {
  return key.startsWith('get_potion_')
}

export function isServerCoreRelocatedEventKey(key: string): boolean {
  return key === 'world_change'
}

function sortEventsKeys(events: CEEventsSection): CEEventsSection {
  const sorted: CEEventsSection = {}
  for (const k of Object.keys(events).sort()) {
    sorted[k] = events[k]
  }
  return sorted
}

function discoverOnceRegionIdFromKey(key: string): string | null {
  const suffix = '_discover_once'
  if (!key.endsWith(suffix)) return null
  return key.slice(0, -suffix.length)
}

function classifyOwnedEventFragment(key: string, regions: RegionRecord[]): CEOwnedFragmentBasename {
  if (key === 'first_join' || key === 'join_log' || key === 'leave_log') {
    return 'server-core'
  }
  if (key === 'region_heart_discover_once') {
    return 'overworld-regions'
  }

  const rid = discoverOnceRegionIdFromKey(key)
  if (!rid) {
    return 'overworld-regions'
  }

  const region = regions.find((r) => r.id === rid)
  if (!region) {
    return 'overworld-regions'
  }

  if (region.kind === 'structure') {
    return region.world === 'nether' ? 'nether-regions' : 'overworld-structures'
  }
  if (region.kind === 'village') {
    return region.world === 'nether' ? 'nether-regions' : 'overworld-villages'
  }
  if (region.kind === 'heart') {
    return region.world === 'nether' ? 'nether-hearts' : 'overworld-hearts'
  }

  return region.world === 'nether' ? 'nether-regions' : 'overworld-regions'
}

/**
 * Splits generator-owned events into `events/*.yml` buckets (not including enchantment call events).
 */
export function partitionOwnedCEEventsForFragments(
  owned: CEEventsSection,
  regions: RegionRecord[]
): Record<CEOwnedFragmentBasename, CEEventsSection> {
  const buckets = Object.fromEntries(
    CE_OWNED_FRAGMENT_BASENAMES.map((b) => [b, {} as CEEventsSection])
  ) as Record<CEOwnedFragmentBasename, CEEventsSection>

  for (const key of Object.keys(owned).sort()) {
    const fragment = classifyOwnedEventFragment(key, regions)
    buckets[fragment][key] = owned[key]!
  }

  return buckets
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
  regionBands?: Record<string, string>,
  structureFamilies?: StructureFamiliesMap
): CEEventsSection {
  const owned: CEEventsSection = {}

  owned.first_join = generateFirstJoinEvent(onboarding, regions, regionBands)
  owned.join_log = generateJoinLogEvent()
  owned.leave_log = generateLeaveLogEvent()
  owned.region_heart_discover_once = generateRegionHeartDiscoverOnce()

  // on-enter discoveries (skip start region — it's discovered in first_join, not on enter)
  const startId = onboarding.startRegionId
  const discoverOnceRegions = regions.filter(
    (r) =>
      r.discover.method === 'on_enter' &&
      r.id !== startId &&
      r.kind !== 'structure'
  )

  const structureDiscoverRegions = regions.filter(
    (r) =>
      r.kind === 'structure' &&
      r.discover.method === 'on_enter' &&
      r.id !== startId &&
      Boolean(r.structureType && structureFamilies?.[r.structureType]?.counter)
  )

  type DiscoverEntry =
    | { key: string; region: RegionRecord; variant: 'main' }
    | { key: string; region: RegionRecord; variant: 'structure'; counter: string }

  const discoverEntries: DiscoverEntry[] = [
    ...discoverOnceRegions.map((r) => ({ key: `${r.id}_discover_once`, region: r, variant: 'main' as const })),
    ...structureDiscoverRegions.map((r) => ({
      key: `${r.id}_discover_once`,
      region: r,
      variant: 'structure' as const,
      counter: structureFamilies![r.structureType!].counter,
    })),
  ].sort((a, b) => a.key.localeCompare(b.key))

  for (const entry of discoverEntries) {
    if (entry.variant === 'structure') {
      owned[entry.key] = generateStructureDiscoverOnceEvent(entry.region, entry.counter)
    } else {
      owned[entry.key] = generateDiscoverOnceEvent(entry.region, regionBands)
    }
  }

  return owned
}

export function isOwnedEventKey(key: string): boolean {
  return (
    key === 'first_join' ||
    key === 'join_log' ||
    key === 'leave_log' ||
    key === 'region_heart_discover_once' ||
    key.endsWith('_discover_once')
  )
}

export interface CEConfigBundle {
  /** Main `config.yml` body: Config, Messages, Events (preserved only — no owned/relocated keys). */
  mainYaml: string
  /** `events/<basename>.yml` bodies, each with a top-level `Events` map. */
  eventFragmentYamls: Record<CEEventFragmentBasename, string>
}

/**
 * Merge template with generator-owned events split across `ConditionalEvents/events/*.yml`;
 * main file keeps only preserved non-fragment events.
 */
export function buildCEConfigBundle(
  existingConfigPath: string,
  ownedEvents: CEEventsSection,
  regions: RegionRecord[]
): CEConfigBundle {
  const fs = require('fs')
  const content = fs.readFileSync(existingConfigPath, 'utf-8')
  const config = yaml.parse(content) || {}

  const ownedByFragment = partitionOwnedCEEventsForFragments(ownedEvents, regions)
  const enchantmentEvents: Record<string, CEEvent> = {}
  const potionEvents: Record<string, CEEvent> = {}

  const existingEvents = (config.Events || {}) as Record<string, unknown>
  const preservedMain: Record<string, unknown> = {}

  for (const key of Object.keys(existingEvents).sort()) {
    if (isOwnedEventKey(key)) {
      continue
    }
    if (isEnchantmentCallEventKey(key)) {
      enchantmentEvents[key] = existingEvents[key] as CEEvent
      continue
    }
    if (isPotionCallEventKey(key)) {
      potionEvents[key] = existingEvents[key] as CEEvent
      continue
    }
    if (isServerCoreRelocatedEventKey(key)) {
      ownedByFragment['server-core'][key] = existingEvents[key] as CEEvent
      continue
    }
    preservedMain[key] = existingEvents[key]
  }

  config.Events = preservedMain
  const mainYaml = yaml.stringify(config, YAML_STRINGIFY_OPTIONS)

  const eventFragmentYamls = {} as Record<CEEventFragmentBasename, string>
  for (const basename of CE_OWNED_FRAGMENT_BASENAMES) {
    eventFragmentYamls[basename] = yaml.stringify(
      { Events: sortEventsKeys(ownedByFragment[basename]) },
      YAML_STRINGIFY_OPTIONS
    )
  }
  eventFragmentYamls.enchantments = yaml.stringify(
    { Events: sortEventsKeys(enchantmentEvents) },
    YAML_STRINGIFY_OPTIONS
  )
  eventFragmentYamls.potions = yaml.stringify(
    { Events: sortEventsKeys(potionEvents) },
    YAML_STRINGIFY_OPTIONS
  )

  return { mainYaml, eventFragmentYamls }
}

module.exports = {
  generateOwnedCEEvents,
  buildCEConfigBundle,
  getStartRegionAachId,
  partitionOwnedCEEventsForFragments,
  CE_EVENT_FRAGMENT_BASENAMES,
  CE_OWNED_FRAGMENT_BASENAMES,
  isEnchantmentCallEventKey,
  isPotionCallEventKey,
  isServerCoreRelocatedEventKey,
  isOwnedEventKey,
}

