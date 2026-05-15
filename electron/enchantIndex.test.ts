import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'
import type { EnchantCatalog } from './enchantIndex'
import {
  enchantConflictsWithSet,
  getCompatibleEnchantsForItem,
  isEnchantCompatibleWithItem,
  sanitizeEnchantmentsForItem,
} from './enchantIndex'

function loadTestCatalog(): EnchantCatalog {
  const path = join(__dirname, '..', 'reference', 'data', 'enchantments-data.json')
  return JSON.parse(readFileSync(path, 'utf-8')) as EnchantCatalog
}

describe('enchantIndex', () => {
  const catalog = loadTestCatalog()

  it('diamond sword accepts sharpness', () => {
    expect(isEnchantCompatibleWithItem(catalog, 'diamond_sword', 'sharpness')).toBe(true)
    expect(isEnchantCompatibleWithItem(catalog, 'diamond_sword', 'protection')).toBe(false)
  })

  it('sharpness conflicts with smite', () => {
    expect(enchantConflictsWithSet(catalog, 'smite', { sharpness: 5 })).toMatch(/conflicts/i)
  })

  it('lists compatible enchants for bow', () => {
    const list = getCompatibleEnchantsForItem(catalog, 'bow')
    expect(list.some((e) => e.id === 'power')).toBe(true)
    expect(list.some((e) => e.id === 'sharpness')).toBe(false)
  })

  it('sanitize clamps level and drops incompatible', () => {
    const out = sanitizeEnchantmentsForItem(catalog, 'diamond_sword', {
      sharpness: 99,
      protection: 4,
    })
    expect(out?.sharpness).toBe(5)
    expect(out?.protection).toBeUndefined()
  })
})
