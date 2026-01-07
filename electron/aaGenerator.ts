const yaml = require('yaml')

interface RegionRecord {
  world: 'overworld' | 'nether'
  id: string
  kind: 'system' | 'region' | 'village' | 'heart'
  discover: {
    method: 'disabled' | 'on_enter' | 'first_join'
    recipeId: 'region' | 'heart' | 'nether_region' | 'nether_heart' | 'none'
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
 * Examples:
 * - cherrybrook -> Cherrybrook
 * - heart_of_monkvos -> Heart Of Monkvos
 */
function snakeToTitleCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Convert command ID (camelCase) to snake_case for Name field
 * Examples:
 * - discoverWarriotos -> discover_warriotos
 * - discoverHeartOfWarriotos -> discover_heart_of_warriotos
 */
function commandIdToSnakeCase(commandId: string): string {
  // Insert underscore before capital letters (including after "discover")
  const withUnderscores = commandId.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  
  return withUnderscores
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
 * - Hearts: Keep full name (heart_of_warriotos -> discoverHeartOfWarriotos)
 * - Nether regions with "of": "of" stays lowercase in the middle
 *   (ebon_of_wither -> discoverEbonofWither)
 */
function generateCommandId(regionId: string): string {
  // Split by underscores
  const parts = regionId.split('_')
  
  // Convert each part, but keep "of" lowercase (except at start)
  const convertedParts = parts.map((part, index) => {
    if (index > 0 && part.toLowerCase() === 'of') {
      // Keep "of" lowercase in the middle
      return 'of'
    }
    // Capitalize first letter, lowercase rest
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
    const nameSnakeCase = commandIdToSnakeCase(commandId)
    
    // Generate Goal, Message, and DisplayName based on region kind and world
    let goal: string
    let message: string
    let displayName: string
    
    if (region.kind === 'heart') {
      goal = `Discover the Heart of ${regionName}`
      message = `You discovered the Heart of ${regionName}`
      displayName = 'Heart Discovery'
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
