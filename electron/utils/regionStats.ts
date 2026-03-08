/**
 * Shared region counting for build reports and TAB.
 */
import type { RegionRecord } from '../types'

export interface RegionCounts {
  overworldRegions: number
  overworldHearts: number
  netherRegions: number
  netherHearts: number
  villages: number
  total: number
}

export interface BuildReportRegionCounts {
  overworld: number
  nether: number
  hearts: number
  villages: number
  regions: number
  system: number
}

/**
 * Compute region counts for TAB (only regions where discover.method !== 'disabled').
 */
export function computeRegionCounts(regions: RegionRecord[]): RegionCounts {
  const counts: RegionCounts = {
    overworldRegions: 0,
    overworldHearts: 0,
    netherRegions: 0,
    netherHearts: 0,
    villages: 0,
    total: 0,
  }

  for (const region of regions) {
    if (region.discover.method === 'disabled') continue

    if (region.kind === 'village') {
      counts.villages++
    } else if (region.kind === 'heart') {
      if (region.world === 'nether') counts.netherHearts++
      else counts.overworldHearts++
    } else if (region.kind === 'region') {
      if (region.world === 'nether') counts.netherRegions++
      else counts.overworldRegions++
    }
    counts.total++
  }

  return counts
}

/**
 * Compute simple region counts for build report (all regions by world/kind).
 */
export function computeRegionStats(regions: RegionRecord[]): BuildReportRegionCounts {
  return {
    overworld: regions.filter((r) => r.world === 'overworld').length,
    nether: regions.filter((r) => r.world === 'nether').length,
    hearts: regions.filter((r) => r.kind === 'heart').length,
    villages: regions.filter((r) => r.kind === 'village').length,
    regions: regions.filter((r) => r.kind === 'region').length,
    system: regions.filter((r) => r.kind === 'system').length,
  }
}
