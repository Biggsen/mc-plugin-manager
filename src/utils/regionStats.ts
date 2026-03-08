/**
 * Region stats for renderer (e.g. ServerDetailScreen).
 */
import type { RegionRecord } from '../types'

export interface RegionDisplayStats {
  overworldRegions: number
  overworldVillages: number
  overworldHearts: number
  netherRegions: number
  netherHearts: number
  totalRegions: number
}

export function computeRegionDisplayStats(regions: RegionRecord[]): RegionDisplayStats {
  const overworldRegions = regions.filter((r) => r.world === 'overworld' && r.kind === 'region').length
  const overworldVillages = regions.filter((r) => r.world === 'overworld' && r.kind === 'village').length
  const overworldHearts = regions.filter((r) => r.world === 'overworld' && r.kind === 'heart').length
  const netherRegions = regions.filter((r) => r.world === 'nether' && r.kind === 'region').length
  const netherHearts = regions.filter((r) => r.world === 'nether' && r.kind === 'heart').length
  const totalRegions = regions.filter((r) => r.kind !== 'system').length
  return {
    overworldRegions,
    overworldVillages,
    overworldHearts,
    netherRegions,
    netherHearts,
    totalRegions,
  }
}
