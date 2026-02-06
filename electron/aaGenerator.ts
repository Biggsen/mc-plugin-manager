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

interface AACommand {
  Goal: string
  Message: string
  Name: string
  DisplayName: string
  Type: string
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

const HALF_COLLISION_THRESHOLD = 5
const ALL_COLLISION_THRESHOLD = 4

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

  const values = [...new Set(filtered.map(t => t.value))].sort((a, b) => a - b)

  if (half === total && values.includes(half)) {
    return values.filter(v => v === total || v < half)
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
 * Convert snake_case to Title Case (with spaces)
 * Keeps "of" lowercase in the middle
 * Examples:
 * - cherrybrook -> Cherrybrook
 * - heart_of_monkvos -> Heart of Monkvos
 * - ebon_of_wither -> Ebon of Wither
 */
function snakeToTitleCase(str: string): string {
  return str
    .split('_')
    .map((word, index) => {
      // Keep "of" lowercase (except at start)
      if (index > 0 && word.toLowerCase() === 'of') {
        return 'of'
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
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
 * Generate AA Commands section from region records
 */
export function generateAACommands(regions: RegionRecord[]): AACommandsSection {
  const commands: AACommandsSection = {}
  
  // Filter to only regions where discover.method != "disabled"
  const activeRegions = regions.filter((r) => r.discover.method !== 'disabled')
  
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
    
    if (region.kind === 'heart') {
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
    commands[commandId] = {
      Goal: goal,
      Message: message,
      Name: nameSnakeCase,
      DisplayName: displayName,
      Type: 'normal',
    }
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
    
    result[tierValue] = entry
  }
  
  return result
}

/**
 * Generate the owned Custom section categories based on region counts
 */
export function generateAACustom(
  regions: RegionRecord[],
  templateConfig: any
): { [category: string]: { [tier: number]: any } } {
  const counts = countRegionsByKind(regions)
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
  
  // Merge Custom section if provided
  if (newCustom) {
    if (!config.Custom) {
      config.Custom = {}
    }
    
    // Replace only owned categories, preserve others
    const ownedCategories = ['villages_discovered', 'regions_discovered', 'hearts_discovered']
    for (const category of ownedCategories) {
      if (newCustom[category]) {
        config.Custom[category] = newCustom[category]
      }
    }
  }
  
  // Stringify with proper formatting (2-space indentation)
  return yaml.stringify(config, {
    indent: 2,
    lineWidth: 0,
    simpleKeys: false,
  })
}

// Export tier calculation for testing
export { calculateTiers, VILLAGES_TEMPLATE, REGIONS_TEMPLATE, HEARTS_TEMPLATE }

module.exports = {
  generateAACommands,
  generateAACustom,
  mergeAAConfig,
  generateCommandId,
  generateDisplayName,
  calculateTiers,
  VILLAGES_TEMPLATE,
  REGIONS_TEMPLATE,
  HEARTS_TEMPLATE,
}
