import { describe, it, expect } from 'vitest'
import { parseAaItemsToRows, rowsToAaItems } from './MilestoneRewardItemsEditor'

describe('MilestoneRewardItemsEditor AA format', () => {
  it('parses single and multiple AA item lines', () => {
    const rows = parseAaItemsToRows(['diamond 8', 'emerald 16'])
    expect(rows).toHaveLength(2)
    expect(rows[0].materialKey).toBe('diamond')
    expect(rows[0].quantity).toBe(8)
    expect(rows[1].materialKey).toBe('emerald')
    expect(rows[1].quantity).toBe(16)
  })

  it('serializes one row as string and many as array', () => {
    const one = parseAaItemsToRows('diamond 1')
    expect(rowsToAaItems(one)).toBe('diamond 1')

    const many = parseAaItemsToRows(['diamond 8', 'emerald 16'])
    expect(rowsToAaItems(many)).toEqual(['diamond 8', 'emerald 16'])
  })
})
