import { describe, it, expect } from 'vitest'
import {
  calculateTiers,
  VILLAGES_TEMPLATE,
  REGIONS_TEMPLATE,
  HEARTS_TEMPLATE,
} from './aaGenerator'

describe('calculateTiers', () => {
  it('67 villages', () => {
    expect(calculateTiers(VILLAGES_TEMPLATE, 67)).toEqual([
      1, 10, 20, 33, 40, 50, 60, 67,
    ])
  })

  it('63 villages (too-close rule drops 60)', () => {
    expect(calculateTiers(VILLAGES_TEMPLATE, 63)).toEqual([
      1, 10, 20, 31, 40, 50, 63,
    ])
  })

  it('33 regions', () => {
    expect(calculateTiers(REGIONS_TEMPLATE, 33)).toEqual([2, 16, 33])
  })

  it('5 villages (edge case)', () => {
    expect(calculateTiers(VILLAGES_TEMPLATE, 5)).toEqual([2, 5])
  })

  it('zero total returns empty array', () => {
    expect(calculateTiers(VILLAGES_TEMPLATE, 0)).toEqual([])
  })

  it('total 1 (hearts)', () => {
    expect(calculateTiers(HEARTS_TEMPLATE, 1)).toEqual([1])
  })

  it('half equals all (total 2)', () => {
    expect(calculateTiers(HEARTS_TEMPLATE, 2)).toEqual([1, 2])
  })
})
