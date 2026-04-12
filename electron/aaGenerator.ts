const yaml = require('yaml')

import type { RegionRecord } from './types'
import { snakeToTitleCase } from './shared/stringFormatters'
import { computeRegionCounts } from './utils/regionStats'

interface AACommand {
  Goal: string
  Message: string
  Name: string
  DisplayName: string
  Type: string
  Reward?: {
    Experience?: number
    Command?: {
      Execute: string[]
      Display: string
    }
  }
}

type AACommandsSection = {
  [commandId: string]: AACommand
}

// Tier can be a fixed number or a dynamic marker
type TierMarker = number | 'half' | 'all'

interface TierTemplate {
  tiers: TierMarker[]
  category: string // e.g., 'villages_discovered'
}

// Tier templates for each category
// Villages: even increments of 10, plus special half and all milestones
const VILLAGES_TEMPLATE: TierTemplate = {
  tiers: [1, 10, 20, 30, 40, 50, 60, 'half', 'all'],
  category: 'villages_discovered',
}

const REGIONS_TEMPLATE: TierTemplate = {
  tiers: [2, 'half', 'all'],
  category: 'regions_discovered',
}

const HEARTS_TEMPLATE: TierTemplate = {
  tiers: [1, 'half', 'all'],
  category: 'hearts_discovered',
}

const STRUCTURE_DISCOVERY_XP: Record<string, number> = {
  pillager_outpost: 80,
  shipwreck: 80,
  desert_pyramid: 100,
  desert_well: 110,
  buried_treasure: 130,
  jungle_temple: 150,
  igloo: 180,
  trail_ruins: 200,
  swamp_hut: 130,
  woodland_mansion: 350,
  ancient_city: 500,
}

/** Per-structure claimblocks (AdvancedAchievements Reward.Command); PLAYER is substituted by AA */
const STRUCTURE_DISCOVERY_CLAIM_BLOCKS: Record<string, number> = {
  pillager_outpost: 10,
  shipwreck: 10,
  desert_pyramid: 12,
  desert_well: 13,
  buried_treasure: 15,
  jungle_temple: 18,
  igloo: 22,
  trail_ruins: 25,
  swamp_hut: 15,
  woodland_mansion: 35,
  ancient_city: 50,
}

const STRUCTURE_SET_DIFFICULTY: Record<string, number> = {
  pillager_outpost: 1.0,
  shipwreck: 1.0,
  desert_pyramid: 1.1,
  desert_well: 1.2,
  buried_treasure: 1.35,
  jungle_temple: 1.5,
  igloo: 1.8,
  trail_ruins: 2.0,
  swamp_hut: 1.35,
  woodland_mansion: 2.75,
  ancient_city: 3.5,
}

const STRUCTURE_SET_XP_BASE = 250

/** Same scaling as set XP (difficulty × √n); tuned for claimblock magnitudes */
const STRUCTURE_SET_CLAIM_BLOCKS_BASE = 20

function getStructureSetDifficulty(structureType: string): number {
  if (!(structureType in STRUCTURE_SET_DIFFICULTY)) {
    throw new Error(`Unknown structure type: ${structureType}`)
  }
  return STRUCTURE_SET_DIFFICULTY[structureType]
}

function calculateStructureSetXP(structureType: string, quantity: number): number {
  if (quantity <= 0) return 0
  const difficulty = getStructureSetDifficulty(structureType)
  const xp = STRUCTURE_SET_XP_BASE * difficulty * Math.sqrt(quantity)
  return Math.round(xp)
}

function calculateStructureSetClaimBlocks(structureType: string, quantity: number): number {
  if (quantity <= 0) return 0
  const difficulty = getStructureSetDifficulty(structureType)
  const blocks = STRUCTURE_SET_CLAIM_BLOCKS_BASE * difficulty * Math.sqrt(quantity)
  return Math.round(blocks)
}

const HALF_COLLISION_THRESHOLD = 5
const ALL_COLLISION_THRESHOLD = 4

/** Roman numerals I–X for enchant / potion stack labels */
function toRomanLevel(n: number): string {
  const r = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
  if (n >= 1 && n <= 10) return r[n]
  return String(n)
}

function extractCeCallToken(line: string): string | null {
  const m = String(line).match(/ce\s+call\s+(\S+)/i)
  return m ? m[1] : null
}

function normalizeExecuteToLines(execute: unknown): string[] {
  if (Array.isArray(execute)) return execute.map(String)
  if (typeof execute === 'string') return [execute]
  return []
}

const LEGEND_ALERT_TEMPLATE =
  'say §7ALERT: §4PLAYER§7 has become [ARTICLE] §4[DISPLAYNAME]§7!'

function indefiniteArticleFor(displayName: string): 'a' | 'an' {
  const firstWord = displayName.trim().split(/\s+/u)[0]?.toLowerCase() ?? ''
  if (firstWord.length === 0) return 'a'
  return /^[aeiou]/u.test(firstWord) ? 'an' : 'a'
}

function appendLegendAlertExecute(entry: any): void {
  const displayName = typeof entry?.DisplayName === 'string' ? entry.DisplayName.trim() : ''
  if (!displayName || !/\bLegend$/u.test(displayName)) return
  const article = indefiniteArticleFor(displayName)
  const alertLine = LEGEND_ALERT_TEMPLATE
    .replace('[ARTICLE]', article)
    .replace('[DISPLAYNAME]', displayName.toUpperCase())
  if (!entry.Reward || typeof entry.Reward !== 'object') {
    entry.Reward = {}
  }
  if (!entry.Reward.Command || typeof entry.Reward.Command !== 'object') {
    entry.Reward.Command = { Execute: [] }
  }
  const execute = normalizeExecuteToLines(entry.Reward.Command.Execute)
  if (!execute.includes(alertLine)) {
    execute.push(alertLine)
  }
  entry.Reward.Command.Execute = execute
}

function appendLegendAlertsInCustom(customSection: any): void {
  if (!customSection || typeof customSection !== 'object') return
  for (const category of Object.keys(customSection)) {
    if (category === 'blacksmiths_discovered' || category === 'total_discovered') continue
    const categoryEntries = customSection[category]
    if (!categoryEntries || typeof categoryEntries !== 'object') continue
    for (const tierKey of Object.keys(categoryEntries)) {
      const entry = categoryEntries[tierKey]
      if (!entry || typeof entry !== 'object') continue
      appendLegendAlertExecute(entry)
    }
  }
}

function displayFromBookToken(token: string): string | null {
  if (!token.startsWith('get_book_')) return null
  let rest = token.slice('get_book_'.length)
  const levelMatch = rest.match(/_(\d+)$/)
  let level: number | null = null
  if (levelMatch) {
    level = parseInt(levelMatch[1], 10)
    rest = rest.slice(0, -(levelMatch[0].length))
  }
  const title = snakeToTitleCase(rest)
  if (level !== null) {
    return `${title} ${toRomanLevel(level)}`
  }
  return title
}

function displayFromPotionToken(token: string): string | null {
  if (!token.startsWith('get_potion_')) return null
  let rest = token.slice('get_potion_'.length)
  const stackMatch = rest.match(/^(.+)_(\d+)$/)
  if (stackMatch && !rest.endsWith('_long')) {
    const base = stackMatch[1]
    const count = parseInt(stackMatch[2], 10)
    const baseTitle = snakeToTitleCase(base)
    return `${count} Potions of ${baseTitle}`
  }
  rest = rest.replace(/_long$/, '')
  const baseTitle = snakeToTitleCase(rest)
  return `Potion of ${baseTitle}`
}

/**
 * Human-readable Reward.Command.Display for one `ce call ...` line (get_book_* / get_potion_*).
 * Exported for tests.
 */
export function rewardDisplayFromCeExecuteLine(line: string): string | null {
  const token = extractCeCallToken(line)
  if (!token) return null
  return displayFromBookToken(token) ?? displayFromPotionToken(token)
}

/**
 * When template Reward.Command has Execute but no Display, derive Display from CE call lines.
 * Skips if Display is already set, or if any Execute line is not a recognized ce call pattern.
 */
function ensureRewardCommandDisplayFromCeCalls(entry: any): void {
  const cmd = entry?.Reward?.Command
  if (!cmd?.Execute) return
  if (cmd.Display != null && String(cmd.Display).trim() !== '') return
  const lines = normalizeExecuteToLines(cmd.Execute)
  if (lines.length === 0) return
  const parts: string[] = []
  for (const line of lines) {
    const d = rewardDisplayFromCeExecuteLine(line)
    if (d == null) return
    parts.push(d)
  }
  cmd.Display = parts.join(' and ')
}

/**
 * Calculate actual tier numbers from a template and total count
 * Rules:
 * 1. Drop any fixed tier >= total
 * 2. Drop fixed tier if within HALF_COLLISION_THRESHOLD of half (avoids e.g. 20 and 21 back-to-back)
 * 3. Drop highest remaining fixed tier if within ALL_COLLISION_THRESHOLD of total
 * 4. Calculate 'half' = floor(total/2) and 'all' = total
 */
function calculateTiers(template: TierTemplate, total: number): number[] {
  if (total <= 0) return []

  const half = Math.floor(total / 2)

  const resolvedTiers: { value: number; isFixed: boolean }[] = []

  for (const tier of template.tiers) {
    if (tier === 'half') {
      resolvedTiers.push({ value: half, isFixed: false })
    } else if (tier === 'all') {
      resolvedTiers.push({ value: total, isFixed: false })
    } else {
      resolvedTiers.push({ value: tier, isFixed: true })
    }
  }

  let filtered = resolvedTiers.filter(t => !t.isFixed || t.value < total)

  filtered = filtered.filter(t => {
    if (!t.isFixed) return true
    if (Math.abs(t.value - half) <= HALF_COLLISION_THRESHOLD) return false
    return true
  })

  const fixedTiers = filtered.filter(t => t.isFixed)
  if (fixedTiers.length > 0) {
    const highestFixed = Math.max(...fixedTiers.map(t => t.value))
    if (total - highestFixed <= ALL_COLLISION_THRESHOLD) {
      const indexToRemove = filtered.findIndex(t => t.isFixed && t.value === highestFixed)
      if (indexToRemove !== -1) {
        filtered.splice(indexToRemove, 1)
      }
    }
  }

  let values = [...new Set(filtered.map(t => t.value))].sort((a, b) => a - b)

  if (half === total && values.includes(half)) {
    values = values.filter(v => v === total || v < half)
  }

  if (total >= 1 && values.includes(0)) {
    values = values.filter(v => v > 0)
  }

  return values
}

/**
 * Convert snake_case to PascalCase
 * Examples:
 * - cherrybrook -> Cherrybrook
 * - heart_of_monkvos -> HeartOfMonkvos
 */
function snakeToPascalCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Convert region ID to snake_case Name field
 * Examples:
 * - warriotos -> discover_warriotos
 * - heart_of_warriotos -> discover_heart_of_warriotos
 * - ebon_of_wither -> discover_ebon_of_wither
 */
function regionIdToSnakeCaseName(regionId: string): string {
  return 'discover_' + regionId.toLowerCase()
}

/**
 * Get region name in Title Case from region ID
 * Handles heart regions by extracting the parent region name
 */
function getRegionName(regionId: string, kind: string): string {
  let name = regionId
  
  // For hearts, extract the parent region name
  if (kind === 'heart' && regionId.startsWith('heart_of_')) {
    name = regionId.replace(/^heart_of_/, '')
  }
  
  return snakeToTitleCase(name)
}

/**
 * Generate AA Command ID from region ID
 * Pattern: discover + PascalCase(regionId)
 * 
 * Special rules:
 * - Hearts: Capitalize all words including "of" (heart_of_warriotos -> discoverHeartOfWarriotos)
 * - Nether regions with "of": "of" stays lowercase in the middle
 *   (ebon_of_wither -> discoverEbonofWither)
 */
function generateCommandId(regionId: string): string {
  // Split by underscores
  const parts = regionId.split('_')
  
  // Check if this is a heart region (starts with "heart_of")
  const isHeart = regionId.startsWith('heart_of_')
  
  // Convert each part
  const convertedParts = parts.map((part, index) => {
    // For nether regions (not hearts), keep "of" lowercase in the middle
    if (!isHeart && index > 0 && part.toLowerCase() === 'of') {
      return 'of'
    }
    // Capitalize first letter, lowercase rest (this will capitalize "Of" in hearts)
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  })
  
  const pascalCase = convertedParts.join('')
  return 'discover' + pascalCase
}

/**
 * Generate Display Name from region ID
 * Default: Title Case derived from id
 * - cherrybrook -> Cherrybrook
 * - heart_of_cherrybrook -> Heart of Cherrybrook
 */
function generateDisplayName(regionId: string): string {
  return snakeToTitleCase(regionId)
}

/**
 * DisplayName for structure POI commands: title case each segment of structureType (singular phrase base).
 */
export function structureTypeToSingularTitle(structureType: string): string {
  const singularOverrides: Record<string, string> = {
    trail_ruins: 'Trail Ruin',
  }
  if (singularOverrides[structureType]) {
    return singularOverrides[structureType]
  }
  return structureType
    .split('_')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Generate AA Commands section from region records
 */
export function generateAACommands(regions: RegionRecord[]): AACommandsSection {
  const commands: AACommandsSection = {}
  
  const activeRegions = regions.filter(
    (r) =>
      r.discover.method !== 'disabled' &&
      r.discover.method !== 'passive' &&
      r.kind !== 'water'
  )
  
  // Sort by command ID for deterministic output
  const sortedRegions = [...activeRegions].sort((a, b) => {
    const idA = a.discover.commandIdOverride || generateCommandId(a.id)
    const idB = b.discover.commandIdOverride || generateCommandId(b.id)
    return idA.localeCompare(idB)
  })
  
  for (const region of sortedRegions) {
    const commandId = region.discover.commandIdOverride || generateCommandId(region.id)
    const regionName = getRegionName(region.id, region.kind)
    const nameSnakeCase = regionIdToSnakeCaseName(region.id)
    
    // Generate Goal, Message, and DisplayName based on region kind and world
    let goal: string
    let message: string
    let displayName: string
    
    if (region.kind === 'structure') {
      const idTitle = snakeToTitleCase(region.id)
      goal = `Discover ${idTitle}`
      message = `You found ${idTitle}`
      const st = region.structureType ?? ''
      displayName = `${structureTypeToSingularTitle(st)} Found`
    } else if (region.kind === 'heart') {
      goal = `Discover the Heart of ${regionName}`
      message = `You discovered the Heart of ${regionName}`
      displayName = region.world === 'nether' ? 'Nether Heart Discovery' : 'Heart Discovery'
    } else if (region.kind === 'village') {
      goal = `Discover ${regionName} Village`
      message = `You discovered the village of ${regionName}`
      displayName = 'Village Discovery'
    } else {
      // Regular region
      if (region.world === 'nether') {
        goal = `Discover ${regionName} Nether Region`
        message = `You discovered the nether region of ${regionName}`
        displayName = 'Nether Region Discovery'
      } else {
        goal = `Discover ${regionName} Region`
        message = `You discovered the region of ${regionName}`
        displayName = 'Region Discovery'
      }
    }
    
    // Apply overrides if present
    if (region.discover.displayNameOverride) {
      displayName = region.discover.displayNameOverride
    }
    
    // Flat structure - no level "1" nesting
    const entry: AACommand = {
      Goal: goal,
      Message: message,
      Name: nameSnakeCase,
      DisplayName: displayName,
      Type: 'normal',
    }
    if (region.kind === 'structure' && region.structureType) {
      const xp = STRUCTURE_DISCOVERY_XP[region.structureType]
      const claimBlocks = STRUCTURE_DISCOVERY_CLAIM_BLOCKS[region.structureType]
      if (typeof xp === 'number') {
        entry.Reward = { Experience: xp }
        if (typeof claimBlocks === 'number') {
          entry.Reward.Command = {
            Execute: [`acb PLAYER +${claimBlocks}`],
            Display: `${claimBlocks} claimblocks`,
          }
        }
      }
    }
    appendLegendAlertExecute(entry)
    commands[commandId] = entry
  }
  
  return commands
}

/**
 * Count regions by kind from profile.regions
 */
function countRegionsByKind(regions: RegionRecord[]): { villages: number; regions: number; hearts: number } {
  // Only count overworld regions (nether has separate categories)
  const overworldRegions = regions.filter(r => r.world === 'overworld')
  
  return {
    villages: overworldRegions.filter(r => r.kind === 'village').length,
    regions: overworldRegions.filter(r => r.kind === 'region').length,
    hearts: overworldRegions.filter(r => r.kind === 'heart').length,
  }
}

/**
 * Generate Custom achievements category from template and calculated tiers
 */
function generateCustomCategory(
  templateCategory: Record<string, any>,
  calculatedTiers: number[],
  template: TierTemplate,
  total: number,
  categoryName: string
): { [tier: number]: any } {
  const result: { [tier: number]: any } = {}
  const half = Math.floor(total / 2)

  const hasHalfTemplate = '_half' in templateCategory
  const hasAllTemplate = '_all' in templateCategory
  const numericKeys = Object.keys(templateCategory)
    .filter(k => !Number.isNaN(Number(k)))
    .map(Number)
    .sort((a, b) => a - b)
  const allTemplateKey = numericKeys.length > 0 ? numericKeys[numericKeys.length - 1] : null
  const middleIndex = Math.floor(numericKeys.length / 2)
  const fallbackHalfKey = numericKeys[middleIndex] ?? numericKeys[0]

  for (let i = 0; i < calculatedTiers.length; i++) {
    const tierValue = calculatedTiers[i]
    const isAllTier = tierValue === total && i === calculatedTiers.length - 1
    const isHalfTier = tierValue === half && !isAllTier

    let templateEntry: any
    if (isAllTier && hasAllTemplate) {
      templateEntry = templateCategory['_all']
    } else if (isHalfTier && hasHalfTemplate) {
      templateEntry = templateCategory['_half']
    } else if (isAllTier && allTemplateKey != null) {
      templateEntry = templateCategory[allTemplateKey]
    } else if (isHalfTier) {
      const halfKey = numericKeys.find(k => Math.abs(k - half) <= 5) ?? fallbackHalfKey
      templateEntry = templateCategory[halfKey]
    } else {
      let templateKey = numericKeys.includes(tierValue) ? tierValue : null
      if (templateKey == null) {
        templateKey = numericKeys.reduce((prev, curr) =>
          Math.abs(curr - tierValue) < Math.abs(prev - tierValue) ? curr : prev
        )
      }
      templateEntry = templateCategory[templateKey]
    }
    if (!templateEntry) continue
    
    // Clone and update the entry
    const entry = JSON.parse(JSON.stringify(templateEntry))
    
    // Update Name field with actual tier value
    entry.Name = `${categoryName}_${tierValue}`
    
    // Update Message if it contains the count
    if (entry.Message) {
      // Replace specific count mentions
      entry.Message = entry.Message.replace(/\d+ villages/g, `${tierValue} villages`)
      entry.Message = entry.Message.replace(/\d+ regions/g, `${tierValue} regions`)
      entry.Message = entry.Message.replace(/\d+ Hearts/g, `${tierValue} Hearts`)
      
      // For 'all' tier, ensure message says "all"
      if (isAllTier && !entry.Message.includes('all')) {
        if (categoryName === 'villages_discovered') {
          entry.Message = 'You discovered all the villages!'
        } else if (categoryName === 'regions_discovered') {
          entry.Message = 'You discovered all the regions!'
        } else if (categoryName === 'hearts_discovered') {
          entry.Message = 'You discovered all the Hearts of regions!'
        }
      }
      
      // For 'half' tier, ensure message says "half"
      if (isHalfTier && !entry.Message.includes('half')) {
        if (categoryName === 'villages_discovered') {
          entry.Message = 'You discovered half of all the villages!'
        } else if (categoryName === 'regions_discovered') {
          entry.Message = 'You discovered half of all the regions!'
        } else if (categoryName === 'hearts_discovered') {
          entry.Message = 'You discovered half of all the Hearts of regions!'
        }
      }
    }

    ensureRewardCommandDisplayFromCeCalls(entry)
    appendLegendAlertExecute(entry)
    
    result[tierValue] = entry
  }
  
  return result
}

type StructuresFoundSource = 'ten' | 'quarter' | 'half' | 'threeQuarter' | 'all'

const STRUCTURES_FOUND_PRIORITY: Record<StructuresFoundSource, number> = {
  ten: 1,
  quarter: 2,
  half: 3,
  threeQuarter: 4,
  all: 5,
}

/** Two base titles per inter-milestone segment (25% / 50% / 75% / 100% bounds). */
const STRUCTURES_FOUND_SEGMENT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['Wanderer', 'Scout'],
  ['Pathfinder', 'Wayfarer'],
  ['Pioneer', 'Outrider'],
  ['Chronicler', 'Cartographer'],
]

function structuresFoundMilestoneBounds(total: number): { quarter: number; half: number; threeQuarter: number } {
  return {
    quarter: Math.max(1, Math.ceil(total * 0.25)),
    half: Math.floor(total / 2),
    threeQuarter: Math.max(1, Math.ceil(total * 0.75)),
  }
}

function structuresFoundTenSegmentIndex(
  value: number,
  bounds: { quarter: number; half: number; threeQuarter: number; all: number }
): number {
  if (value < bounds.quarter) return 0
  if (value < bounds.half) return 1
  if (value < bounds.threeQuarter) return 2
  return 3
}

/** Tier values and template source for Custom.structures_found (named milestones beat every-10 on collision). */
export function structuresFoundTierSpecs(
  total: number
): Array<{ value: number; source: StructuresFoundSource }> {
  if (total <= 0) return []
  const best = new Map<number, StructuresFoundSource>()
  const set = (v: number, src: StructuresFoundSource) => {
    if (v <= 0 || v > total) return
    const prev = best.get(v)
    if (!prev || STRUCTURES_FOUND_PRIORITY[src] > STRUCTURES_FOUND_PRIORITY[prev]) {
      best.set(v, src)
    }
  }

  set(total, 'all')
  const halfTh = Math.floor(total / 2)
  if (halfTh > 0 && halfTh < total) set(halfTh, 'half')
  const quarterTh = Math.max(1, Math.ceil(total * 0.25))
  if (quarterTh < total) set(quarterTh, 'quarter')
  const threeQuarterTh = Math.max(1, Math.ceil(total * 0.75))
  if (threeQuarterTh < total) set(threeQuarterTh, 'threeQuarter')

  for (let k = 10; k < total; k += 10) {
    set(k, 'ten')
  }

  return [...best.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, source]) => ({ value, source }))
}

/** Map each `ten` tier value -> DisplayName; empty if no structure sites. */
function buildStructuresFoundTenDisplayNames(total: number): Map<number, string> {
  const result = new Map<number, string>()
  if (total <= 0) return result

  const bounds = { ...structuresFoundMilestoneBounds(total), all: total }
  const tenValues = structuresFoundTierSpecs(total)
    .filter((s) => s.source === 'ten')
    .map((s) => s.value)

  const bySeg: number[][] = [[], [], [], []]
  for (const v of tenValues) {
    bySeg[structuresFoundTenSegmentIndex(v, bounds)].push(v)
  }

  for (let seg = 0; seg < 4; seg++) {
    const sorted = bySeg[seg].sort((a, b) => a - b)
    const m = sorted.length
    if (m === 0) continue
    const pair = STRUCTURES_FOUND_SEGMENT_PAIRS[Math.min(seg, STRUCTURES_FOUND_SEGMENT_PAIRS.length - 1)]
    const nFirst = Math.ceil(m / 2)
    for (let idx = 0; idx < m; idx++) {
      const rank = idx < nFirst ? pair[0] : pair[1]
      const level = idx < nFirst ? idx + 1 : idx - nFirst + 1
      result.set(sorted[idx], `Structure ${rank} ${toRomanLevel(level)}`)
    }
  }

  return result
}

/** Exported for tests. */
export function structuresFoundTenDisplayNames(total: number): Record<number, string> {
  return Object.fromEntries(buildStructuresFoundTenDisplayNames(total))
}

const TOTAL_DISCOVERED_PERCENTS = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100] as const

const TOTAL_DISCOVERED_TITLES = [
  'Wanderer',
  'Scout',
  'Seeker',
  'Pathfinder',
  'Wayfarer',
  'Trailblazer',
  'Pioneer',
  'Outrider',
  'Vanguard',
  'Chronicler',
  'Cartographer',
  'Legend',
] as const

/** Custom.total_discovered tiers: percent milestones vs exploration total (TAB / CE denominator). */
export function generateTotalDiscoveredCustom(
  explorationTotal: number,
  serverName: string
): Record<number, any> | null {
  if (explorationTotal <= 0) return null
  if (TOTAL_DISCOVERED_TITLES.length !== TOTAL_DISCOVERED_PERCENTS.length) {
    throw new Error('TOTAL_DISCOVERED_TITLES and TOTAL_DISCOVERED_PERCENTS must match in length')
  }

  const categoryName = 'total_discovered'
  let lastGoal = 0
  const result: Record<number, any> = {}

  for (let i = 0; i < TOTAL_DISCOVERED_PERCENTS.length; i++) {
    const p = TOTAL_DISCOVERED_PERCENTS[i]
    const title = TOTAL_DISCOVERED_TITLES[i]
    let goal = Math.max(1, Math.ceil((explorationTotal * p) / 100))
    if (goal <= lastGoal) goal = lastGoal + 1
    if (goal > explorationTotal) break

    const article = indefiniteArticleFor(title)
    result[goal] = {
      Message: `${p}% of ${serverName} explored!`,
      Name: `${categoryName}_${p}`,
      DisplayName: title,
      Type: p < 50 ? 'normal' : 'rare',
      Reward: {
        Command: {
          Execute: [
            `lp user PLAYER parent set explorer_${p}`,
            `say §7ALERT: §4PLAYER§7 has become ${article} §4${title.toUpperCase()}§7!`,
          ],
        },
      },
    }
    lastGoal = goal
  }

  return Object.keys(result).length > 0 ? result : null
}

function pickStructuresFoundTemplateEntry(
  templateCategory: Record<string, any>,
  value: number,
  source: StructuresFoundSource
): any {
  if (source === 'quarter' && templateCategory._quarter) return templateCategory._quarter
  if (source === 'half' && templateCategory._half) return templateCategory._half
  if (source === 'threeQuarter' && templateCategory._threeQuarter) return templateCategory._threeQuarter
  if (source === 'all' && templateCategory._all) return templateCategory._all

  const numericKeys = Object.keys(templateCategory)
    .filter(k => !Number.isNaN(Number(k)))
    .map(Number)
    .sort((a, b) => a - b)
  if (numericKeys.length === 0) {
    return (
      templateCategory._all ??
      templateCategory._threeQuarter ??
      templateCategory._half ??
      templateCategory._quarter
    )
  }
  const key = numericKeys.includes(value)
    ? value
    : numericKeys.reduce((prev, curr) =>
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
      )
  return templateCategory[key]
}

function generateStructuresFoundCustom(
  templateCategory: Record<string, any>,
  total: number
): { [tier: number]: any } | null {
  if (total <= 0 || !templateCategory || typeof templateCategory !== 'object') return null

  const specs = structuresFoundTierSpecs(total)
  if (specs.length === 0) return null

  const result: { [tier: number]: any } = {}
  const categoryName = 'structures_found'
  const tenDisplayNames = buildStructuresFoundTenDisplayNames(total)
  const milestoneBounds = { ...structuresFoundMilestoneBounds(total), all: total }

  for (const { value, source } of specs) {
    const templateEntry = pickStructuresFoundTemplateEntry(templateCategory, value, source)
    if (!templateEntry) continue

    const entry = JSON.parse(JSON.stringify(templateEntry))
    entry.Name = `${categoryName}_${value}`

    const claim =
      source === 'ten' ? 100 : source === 'all' ? 500 : 200
    entry.Reward = {
      Command: {
        Execute: [`acb PLAYER +${claim}`],
        Display: `${claim} claimblocks`,
      },
    }

    if (source === 'ten') {
      entry.Message = `You found ${value} structures!`
      entry.DisplayName = tenDisplayNames.get(value) ?? `Structure Wanderer ${toRomanLevel(1)}`
      entry.Type =
        structuresFoundTenSegmentIndex(value, milestoneBounds) === 0 ? 'normal' : 'rare'
    } else if (source === 'quarter') {
      entry.Message = 'You found a quarter of all structures!'
      entry.DisplayName = 'Structure Seeker'
      entry.Type = 'rare'
    } else if (source === 'half') {
      entry.Message = 'You found half of all structures!'
      entry.DisplayName = 'Structure Trailblazer'
      entry.Type = 'rare'
    } else if (source === 'threeQuarter') {
      entry.Message = 'You found three quarters of all structures!'
      entry.DisplayName = 'Structure Vanguard'
      entry.Type = 'rare'
    } else {
      entry.Message = 'You found every structure!'
      entry.DisplayName = 'Structure Legend'
      entry.Type = 'rare'
    }

    ensureRewardCommandDisplayFromCeCalls(entry)
    appendLegendAlertExecute(entry)
    result[value] = entry
  }

  return Object.keys(result).length > 0 ? result : null
}

export type StructureFamiliesMap = Record<string, { label: string; counter: string }>

function countStructureTotalsByType(regions: RegionRecord[]): Record<string, number> {
  const byType: Record<string, number> = {}
  for (const r of regions) {
    if (r.kind !== 'structure' || r.discover.method === 'disabled') continue
    const t = r.structureType
    if (!t) continue
    byType[t] = (byType[t] ?? 0) + 1
  }
  return byType
}

function countStructureSites(regions: RegionRecord[]): number {
  let n = 0
  for (const r of regions) {
    if (r.kind === 'structure' && r.discover.method !== 'disabled') n += 1
  }
  return n
}

function warnStructureFamiliesMismatch(regions: RegionRecord[], structureFamilies?: StructureFamiliesMap): void {
  const orphans = regions.filter(
    (r) =>
      r.kind === 'structure' &&
      r.discover.method !== 'disabled' &&
      r.structureType &&
      (!structureFamilies || !structureFamilies[r.structureType])
  )
  if (orphans.length > 0) {
    console.warn(
      `[AA] ${orphans.length} structure region(s) have no matching regionsMeta.structureFamilies entry; skipping Custom/commands for those families.`
    )
  }
}

/**
 * Generate the owned Custom section categories based on region counts
 * @param serverName Resolved world/server label for messages (default placeholder for tests)
 */
export function generateAACustom(
  regions: RegionRecord[],
  templateConfig: any,
  structureFamilies?: StructureFamiliesMap,
  serverName: string = '{SERVER_NAME}'
): { [category: string]: { [tier: number]: any } } {
  warnStructureFamiliesMismatch(regions, structureFamilies)

  const counts = countRegionsByKind(regions)
  const explorationTotal = computeRegionCounts(regions).total
  const result: { [category: string]: { [tier: number]: any } } = {}
  
  const templateCustom = templateConfig.Custom || {}
  
  // Generate villages_discovered if villages exist
  if (counts.villages > 0 && templateCustom.villages_discovered) {
    const tiers = calculateTiers(VILLAGES_TEMPLATE, counts.villages)
    if (tiers.length > 0) {
      result.villages_discovered = generateCustomCategory(
        templateCustom.villages_discovered,
        tiers,
        VILLAGES_TEMPLATE,
        counts.villages,
        'villages_discovered'
      )
    }
  }
  
  // Generate regions_discovered if regions exist
  if (counts.regions > 0 && templateCustom.regions_discovered) {
    const tiers = calculateTiers(REGIONS_TEMPLATE, counts.regions)
    if (tiers.length > 0) {
      result.regions_discovered = generateCustomCategory(
        templateCustom.regions_discovered,
        tiers,
        REGIONS_TEMPLATE,
        counts.regions,
        'regions_discovered'
      )
    }
  }
  
  // Generate hearts_discovered if hearts exist
  if (counts.hearts > 0 && templateCustom.hearts_discovered) {
    const tiers = calculateTiers(HEARTS_TEMPLATE, counts.hearts)
    if (tiers.length > 0) {
      result.hearts_discovered = generateCustomCategory(
        templateCustom.hearts_discovered,
        tiers,
        HEARTS_TEMPLATE,
        counts.hearts,
        'hearts_discovered'
      )
    }
  }

  if (explorationTotal > 0 && templateCustom.total_discovered != null) {
    const td = generateTotalDiscoveredCustom(explorationTotal, serverName)
    if (td) {
      result.total_discovered = td
    }
  }

  const structureSitesTotal = countStructureSites(regions)
  if (structureSitesTotal > 0 && templateCustom.structures_found) {
    const sf = generateStructuresFoundCustom(templateCustom.structures_found, structureSitesTotal)
    if (sf) {
      result.structures_found = sf
    }
  }

  if (structureFamilies && Object.keys(structureFamilies).length > 0) {
    const byType = countStructureTotalsByType(regions)
    for (const structureType of Object.keys(byType).sort()) {
      const n = byType[structureType]
      if (n <= 0) continue
      const fam = structureFamilies[structureType]
      if (!fam?.counter || !fam.label) continue
      const { counter, label } = fam
      const singularLabel = structureTypeToSingularTitle(structureType)
      const setXp = calculateStructureSetXP(structureType, n)
      const setClaimBlocks = calculateStructureSetClaimBlocks(structureType, n)
      const structureEntry: Record<string, unknown> = {
        Message: `All ${label} Found!`,
        Name: `${counter}_${n}`,
        DisplayName: `${singularLabel} Legend`,
        Type: 'normal',
        Reward: {
          Experience: setXp,
          Command: {
            Execute: [`acb PLAYER +${setClaimBlocks}`],
            Display: `${setClaimBlocks} claimblocks`,
          },
        },
      }
      appendLegendAlertExecute(structureEntry)
      result[counter] = { [n]: structureEntry }
    }
  }
  
  return result
}

/**
 * Merge AA Commands and Custom sections into existing AA config
 * Replaces Commands section entirely and merges Custom section (owned categories only)
 */
export function mergeAAConfig(
  existingConfigPath: string,
  newCommands: AACommandsSection,
  newCustom?: { [category: string]: { [tier: number]: any } }
): string {
  // Read existing config
  const fs = require('fs')
  const content = fs.readFileSync(existingConfigPath, 'utf-8')
  const config = yaml.parse(content)
  
  // Replace Commands section
  config.Commands = newCommands
  
  // Merge Custom section if provided — replace every category the generator emitted (main + structure counters)
  if (newCustom) {
    if (!config.Custom) {
      config.Custom = {}
    }
    for (const category of Object.keys(newCustom).sort()) {
      config.Custom[category] = newCustom[category]
    }
  }
  appendLegendAlertsInCustom(config.Custom)
  
  const { YAML_STRINGIFY_OPTIONS } = require('./utils/yamlOptions')
  return yaml.stringify(config, YAML_STRINGIFY_OPTIONS)
}

// Export tier calculation and command ID for testing and ceGenerator
export {
  calculateTiers,
  VILLAGES_TEMPLATE,
  REGIONS_TEMPLATE,
  HEARTS_TEMPLATE,
  generateCommandId,
}

module.exports = {
  generateAACommands,
  generateAACustom,
  generateTotalDiscoveredCustom,
  mergeAAConfig,
  generateCommandId,
  generateDisplayName,
  calculateTiers,
  VILLAGES_TEMPLATE,
  REGIONS_TEMPLATE,
  HEARTS_TEMPLATE,
  structureTypeToSingularTitle,
  rewardDisplayFromCeExecuteLine,
}
