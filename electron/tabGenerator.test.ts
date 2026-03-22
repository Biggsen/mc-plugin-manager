import { describe, it, expect } from 'vitest'
import { computeRegionCounts, generateOwnedTABSections } from './tabGenerator'

function region(
  kind: 'system' | 'region' | 'village' | 'heart',
  world: 'overworld' | 'nether' = 'overworld',
  method: 'disabled' | 'on_enter' | 'first_join' = 'on_enter'
) {
  return {
    world,
    id: 'test',
    kind,
    discover: {
      method,
      recipeId: 'region' as const,
    },
  }
}

describe('generateOwnedTABSections footer discord line', () => {
  it('omits Discord footer line when invite is empty', () => {
    const owned = generateOwnedTABSections([], 'Srv', undefined, '')
    const footer = owned.headerFooter.footer.join('\n')
    expect(footer).not.toContain('Discord')
  })

  it('includes Discord footer line when invite is set', () => {
    const owned = generateOwnedTABSections([], 'Srv', undefined, 'https://discord.gg/x')
    expect(owned.headerFooter.footer.some((l) => l.includes('Discord'))).toBe(true)
  })
})

describe('computeRegionCounts', () => {
  it('empty regions returns all zeros', () => {
    const counts = computeRegionCounts([])
    expect(counts).toEqual({
      overworldRegions: 0,
      overworldHearts: 0,
      netherRegions: 0,
      netherHearts: 0,
      villages: 0,
      total: 0,
    })
  })

  it('mixed regions: 2 villages, 3 overworld regions, 1 heart, 1 nether region, 1 system', () => {
    const regions = [
      region('village'),
      region('village'),
      region('region'),
      region('region'),
      region('region'),
      region('heart'),
      region('region', 'nether'),
      region('system', 'overworld', 'disabled'),
    ]
    const counts = computeRegionCounts(regions)
    expect(counts.villages).toBe(2)
    expect(counts.overworldRegions).toBe(3)
    expect(counts.overworldHearts).toBe(1)
    expect(counts.netherRegions).toBe(1)
    expect(counts.netherHearts).toBe(0)
    expect(counts.total).toBe(7)
  })

  it('disabled region excluded from total', () => {
    const regions = [
      region('region', 'overworld', 'disabled'),
      region('village'),
    ]
    const counts = computeRegionCounts(regions)
    expect(counts.total).toBe(1)
    expect(counts.villages).toBe(1)
    expect(counts.overworldRegions).toBe(0)
  })
})
