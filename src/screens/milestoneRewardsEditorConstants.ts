import type { AAMilestoneCategoryKey, AAMilestoneCategorySlots } from '../types'

export const MILESTONE_CATEGORY_ORDER: AAMilestoneCategoryKey[] = [
  'regions_discovered',
  'villages_discovered',
  'hearts_discovered',
  'nerves_discovered',
  'nether_regions_discovered',
  'nether_hearts_discovered',
  'structures_found',
]

export const MILESTONE_CATEGORY_LABELS: Record<AAMilestoneCategoryKey, string> = {
  villages_discovered: 'Villages discovered',
  regions_discovered: 'Regions discovered',
  hearts_discovered: 'Hearts discovered',
  nerves_discovered: 'Nerves discovered',
  nether_regions_discovered: 'Nether regions discovered',
  nether_hearts_discovered: 'Nether hearts discovered',
  structures_found: 'Structures found (rollup)',
}

export type MilestoneSlotKey = keyof AAMilestoneCategorySlots

export const SLOTS_BY_CATEGORY: Record<AAMilestoneCategoryKey, MilestoneSlotKey[]> = {
  villages_discovered: ['first', 'half', 'all'],
  regions_discovered: ['first', 'half', 'all'],
  hearts_discovered: ['first', 'half', 'all'],
  nerves_discovered: ['first', 'half', 'all'],
  nether_regions_discovered: ['first', 'half', 'all'],
  nether_hearts_discovered: ['first', 'half', 'all'],
  structures_found: ['quarter', 'half', 'threeQuarter', 'all'],
}

export const MILESTONE_SLOT_LABELS: Record<MilestoneSlotKey, string> = {
  first: 'First discovery',
  half: 'Half',
  all: 'All / full',
  quarter: 'Quarter (25%)',
  threeQuarter: 'Three quarters (75%)',
}

export const FIRST_SLOT_HINT: Partial<Record<AAMilestoneCategoryKey, string>> = {
  regions_discovered: 'Maps to tier 2 in generated AA config.',
}
