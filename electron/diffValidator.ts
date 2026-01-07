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

module.exports = { validateAADiff, validateCEDiff }
