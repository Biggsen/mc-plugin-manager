import { describe, it, expect } from 'vitest'
import {
  buildVirtualKeyCommand,
  createVirtualKeyPrizeEntry,
  getVirtualKeyPreset,
  getVirtualKeyPrizeValue,
  isVirtualKeyPrize,
  normalizeVirtualKeyPrizeEntry,
} from './crateKeyPresets'

describe('crateKeyPresets', () => {
  it('creates virtual key prize rows', () => {
    const row = createVirtualKeyPrizeEntry('region')
    expect(row.prizeKind).toBe('virtual_key')
    expect(row.keyId).toBe('region')
    expect(isVirtualKeyPrize(row)).toBe(true)
  })

  it('builds cc give command with grant count from amount', () => {
    const preset = getVirtualKeyPreset('village')!
    expect(buildVirtualKeyCommand(preset, '3')).toBe('cc give virtual VillageCrate 3 %player%')
    expect(buildVirtualKeyCommand(preset, '2-4')).toBe('cc give virtual VillageCrate 3 %player%')
  })

  it('normalizes sentinel item id to virtual key entry', () => {
    const row = normalizeVirtualKeyPrizeEntry({
      entryId: 'x',
      itemId: 'CRATE_KEY_HEART',
    })
    expect(row.keyId).toBe('heart')
    expect(row.prizeKind).toBe('virtual_key')
  })

  it('includes nerve preset with NerveCrate command target', () => {
    const preset = getVirtualKeyPreset('nerve')
    expect(preset?.crazyCratesCrateName).toBe('NerveCrate')
    expect(buildVirtualKeyCommand(preset!, '1')).toBe('cc give virtual NerveCrate 1 %player%')
  })

  it('getVirtualKeyPrizeValue uses global unit value times grant count', () => {
    const row = createVirtualKeyPrizeEntry('heart')
    row.override = { amount: '2' }
    expect(getVirtualKeyPrizeValue(row, { heart: 100 })).toBe(200)
    expect(getVirtualKeyPrizeValue(row, {})).toBeUndefined()
  })
})
