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
 * Merge AA Commands section into existing AA config
 * Replaces the entire Commands section while preserving everything else
 */
export function mergeAAConfig(
  existingConfigPath: string,
  newCommands: AACommandsSection
): string {
  // Read existing config
  const fs = require('fs')
  const content = fs.readFileSync(existingConfigPath, 'utf-8')
  const config = yaml.parse(content)
  
  // Replace Commands section
  config.Commands = newCommands
  
  // Stringify with proper formatting (2-space indentation)
  return yaml.stringify(config, {
    indent: 2,
    lineWidth: 0,
    simpleKeys: false,
  })
}

module.exports = {
  generateAACommands,
  mergeAAConfig,
  generateCommandId,
  generateDisplayName,
}
