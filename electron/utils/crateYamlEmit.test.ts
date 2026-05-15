import { describe, it, expect } from 'vitest'
import { buildCratePrizesYamlMap } from '../cratePrizeGenerator'
import { stringifyCrateDocument } from './crateYamlEmit'
import type { CratePrizeEntry, ItemIndexEntry } from '../types'

describe('stringifyCrateDocument', () => {
  it('emits inline Settings on every prize without YAML anchors', () => {
    const itemsById = new Map<string, ItemIndexEntry>([
      ['TORCH', { id: 'TORCH', rawKey: 'torch', name: 'Torch' }],
      ['PAPER', { id: 'PAPER', rawKey: 'paper', name: 'Paper' }],
    ])
    const prizes = buildCratePrizesYamlMap(
      [
        { entryId: 'a', itemId: 'TORCH' },
        { entryId: 'b', itemId: 'PAPER' },
      ],
      itemsById
    )
    const yaml = stringifyCrateDocument({ Crate: { Prizes: prizes } })
    expect(yaml).not.toMatch(/\*a\d+/)
    expect(yaml).not.toMatch(/&a\d+/)
    const settingsLines = yaml.match(/^\s+Settings:.*$/gm) ?? []
    expect(settingsLines).toHaveLength(2)
    for (const line of settingsLines) {
      expect(line).toMatch(/Settings: \{ Custom-Model-Data: -1, Model: \{/)
    }
  })
})
