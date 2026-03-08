import { describe, it, expect } from 'vitest'
import { generateLoreBooks } from './loreBooksGenerator'
import type { RegionRecord } from './types'

function region(
  id: string,
  description: string,
  overrides: Partial<RegionRecord> = {}
): RegionRecord {
  return {
    world: 'overworld',
    id,
    kind: 'region',
    discover: { method: 'on_enter', recipeId: 'region' },
    description,
    ...overrides,
  }
}

describe('generateLoreBooks', () => {
  it('returns empty Map for empty regions', () => {
    const result = generateLoreBooks([])
    expect(result.size).toBe(0)
  })

  it('skips regions without description', () => {
    const regions: RegionRecord[] = [
      region('with_desc', 'Some lore text'),
      { ...region('no_desc', ''), description: '' },
      { ...region('no_desc2', '  \n  '), description: '  \n  ' },
    ]
    const result = generateLoreBooks(regions)
    expect(result.size).toBe(1)
    expect(result.has('with_desc')).toBe(true)
  })

  it('uses loreBookDescription when set over description', () => {
    const regions: RegionRecord[] = [
      {
        ...region('r', 'ignore'),
        loreBookDescription: 'Actual lore content',
      },
    ]
    const result = generateLoreBooks(regions)
    expect(result.get('r')).toContain('Actual lore content')
    expect(result.get('r')).not.toContain('ignore')
  })

  it('output includes title from displayNameOverride when set', () => {
    const regions: RegionRecord[] = [
      region('snake_region', 'Lore.', {
        discover: { method: 'on_enter', recipeId: 'region', displayNameOverride: 'Custom Title' },
      }),
    ]
    const result = generateLoreBooks(regions)
    expect(result.get('snake_region')).toMatch(/title:\s*Custom Title/)
  })

  it('output includes title from formatRegionTitle when no displayNameOverride', () => {
    const regions: RegionRecord[] = [region('desert_ruins', 'Lore.')]
    const result = generateLoreBooks(regions)
    expect(result.get('desert_ruins')).toMatch(/title:\s*Desert Ruins/)
  })

  it('uses default author Admin', () => {
    const regions: RegionRecord[] = [region('r', 'Lore.')]
    const result = generateLoreBooks(regions)
    expect(result.get('r')).toMatch(/author:\s*Admin/)
  })

  it('uses custom author when provided', () => {
    const regions: RegionRecord[] = [region('r', 'Lore.')]
    const result = generateLoreBooks(regions, 'CustomAuthor')
    expect(result.get('r')).toMatch(/author:\s*CustomAuthor/)
  })

  it('output has pages array with content', () => {
    const regions: RegionRecord[] = [region('r', 'One paragraph.')]
    const result = generateLoreBooks(regions)
    const yaml = result.get('r')!
    expect(yaml).toContain('pages:')
    expect(yaml).toContain('One paragraph.')
  })

  it('splits by loreBookAnchors when provided', () => {
    const regions: RegionRecord[] = [
      {
        ...region('r', 'Page one content.\n---\nPage two content.'),
        loreBookAnchors: ['---'],
      },
    ]
    const result = generateLoreBooks(regions)
    const yaml = result.get('r')!
    expect(yaml).toContain('Page one content.')
    expect(yaml).toContain('Page two content.')
  })
})
