const yaml = require('yaml')
const { readFileSync } = require('fs')

/**
 * Remove owned sections from AA config for comparison
 */
function removeOwnedAASections(config: any): any {
  const cleaned = { ...config }
  // Remove Commands section (owned)
  delete cleaned.Commands
  return cleaned
}

/**
 * Remove owned sections from CE config for comparison
 */
function removeOwnedCESections(config: any): any {
  const cleaned = { ...config }
  
  if (cleaned.Events) {
    const cleanedEvents: any = {}
    
    // Keep only non-owned events
    for (const [key, value] of Object.entries(cleaned.Events)) {
      // Owned events:
      // - *_discover_once
      // - region_heart_discover_once
      // - first_join
      const isOwned =
        key.endsWith('_discover_once') ||
        key === 'region_heart_discover_once' ||
        key === 'first_join'
      
      if (!isOwned) {
        cleanedEvents[key] = value
      }
    }
    
    cleaned.Events = cleanedEvents
  }
  
  return cleaned
}

/**
 * Remove owned sections from TAB config for comparison
 */
function removeOwnedTABSections(config: any): any {
  const cleaned = { ...config }
  
  // Remove owned header-footer sections
  if (cleaned['header-footer']) {
    const cleanedHeaderFooter = { ...cleaned['header-footer'] }
    delete cleanedHeaderFooter.header
    delete cleanedHeaderFooter.footer
    if (Object.keys(cleanedHeaderFooter).length === 0) {
      delete cleaned['header-footer']
    } else {
      cleaned['header-footer'] = cleanedHeaderFooter
    }
  }
  
  // Remove all scoreboard sections (entire scoreboards section is owned/replaced)
  // Also normalize enabled field since we always set it to true
  if (cleaned.scoreboard) {
    if (cleaned.scoreboard.scoreboards) {
      // Remove the entire scoreboards object since we replace it entirely with generated ones
      delete cleaned.scoreboard.scoreboards
    }
    // Normalize enabled field (we always set it to true)
    cleaned.scoreboard.enabled = true
  }
  
  // Remove owned conditions
  if (cleaned.conditions) {
    const cleanedConditions: any = {}
    for (const [key, value] of Object.entries(cleaned.conditions)) {
      // Owned conditions:
      // - top-explorers-title
      // - top-explorer-1 through top-explorer-5
      const isOwned =
        key === 'top-explorers-title' ||
        key === 'top-explorer-1' ||
        key === 'top-explorer-2' ||
        key === 'top-explorer-3' ||
        key === 'top-explorer-4' ||
        key === 'top-explorer-5'
      
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
      conditions: ["%worldguard_region_name_2%!='"],
      type: 'AND',
      yes: '%capitalize_pascal-case-forced_{worldguard_region_name_2}%',
      no: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%',
    },
    'village-name': {
      conditions: [
        "%worldguard_region_name_2%!='",
        '%worldguard_region_name_1%!=%worldguard_region_name_2%',
        "%worldguard_region_name_1%!=spawn",
      ],
      type: 'AND',
      yes: '%condition:heart-region%',
      no: '-',
    },
    'heart-region': {
      conditions: ["%worldguard_region_name_1%|-heart"],
      yes: '-',
      no: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%',
    },
  }

  // Add static conditions if missing (normalize both configs)
  for (const [key, value] of Object.entries(staticConditions)) {
    if (!cleaned.conditions[key]) {
      cleaned.conditions[key] = value
    }
  }
  
  return cleaned
}

/**
 * Deep equality check (handles objects, arrays, primitives)
 */
function deepEqual(a: any, b: any, path: string = ''): { equal: boolean; differences: string[] } {
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
  
  if (typeof a !== 'object') {
    differences.push(`${path}: ${a} !== ${b}`)
    return { equal: false, differences }
  }
  
  if (Array.isArray(a) !== Array.isArray(b)) {
    differences.push(`${path}: array vs non-array mismatch`)
    return { equal: false, differences }
  }
  
  if (Array.isArray(a)) {
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
    // Object comparison
    const keysA = Object.keys(a).sort()
    const keysB = Object.keys(b).sort()
    
    if (keysA.length !== keysB.length) {
      differences.push(`${path}: object key count mismatch (${keysA.length} vs ${keysB.length})`)
    }
    
    const allKeys = new Set([...keysA, ...keysB])
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key
      if (!(key in a)) {
        differences.push(`${newPath}: missing in original`)
      } else if (!(key in b)) {
        differences.push(`${newPath}: missing in generated`)
      } else {
        const result = deepEqual(a[key], b[key], newPath)
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
    const originalContent = readFileSync(originalPath, 'utf-8')
    const original = yaml.parse(originalContent)
    const originalCleaned = removeOwnedAASections(original)
    
    // Parse generated
    const generated = yaml.parse(generatedContent)
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
  } catch (error: any) {
    return {
      valid: false,
      error: `Failed to validate AA diff: ${error.message}`,
    }
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
    const originalContent = readFileSync(originalPath, 'utf-8')
    const original = yaml.parse(originalContent)
    const originalCleaned = removeOwnedCESections(original)
    
    // Parse generated
    const generated = yaml.parse(generatedContent)
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
  } catch (error: any) {
    return {
      valid: false,
      error: `Failed to validate CE diff: ${error.message}`,
    }
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
    const originalContent = readFileSync(originalPath, 'utf-8')
    const original = yaml.parse(originalContent)
    const originalCleaned = removeOwnedTABSections(original)
    
    // Parse generated
    const generated = yaml.parse(generatedContent)
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
  } catch (error: any) {
    return {
      valid: false,
      error: `Failed to validate TAB diff: ${error.message}`,
    }
  }
}

module.exports = { validateAADiff, validateCEDiff, validateTABDiff }
