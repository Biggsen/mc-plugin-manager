const yaml = require('yaml')
const { readFileSync } = require('fs')

import type { RegionRecord } from './types'
import { snakeToTitleCase } from './shared/stringFormatters'

interface LevelledMobsMeta {
  villageBandStrategy?: string
  regionBands?: Record<string, string>
}

interface OwnedLMRules {
  villagesRule?: any
  regionBandRules: any[]
}

/**
 * Title-case a single word (for difficulty)
 */
function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Map canonical world to LevelledMobs world name
 */
function mapWorldForLM(world: 'overworld' | 'nether' | 'end'): string {
  if (world === 'nether') {
    return 'world_nether'
  }
  if (world === 'end') {
    return 'world_the_end'
  }
  return 'world'
}

/**
 * Generate owned LevelledMobs rules
 */
export function generateOwnedLMRules(
  regions: RegionRecord[],
  levelledMobs?: LevelledMobsMeta,
  availableDropTableIds?: Set<string>
): OwnedLMRules {
  const result: OwnedLMRules = {
    regionBandRules: [],
  }

  // 1. Generate Villages band rule
  const villages = regions.filter((r) => r.kind === 'village')
  if (villages.length > 0) {
    const strategy = (levelledMobs?.villageBandStrategy || 'easy').toLowerCase()
    const strategyTitle = titleCase(strategy)
    const villageIds = villages.map((v) => v.id).sort()

    result.villagesRule = {
      'custom-rule': `Villages - ${strategyTitle} Band`,
      'is-enabled': true,
      'use-preset': `lvlstrategy-${strategy}`,
      conditions: {
        worlds: 'world', // Default to overworld world name
        entities: {
          'included-groups': ['all_hostile_mobs'],
        },
        'worldguard-regions': villageIds,
      },
    }
  }

  // 2. Generate region-band rules for regions, hearts, and water bodies (overworld + nether + end)
  const validDifficulties = ['easy', 'normal', 'hard', 'severe', 'deadly']
  const defaultDifficulty = 'normal'
  const regionBands = levelledMobs?.regionBands ?? {}

  const bandRegions = regions.filter(
    (r) => r.kind === 'region' || r.kind === 'heart' || r.kind === 'water'
  )
  for (const region of bandRegions) {
    const difficultyRaw = regionBands[region.id] ?? defaultDifficulty
    const difficulty = validDifficulties.includes(difficultyRaw.toLowerCase())
      ? difficultyRaw.toLowerCase()
      : defaultDifficulty

    const regionName = snakeToTitleCase(region.id)
    const difficultyTitle = titleCase(difficulty)
    const worldName = mapWorldForLM(region.world)
    const category = String(region.category ?? '').trim().toLowerCase()
    const useDropTableId =
      category.length > 0 && availableDropTableIds?.has(category) ? category : undefined
    const generatedRule: Record<string, unknown> = {
      'custom-rule': `${regionName} - ${difficultyTitle}`,
      'is-enabled': true,
      'use-preset': `lvlstrategy-${difficulty}`,
      conditions: {
        worlds: worldName,
        'worldguard-regions': region.id,
      },
    }
    if (useDropTableId) {
      generatedRule.settings = {
        'use-droptable-id': useDropTableId,
      }
    }

    result.regionBandRules.push(generatedRule)
  }

  result.regionBandRules.sort((a, b) => {
    const nameA = a['custom-rule'] || ''
    const nameB = b['custom-rule'] || ''
    return nameA.localeCompare(nameB)
  })

  return result
}

/**
 * Identify owned rules in custom-rules array
 */
function identifyOwnedRules(customRules: any[]): {
  owned: any[]
  preserved: any[]
} {
  const owned: any[] = []
  const preserved: any[] = []

  for (const rule of customRules) {
    if (!rule.conditions || !rule.conditions['worldguard-regions']) {
      // No worldguard-regions, definitely preserved
      preserved.push(rule)
      continue
    }

    const wgRegions = rule.conditions['worldguard-regions']
    const usePreset = rule['use-preset'] || ''

    // Villages rule: worldguard-regions is an array
    if (Array.isArray(wgRegions)) {
      owned.push(rule)
      continue
    }

    // Region-band rule: worldguard-regions is a string AND use-preset matches pattern
    if (typeof wgRegions === 'string') {
      const isLvlStrategy = /^lvlstrategy-(easy|normal|hard|severe|deadly)$/.test(usePreset)
      if (isLvlStrategy) {
        owned.push(rule)
        continue
      }
    }

    // Not owned, preserve
    preserved.push(rule)
  }

  return { owned, preserved }
}

/**
 * Merge LevelledMobs config with generated rules
 */
export function mergeLMConfig(
  existingPath: string,
  owned: OwnedLMRules
): string {
  // Read existing content
  const existingContent = readFileSync(existingPath, 'utf-8')
  
  // Parse as document to preserve structure
  const doc = yaml.parseDocument(existingContent)
  const config = doc.toJS()

  if (!config) {
    throw new Error('Failed to parse existing LevelledMobs config')
  }

  // Ensure custom-rules exists
  if (!Array.isArray(config['custom-rules'])) {
    config['custom-rules'] = []
  }

  // Identify owned vs preserved rules
  const { owned: existingOwned, preserved } = identifyOwnedRules(config['custom-rules'])

  // Build new custom-rules: preserved first, then generated
  const newCustomRules: any[] = [...preserved]

  // Add generated rules: Villages first (if present), then region-bands
  if (owned.villagesRule) {
    newCustomRules.push(owned.villagesRule)
  }
  newCustomRules.push(...owned.regionBandRules)

  // Update custom-rules in the document
  if (doc.contents && typeof doc.contents === 'object') {
    const contents = doc.contents as any
    
    // Find custom-rules key and update it
    if (contents.items && Array.isArray(contents.items)) {
      for (const item of contents.items) {
        if (item && item.key && item.key.value === 'custom-rules') {
          item.value = doc.createNode(newCustomRules)
          break
        }
      }
    } else if (contents.get) {
      // YAMLMap interface
      contents.set('custom-rules', doc.createNode(newCustomRules))
    }
  }

  // Stringify with double-quoted strings so apostrophes in names (e.g. Mor'gath) need no escaping
  return doc.toString({
    indent: 2,
    lineWidth: 0,
    simpleKeys: false,
    doubleQuotedAsJSON: false,
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  })
}

module.exports = { generateOwnedLMRules, mergeLMConfig }
