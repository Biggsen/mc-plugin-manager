import { describe, it, expect } from 'vitest'
import { loadCeRewardCatalog } from './ceRewardCatalog'
import path from 'path'

describe('loadCeRewardCatalog', () => {
  it('loads get_book_* and get_potion_* from bundled CE config', () => {
    const bundled = path.join(
      __dirname,
      '..',
      'reference',
      'plugin config files',
      'to be bundled',
      'conditionalevents-config.yml'
    )
    const catalog = loadCeRewardCatalog(bundled)
    const tokens = catalog.map((e) => e.token)
    expect(tokens).toContain('get_book_mending')
    expect(tokens).toContain('get_book_soul_speed_3')
    expect(tokens).toContain('get_potion_fire_resistance_long')
    const soul = catalog.find((e) => e.token === 'get_book_soul_speed_3')
    expect(soul?.label).toBe('Soul Speed III')
    expect(soul?.executeLine).toBe('ce call get_book_soul_speed_3 player:PLAYER')
    const potion = catalog.find((e) => e.token === 'get_potion_fire_resistance_long')
    expect(potion?.label).toBe('Potion of Fire Resistance Long')
    expect(potion?.kind).toBe('potion')
  })
})
