/**
 * String formatters shared by the Electron main process and the renderer (generators + UI).
 */

/**
 * Convert snake_case to Title Case (with spaces).
 * Keeps "of" lowercase in the middle.
 * Examples: cherrybrook -> Cherrybrook, heart_of_monkvos -> Heart of Monkvos
 */
export function snakeToTitleCase(str: string): string {
  return str
    .split('_')
    .map((word, index) => {
      if (index > 0 && word.toLowerCase() === 'of') {
        return 'of'
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Format region ID for display (same logic as snakeToTitleCase for region IDs).
 */
export function formatRegionTitle(id: string): string {
  return snakeToTitleCase(id)
}

/**
 * Format region for display: use displayNameOverride if set, otherwise formatRegionTitle(id).
 */
export function formatRegionLabel(region: { id: string; discover?: { displayNameOverride?: string } }): string {
  return region.discover?.displayNameOverride ?? formatRegionTitle(region.id)
}

/**
 * Label for `structureType` keys (e.g. ancient_city → Ancient City).
 */
export function formatStructureTypeLabel(structureType: string): string {
  if (structureType === 'unknown') return 'Unknown type'
  return structureType
    .split('_')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Sanitize server name for use in file paths and build output.
 * Lowercase, replace non-alphanumeric with hyphen.
 */
export function sanitizeServerName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-')
}
