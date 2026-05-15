import { describe, it, expect } from 'vitest'
import { parseEnchantedBookMaterial } from './enchantedBook'

describe('parseEnchantedBookMaterial', () => {
  it('parses multi-word enchant names', () => {
    expect(parseEnchantedBookMaterial('enchanted_book_feather_falling_4')).toEqual({
      enchantment: 'feather_falling',
      level: 4,
    })
    expect(parseEnchantedBookMaterial('ENCHANTED_BOOK_SILK_TOUCH_1')).toEqual({
      enchantment: 'silk_touch',
      level: 1,
    })
  })

  it('returns null for non-book materials', () => {
    expect(parseEnchantedBookMaterial('diamond_sword')).toBeNull()
    expect(parseEnchantedBookMaterial('enchanted_book')).toBeNull()
  })
})
