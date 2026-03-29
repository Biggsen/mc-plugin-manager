import { stripGeneratorVersionCommentLines } from './utils/generatorVersionHeader'

const yaml = require('yaml')
const { readFileSync } = require('fs')

/**
 * Remove owned sections from AA config for comparison
 * Owned sections:
 * - Commands (entire section)
 * - Custom.villages_discovered
 * - Custom.regions_discovered
 * - Custom.hearts_discovered
 * - Custom.<counter> for structure families (keys ending in _found, e.g. ancient_cities_found)
 */
function removeOwnedAASections(config: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...config } as Record<string, unknown>
  
  delete cleaned.Commands
  
  if (cleaned.Custom && typeof cleaned.Custom === 'object' && !Array.isArray(cleaned.Custom)) {
    cleaned.Custom = { ...(cleaned.Custom as Record<string, unknown>) }
    const custom = cleaned.Custom as Record<string, unknown>
    delete custom.villages_discovered
    delete custom.regions_discovered
    delete custom.hearts_discovered
    for (const k of Object.keys(custom)) {
      if (/_found$/.test(k)) {
        delete custom[k]
      }
    }
  }
  
  return cleaned
}

function removeOwnedCESections(config: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...config } as Record<string, unknown>
  
  if (cleaned.Events && typeof cleaned.Events === 'object' && !Array.isArray(cleaned.Events)) {
    const cleanedEvents: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(cleaned.Events)) {
      // Owned events:
      // - *_discover_once
      // - region_heart_discover_once
      // - first_join
      // - join_log
      // - leave_log
      // Relocated to `events/enchantments.yml`:
      // - get_book_* (CALL enchanted book rewards)
      const isOwned =
        key.endsWith('_discover_once') ||
        key === 'region_heart_discover_once' ||
        key === 'first_join' ||
        key === 'join_log' ||
        key === 'leave_log'
      const isEnchantmentFragment = key.startsWith('get_book_')

      if (!isOwned && !isEnchantmentFragment) {
        cleanedEvents[key] = value
      }
    }
    
    cleaned.Events = cleanedEvents
  }
  
  return cleaned
}

function removeOwnedTABSections(config: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...config } as Record<string, unknown>
  
  if (cleaned['header-footer'] && typeof cleaned['header-footer'] === 'object' && !Array.isArray(cleaned['header-footer'])) {
    const cleanedHeaderFooter = { ...(cleaned['header-footer'] as Record<string, unknown>) }
    delete cleanedHeaderFooter.header
    delete cleanedHeaderFooter.footer
    const designs = cleanedHeaderFooter.designs as Record<string, unknown> | undefined
    if (designs && typeof designs === 'object' && designs.default && typeof designs.default === 'object') {
      const def = { ...(designs.default as Record<string, unknown>) }
      delete def.header
      delete def.footer
      designs.default = def
    }
    if (Object.keys(cleanedHeaderFooter).length === 0) {
      delete cleaned['header-footer']
    } else {
      cleaned['header-footer'] = cleanedHeaderFooter
    }
  }
  
  // Remove all scoreboard sections (entire scoreboards section is owned/replaced)
  // Also normalize enabled field since we always set it to true
  if (cleaned.scoreboard && typeof cleaned.scoreboard === 'object') {
    const sb = cleaned.scoreboard as Record<string, unknown>
    if (sb.scoreboards) delete sb.scoreboards
    sb.enabled = true
  }
  
  if (cleaned.conditions && typeof cleaned.conditions === 'object' && !Array.isArray(cleaned.conditions)) {
    const cleanedConditions: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(cleaned.conditions as Record<string, unknown>)) {
      // Owned conditions:
      // - top-explorers-title, top-explorer-1 through top-explorer-5
      // - region-name-easy, region-name-normal, region-name-hard, region-name-severe, region-name-deadly
      // - structure-name, village-name (mergeTABConfig regenerates from profile; normalize via static block below)
      const isOwned =
        key === 'top-explorers-title' ||
        key === 'top-explorer-1' ||
        key === 'top-explorer-2' ||
        key === 'top-explorer-3' ||
        key === 'top-explorer-4' ||
        key === 'top-explorer-5' ||
        key === 'region-name-easy' ||
        key === 'region-name-normal' ||
        key === 'region-name-hard' ||
        key === 'region-name-severe' ||
        key === 'region-name-deadly' ||
        key === 'structure-name' ||
        key === 'village-name'
      
      if (!isOwned) {
        cleanedConditions[key] = value
      }
    }
    cleaned.conditions = cleanedConditions
  } else {
    cleaned.conditions = {}
  }

  // Normalize static conditions (add if missing, same as in mergeTABConfig)
  // This ensures both original and generated configs have the same static conditions
  const staticConditions = {
    'region-name': {
      conditions: ['%worldguard_region_name_2%!='],
      type: 'AND',
      true: '%capitalize_pascal-case-forced_{worldguard_region_name_2}%',
      false: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%',
    },
    'village-name': {
      conditions: [
        '%worldguard_region_name_2%!=',
        '%worldguard_region_name_1%!=%worldguard_region_name_2%',
        '%worldguard_region_name_1%!=spawn',
      ],
      type: 'AND',
      true: '%condition:heart-region%',
      false: '-',
    },
    'heart-region': {
      conditions: ['%worldguard_region_name_1%|-heart'],
      true: '-',
      false: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%',
    },
  }

  const conditions = cleaned.conditions as Record<string, unknown>
  for (const [key, value] of Object.entries(staticConditions)) {
    if (!conditions[key]) conditions[key] = value
  }
  
  return cleaned
}

function deepEqual(a: unknown, b: unknown, path: string = ''): { equal: boolean; differences: string[] } {
  const differences: string[] = []
  
  if (a === b) {
    return { equal: true, differences }
  }
  
  if (a == null || b == null) {
    differences.push(`${path}: ${a} !== ${b}`)
    return { equal: false, differences }
  }
  
  if (typeof a !== typeof b) {
    differences.push(`${path}: type mismatch (${typeof a} vs ${typeof b})`)
    return { equal: false, differences }
  }
  
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    differences.push(`${path}: ${String(a)} !== ${String(b)}`)
    return { equal: false, differences }
  }
  
  if (Array.isArray(a) !== Array.isArray(b)) {
    differences.push(`${path}: array vs non-array mismatch`)
    return { equal: false, differences }
  }
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      differences.push(`${path}: array length mismatch (${a.length} vs ${b.length})`)
      return { equal: false, differences }
    }
    
    for (let i = 0; i < a.length; i++) {
      const result = deepEqual(a[i], b[i], `${path}[${i}]`)
      if (!result.equal) {
        differences.push(...result.differences)
      }
    }
  } else {
    const oa = a as Record<string, unknown>
    const ob = b as Record<string, unknown>
    const keysA = Object.keys(oa).sort()
    const keysB = Object.keys(ob).sort()
    
    if (keysA.length !== keysB.length) {
      differences.push(`${path}: object key count mismatch (${keysA.length} vs ${keysB.length})`)
    }
    
    const allKeys = new Set([...keysA, ...keysB])
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key
      if (!(key in oa)) {
        differences.push(`${newPath}: missing in original`)
      } else if (!(key in ob)) {
        differences.push(`${newPath}: missing in generated`)
      } else {
        const result = deepEqual(oa[key], ob[key], newPath)
        if (!result.equal) {
          differences.push(...result.differences)
        }
      }
    }
  }
  
  return {
    equal: differences.length === 0,
    differences,
  }
}

/**
 * Validate that only owned sections changed in AA config
 */
export function validateAADiff(
  originalPath: string,
  generatedContent: string
): { valid: boolean; error?: string; differences?: string[] } {
  try {
    // Read and parse original
    const originalContent = stripGeneratorVersionCommentLines(readFileSync(originalPath, 'utf-8'))
    const original = yaml.parse(originalContent)
    const originalCleaned = removeOwnedAASections(original)
    
    // Parse generated
    const generated = yaml.parse(stripGeneratorVersionCommentLines(generatedContent))
    const generatedCleaned = removeOwnedAASections(generated)
    
    // Compare
    const result = deepEqual(originalCleaned, generatedCleaned)
    
    if (!result.equal) {
      return {
        valid: false,
        error: 'Non-owned sections changed in AdvancedAchievements config',
        differences: result.differences,
      }
    }
    
    return { valid: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { valid: false, error: `Failed to validate AA diff: ${msg}` }
  }
}

/**
 * Validate that only owned sections changed in CE config
 */
export function validateCEDiff(
  originalPath: string,
  generatedContent: string
): { valid: boolean; error?: string; differences?: string[] } {
  try {
    // Read and parse original
    const originalContent = stripGeneratorVersionCommentLines(readFileSync(originalPath, 'utf-8'))
    const original = yaml.parse(originalContent)
    const originalCleaned = removeOwnedCESections(original)
    
    // Parse generated
    const generated = yaml.parse(stripGeneratorVersionCommentLines(generatedContent))
    const generatedCleaned = removeOwnedCESections(generated)
    
    // Compare
    const result = deepEqual(originalCleaned, generatedCleaned)
    
    if (!result.equal) {
      return {
        valid: false,
        error: 'Non-owned sections changed in ConditionalEvents config',
        differences: result.differences,
      }
    }
    
    return { valid: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { valid: false, error: `Failed to validate CE diff: ${msg}` }
  }
}

/**
 * Validate that only owned sections changed in TAB config
 */
export function validateTABDiff(
  originalPath: string,
  generatedContent: string
): { valid: boolean; error?: string; differences?: string[] } {
  try {
    // Read and parse original
    const originalContent = stripGeneratorVersionCommentLines(readFileSync(originalPath, 'utf-8'))
    const original = yaml.parse(originalContent)
    const originalCleaned = removeOwnedTABSections(original)
    
    // Parse generated
    const generated = yaml.parse(stripGeneratorVersionCommentLines(generatedContent))
    const generatedCleaned = removeOwnedTABSections(generated)
    
    // Compare
    const result = deepEqual(originalCleaned, generatedCleaned)
    
    if (!result.equal) {
      return {
        valid: false,
        error: 'Non-owned sections changed in TAB config',
        differences: result.differences,
      }
    }
    
    return { valid: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { valid: false, error: `Failed to validate TAB diff: ${msg}` }
  }
}

function removeOwnedLMSections(config: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...config } as Record<string, unknown>
  
  if (cleaned['custom-rules'] && Array.isArray(cleaned['custom-rules'])) {
    const cleanedRules: unknown[] = []
    
    for (const rule of cleaned['custom-rules'] as unknown[]) {
      const r = rule as Record<string, unknown>
      const cond = r.conditions as Record<string, unknown> | undefined
      if (!cond || !cond['worldguard-regions']) {
        cleanedRules.push(rule)
        continue
      }
      const wgRegions = cond['worldguard-regions']
      const usePreset = String(r['use-preset'] ?? '')

      // Owned rules:
      // 1. Villages band: worldguard-regions is an array
      // 2. Region-band: worldguard-regions is a string AND use-preset matches lvlstrategy-*
      const isVillagesBand = Array.isArray(wgRegions)
      const isRegionBand = typeof wgRegions === 'string' && /^lvlstrategy-(easy|normal|hard|severe|deadly)$/.test(usePreset)

      if (!isVillagesBand && !isRegionBand) {
        // Not owned, preserve
        cleanedRules.push(rule)
      }
      // Otherwise, drop it (it's owned)
    }
    
    cleaned['custom-rules'] = cleanedRules
  }
  
  return cleaned
}

/**
 * Validate that only owned sections changed in LevelledMobs config
 */
export function validateLMDiff(
  originalPath: string,
  generatedContent: string
): { valid: boolean; error?: string; differences?: string[] } {
  try {
    // Read and parse original
    const originalContent = stripGeneratorVersionCommentLines(readFileSync(originalPath, 'utf-8'))
    const original = yaml.parse(originalContent)
    const originalCleaned = removeOwnedLMSections(original)
    
    // Parse generated
    const generated = yaml.parse(stripGeneratorVersionCommentLines(generatedContent))
    const generatedCleaned = removeOwnedLMSections(generated)
    
    // Compare
    const result = deepEqual(originalCleaned, generatedCleaned)
    
    if (!result.equal) {
      return {
        valid: false,
        error: 'Non-owned sections changed in LevelledMobs config',
        differences: result.differences,
      }
    }
    
    return { valid: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { valid: false, error: `Failed to validate LM diff: ${msg}` }
  }
}

