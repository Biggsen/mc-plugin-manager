import { describe, expect, it } from 'vitest'
import { ceRewardCatalogLookup, ceRewardUnitBuy } from './ceRewardValue'

describe('ceRewardCatalogLookup', () => {
  it('maps get_book_* with level suffix', () => {
    expect(ceRewardCatalogLookup('get_book_soul_speed_3')).toEqual({
      catalogId: 'ENCHANTED_BOOK_SOUL_SPEED_3',
      quantity: 1,
    })
  })

  it('maps get_book_* without level to level 1', () => {
    expect(ceRewardCatalogLookup('get_book_mending')).toEqual({
      catalogId: 'ENCHANTED_BOOK_MENDING_1',
      quantity: 1,
    })
  })

  it('maps potion base and extended', () => {
    expect(ceRewardCatalogLookup('get_potion_fire_resistance')).toEqual({
      catalogId: 'POTION_OF_FIRE_RESISTANCE_1',
      quantity: 1,
    })
    expect(ceRewardCatalogLookup('get_potion_fire_resistance_long')).toEqual({
      catalogId: 'POTION_OF_FIRE_RESISTANCE_EXTENDED',
      quantity: 1,
    })
  })

  it('maps stacked potion count', () => {
    expect(ceRewardCatalogLookup('get_potion_fire_resistance_2')).toEqual({
      catalogId: 'POTION_OF_FIRE_RESISTANCE_1',
      quantity: 2,
    })
  })
})

describe('ceRewardUnitBuy', () => {
  const prices: Record<string, number> = {
    ENCHANTED_BOOK_MENDING_1: 1400,
    POTION_OF_FIRE_RESISTANCE_1: 13,
  }

  it('returns unit_buy × quantity', () => {
    expect(ceRewardUnitBuy('get_book_mending', (id) => prices[id])).toBe(1400)
    expect(ceRewardUnitBuy('get_potion_fire_resistance_2', (id) => prices[id])).toBe(26)
  })
})
