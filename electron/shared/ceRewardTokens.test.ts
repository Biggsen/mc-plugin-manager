import { describe, it, expect } from 'vitest'
import {
  labelFromCeCallToken,
  rewardDisplayFromCeExecuteLine,
  ceCallExecuteLine,
} from './ceRewardTokens'

describe('ceRewardTokens', () => {
  it('maps get_book_* to enchant labels with Roman levels', () => {
    expect(rewardDisplayFromCeExecuteLine('ce call get_book_respiration_3 player:PLAYER')).toBe('Respiration III')
    expect(labelFromCeCallToken('get_book_soul_speed_3')).toBe('Soul Speed III')
  })

  it('maps get_potion_*', () => {
    expect(rewardDisplayFromCeExecuteLine('ce call get_potion_fire_resistance player:PLAYER')).toBe(
      'Potion of Fire Resistance'
    )
    expect(rewardDisplayFromCeExecuteLine('ce call get_potion_fire_resistance_2 player:PLAYER')).toBe(
      '2 Potions of Fire Resistance'
    )
    expect(rewardDisplayFromCeExecuteLine('ce call get_potion_fire_resistance_long player:PLAYER')).toBe(
      'Potion of Fire Resistance Long'
    )
  })

  it('builds execute line', () => {
    expect(ceCallExecuteLine('get_book_mending')).toBe('ce call get_book_mending player:PLAYER')
  })
})
