/**
 * Shared string formatters for renderer (React) code.
 */

/**
 * Format region ID for display (snake_case to Title Case).
 * Keeps "of" lowercase in the middle (e.g. heart_of_monkvos -> Heart of Monkvos).
 */
export function formatRegionTitle(id: string): string {
  return id
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
