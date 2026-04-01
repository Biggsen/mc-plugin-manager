/**
 * Region stats for renderer (e.g. ServerDetailScreen).
 */
import type { RegionRecord } from '../types'

export interface StructureTypeCount {
  structureType: string
  count: number
}

function structureTypeBreakdown(
  regions: RegionRecord[],
  world?: RegionRecord['world']
): StructureTypeCount[] {
  const map = new Map<string, number>()
  for (const r of regions) {
    if (r.kind !== 'structure') continue
    if (world !== undefined && r.world !== world) continue
    const t = (r.structureType ?? '').trim() || 'unknown'
    map.set(t, (map.get(t) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([structureType, count]) => ({ structureType, count }))
}

export interface RegionDisplayStats {
  overworldRegions: number
  overworldVillages: number
  overworldHearts: number
  overworldWater: number
  overworldStructures: number
  structureTypesOverworld: StructureTypeCount[]
  netherRegions: number
  netherHearts: number
  netherStructures: number
  structureTypesNether: StructureTypeCount[]
  /** All non-system regions except water (includes villages, hearts, structures, land regions). */
  totalRegions: number
  totalStructures: number
  structureTypesAll: StructureTypeCount[]
}

export function computeRegionDisplayStats(regions: RegionRecord[]): RegionDisplayStats {
  const overworldRegions = regions.filter((r) => r.world === 'overworld' && r.kind === 'region').length
  const overworldVillages = regions.filter((r) => r.world === 'overworld' && r.kind === 'village').length
  const overworldHearts = regions.filter((r) => r.world === 'overworld' && r.kind === 'heart').length
  const overworldWater = regions.filter((r) => r.world === 'overworld' && r.kind === 'water').length
  const overworldStructures = regions.filter((r) => r.world === 'overworld' && r.kind === 'structure').length
  const netherRegions = regions.filter((r) => r.world === 'nether' && r.kind === 'region').length
  const netherHearts = regions.filter((r) => r.world === 'nether' && r.kind === 'heart').length
  const netherStructures = regions.filter((r) => r.world === 'nether' && r.kind === 'structure').length
  const totalRegions = regions.filter((r) => r.kind !== 'system' && r.kind !== 'water').length
  const totalStructures = regions.filter((r) => r.kind === 'structure').length
  return {
    overworldRegions,
    overworldVillages,
    overworldHearts,
    overworldWater,
    overworldStructures,
    structureTypesOverworld: structureTypeBreakdown(regions, 'overworld'),
    netherRegions,
    netherHearts,
    netherStructures,
    structureTypesNether: structureTypeBreakdown(regions, 'nether'),
    totalRegions,
    totalStructures,
    structureTypesAll: structureTypeBreakdown(regions),
  }
}
