import { describe, expect, it } from 'vitest'
import { summarizeMilestoneSlot } from './milestoneRewardSummary'

describe('summarizeMilestoneSlot', () => {
  const itemsIndex = [
    { id: 'NETHERITE_INGOT', rawKey: 'netherite_ingot', name: 'netherite ingot', unitBuy: 840 },
    { id: 'ENCHANTED_BOOK_MENDING_1', rawKey: 'enchanted_book_mending_1', name: 'enchanted book (mending)', unitBuy: 1400 },
  ]

  it('breaks down items, enchantments, and other commands', () => {
    const summary = summarizeMilestoneSlot(
      'half',
      {
        experience: 200,
        items: 'netherite_ingot 2',
        command: {
          execute: ['ce call get_book_mending player:PLAYER', 'acb PLAYER +500'],
          display: 'Mending',
        },
      },
      itemsIndex
    )

    expect(summary.experience).toBe(200)
    expect(summary.items).toEqual(['netherite ingot ×2'])
    expect(summary.enchantments).toEqual(['Mending'])
    expect(summary.potions).toEqual([])
    expect(summary.otherCommands).toEqual(['acb PLAYER +500'])
    expect(summary.value).toBe(1680 + 1400)
  })
})
