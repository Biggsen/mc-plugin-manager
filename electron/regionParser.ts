const yaml = require('yaml')
const { readFileSync, statSync } = require('fs')
const { createHash } = require('crypto')

type RegionForgeExport = {
  regions: {
    [regionId: string]: {
      type?: 'cuboid' | 'poly2d'
      flags?: {
        greeting?: string
        farewell?: string
        [key: string]: any
      }
      parent?: string
      priority?: number
      [key: string]: any
    }
  }
}

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

interface ImportedSource {
  label: string
  originalFilename: string
  importedAtIso: string
  fileHash: string
  spawnCenter?: {
    world: string
    x: number
    z: number
  }
}

interface OnboardingConfig {
  startRegionId: string
  teleport: {
    world: string
    x: number
    y: number
    z: number
    yaw?: number
    pitch?: number
  }
}

/**
 * Canonicalize region ID: lowercase, preserve snake_case structure
 */
function canonicalizeId(id: string): string {
  return id.toLowerCase()
}

/**
 * Calculate file hash for tracking imports
 */
function calculateFileHash(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex').substring(0, 16)
}

/**
 * Parse Region Forge YAML file
 */
function parseRegionFile(filePath: string): RegionForgeExport {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = yaml.parse(content)
    
    if (!parsed || !parsed.regions) {
      throw new Error('Invalid Region Forge format: missing "regions" key')
    }
    
    return parsed as RegionForgeExport
  } catch (error: any) {
    throw new Error(`Failed to parse YAML file: ${error.message}`)
  }
}

/**
 * Classify a single region based on the classification rules
 */
function classifyRegion(
  regionId: string,
  regionData: RegionForgeExport['regions'][string],
  world: 'overworld' | 'nether',
  onboarding: OnboardingConfig
): RegionRecord {
  const canonicalId = canonicalizeId(regionId)
  
  // 1. System regions
  if (canonicalId === 'spawn') {
    return {
      world,
      id: canonicalId,
      kind: 'system',
      discover: {
        method: 'disabled',
        recipeId: 'none',
      },
    }
  }
  
  // 2. Hearts
  if (canonicalId.startsWith('heart_of_')) {
    return {
      world,
      id: canonicalId,
      kind: 'heart',
      discover: {
        method: 'on_enter',
        recipeId: world === 'overworld' ? 'heart' : 'nether_heart',
      },
    }
  }
  
  // 3. First-join region
  const isFirstJoin = onboarding.startRegionId && canonicalId === canonicalizeId(onboarding.startRegionId)
  if (isFirstJoin) {
    return {
      world,
      id: canonicalId,
      kind: 'region', // First-join regions are regular regions, not system
      discover: {
        method: 'first_join',
        recipeId: world === 'overworld' ? 'region' : 'nether_region',
      },
    }
  }
  
  // 4. Regular regions (check for village)
  const greeting = regionData.flags?.greeting || ''
  const isVillage = greeting.toLowerCase().includes('village')
  
  return {
    world,
    id: canonicalId,
    kind: isVillage ? 'village' : 'region',
    discover: {
      method: 'on_enter',
      recipeId: world === 'overworld' ? 'region' : 'nether_region',
    },
  }
}

/**
 * Import regions from a Region Forge export file
 */
export function importRegions(
  filePath: string,
  world: 'overworld' | 'nether',
  existingRegions: RegionRecord[],
  onboarding: OnboardingConfig
): {
  regions: RegionRecord[]
  source: ImportedSource
} {
  // Parse the file
  const regionData = parseRegionFile(filePath)
  
  // Get file metadata
  const stats = statSync(filePath)
  const fileHash = calculateFileHash(filePath)
  const importedAt = new Date().toISOString()
  const filename = require('path').basename(filePath)
  
  // Calculate spawn center if spawn region exists
  let spawnCenter: { world: string; x: number; z: number } | undefined
  const spawnRegion = regionData.regions['spawn']
  if (spawnRegion && spawnRegion.type === 'cuboid' && spawnRegion.min && spawnRegion.max) {
    const min = spawnRegion.min
    const max = spawnRegion.max
    const x = Math.floor((min.x + max.x) / 2)
    const z = Math.floor((min.z + max.z) / 2)
    
    // Extract world name from path or default to "world"
    // Path format: .../worlds/{worldName}/regions.yml
    const pathParts = filePath.split(/[/\\]/)
    const worldsIndex = pathParts.findIndex((part: string) => part === 'worlds')
    const worldName = worldsIndex >= 0 && worldsIndex < pathParts.length - 1 
      ? pathParts[worldsIndex + 1] 
      : 'world'
    
    spawnCenter = { world: worldName, x, z }
  }
  
  // Remove existing regions from this world
  const otherWorldRegions = existingRegions.filter((r) => r.world !== world)
  
  // Process each region
  const newRegions: RegionRecord[] = []
  for (const [regionId, regionInfo] of Object.entries(regionData.regions)) {
    const classified = classifyRegion(regionId, regionInfo, world, onboarding)
    newRegions.push(classified)
  }
  
  // Combine: other worlds + new regions (last import wins for duplicates)
  const regionMap = new Map<string, RegionRecord>()
  
  // Add existing regions from other worlds
  for (const region of otherWorldRegions) {
    regionMap.set(`${region.world}:${region.id}`, region)
  }
  
  // Add/overwrite with new regions (this handles de-duplication)
  for (const region of newRegions) {
    regionMap.set(`${region.world}:${region.id}`, region)
  }
  
  const allRegions = Array.from(regionMap.values())
  
  return {
    regions: allRegions,
    source: {
      label: world,
      originalFilename: filename,
      importedAtIso: importedAt,
      fileHash,
      spawnCenter,
    },
  }
}

module.exports = { importRegions }
