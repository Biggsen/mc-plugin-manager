import { describe, expect, it } from 'vitest'
import { commandSnapshot } from './MilestoneRewardCommandsEditor'

describe('commandSnapshot', () => {
  it('treats undefined command as empty execute', () => {
    expect(commandSnapshot(undefined)).toBe(JSON.stringify({ execute: [], display: '' }))
  })

  it('includes execute and display for comparison', () => {
    const cmd = {
      execute: ['ce call get_book_mending player:PLAYER'],
      display: 'Mending',
    }
    expect(commandSnapshot(cmd)).toBe(JSON.stringify(cmd))
  })

  it('differs when enchant execute lines change', () => {
    const a = commandSnapshot({
      execute: ['ce call get_book_mending player:PLAYER'],
    })
    const b = commandSnapshot({
      execute: ['ce call get_book_mending player:PLAYER', 'acb PLAYER +500'],
    })
    expect(a).not.toBe(b)
  })
})
