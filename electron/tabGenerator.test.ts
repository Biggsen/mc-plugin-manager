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

describe('structures TAB section', () => {
  const families = {
    ancient_city: { label: 'Ancient Cities', counter: 'ancient_cities_found' },
  }

  it('adds Structures lines and structure-name when overworld has POIs', () => {
    const regions = [
      {
        world: 'overworld' as const,
        id: 'inner_core',
        kind: 'structure' as const,
        structureType: 'ancient_city',
        discover: { method: 'on_enter' as const, recipeId: 'none' as const },
      },
    ]
    const owned = generateOwnedTABSections(regions, 'Srv', undefined, '', families)
    const mainLines = owned.scoreboards['main-overworld'].lines as string[]
    const lines = owned.scoreboards['structures-overworld'].lines as string[]
    expect(mainLines.some((l) => l === '&bStructures')).toBe(false)
    expect(lines.some((l) => l === '&bStructures')).toBe(true)
    expect(lines.some((l) => l.includes('structure-name'))).toBe(true)
    expect(lines.some((l) => l.includes('Ancient Cities') && l.includes('ancient_cities_found'))).toBe(
      true
    )
    const sn = owned.structureConditions?.['structure-name'] as Record<string, unknown>
    expect(sn?.type).toBe('OR')
    expect(sn?.conditions).toEqual(['%worldguard_region_name_1%=inner_core'])
    const vn = owned.structureConditions?.['village-name'] as Record<string, unknown>
    expect((vn?.conditions as string[]).includes('%condition:structure-name%=-')).toBe(true)
  })
})
