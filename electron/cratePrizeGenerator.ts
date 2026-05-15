import type { CratePrizeEntry, ItemIndexEntry } from './types'
import {
  buildVirtualKeyCommand,
  getVirtualKeyPreset,
  isVirtualKeyPrize,
  resolveVirtualKeyId,
  virtualKeyGrantCount,
} from './shared/crateKeyPresets'
import { CRAZY_CRATES_ENCHANTED_BOOK, parseEnchantedBookMaterial } from './shared/enchantedBook'
import { createCratePrizeSettings } from './utils/crateYamlEmit'

export const DEFAULT_CRATE_PRIZE_WEIGHT = 50

function materialIdForCrazyCrates(itemId: string): string {
  return itemId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
}

function parseDisplayAmount(amount: string | undefined): number {
  const s = (amount ?? '1').trim()
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? n : 1
  }
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(s)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      return Math.max(a, b)
    }
  }
  return 1
}

function formatDisplayName(itemName: string, displayAmount: number, hasEnchants: boolean): string {
  const label = itemName.trim() || 'Item'
  const prefix = hasEnchants ? 'enchanted ' : ''
  const quantity = displayAmount === 1 ? '' : `${displayAmount}x `
  return `<white>${quantity}${prefix}${label}`
}

export function buildCratePrizeItemLine(
  material: string,
  amount: string,
  enchantments?: Record<string, number>
): string {
  let line = `item:${material}, amount:${amount}`
  if (enchantments && typeof enchantments === 'object') {
    const ids = Object.keys(enchantments).sort()
    for (const id of ids) {
      const level = enchantments[id]
      if (typeof level === 'number' && Number.isFinite(level) && level > 0) {
        line += `, ${id}:${Math.round(level)}`
      }
    }
  }
  return line
}

export function buildCratePrizesYamlMap(
  entries: CratePrizeEntry[],
  itemsById: Map<string, ItemIndexEntry>
): Record<string, unknown> {
  const prizes: Record<string, unknown> = {}
  let index = 1
  for (const row of entries) {
    const weight =
      typeof row.override?.weight === 'number' && Number.isFinite(row.override.weight)
        ? Math.max(1, Math.round(row.override.weight))
        : DEFAULT_CRATE_PRIZE_WEIGHT

    if (isVirtualKeyPrize(row)) {
      const keyId = resolveVirtualKeyId(row)
      const preset = keyId ? getVirtualKeyPreset(keyId) : undefined
      if (!preset) continue
      const amount = row.override?.amount?.trim() || '1'
      const displayAmount = virtualKeyGrantCount(amount)
      const displayName = row.override?.displayName?.trim() || preset.displayName
      prizes[String(index)] = {
        DisplayName: displayName,
        DisplayItem: preset.displayItem,
        Settings: createCratePrizeSettings(),
        DisplayAmount: displayAmount,
        Weight: weight,
        Commands: [buildVirtualKeyCommand(preset, amount)],
        Items: [],
      }
      index += 1
      continue
    }

    const itemId = row.itemId.trim().toUpperCase()
    if (!itemId) continue
    const catalog = itemsById.get(itemId)
    const materialRaw = materialIdForCrazyCrates(itemId)
    const catalogBook = parseEnchantedBookMaterial(materialRaw)
    const material = catalogBook ? CRAZY_CRATES_ENCHANTED_BOOK : materialRaw
    const amount = row.override?.amount?.trim() || '1'
    const displayAmount = parseDisplayAmount(amount)
    const overrideEnchants = row.override?.enchantments
    const hasOverrideEnchants =
      overrideEnchants != null && Object.keys(overrideEnchants).length > 0
    const enchantments = hasOverrideEnchants
      ? overrideEnchants
      : catalogBook
        ? { [catalogBook.enchantment]: catalogBook.level }
        : undefined
    const hasEnchants = enchantments != null && Object.keys(enchantments).length > 0
    const displayName =
      row.override?.displayName?.trim() ||
      formatDisplayName(
        catalog?.name ?? material.replace(/_/g, ' '),
        displayAmount,
        hasEnchants && !catalogBook
      )

    prizes[String(index)] = {
      DisplayName: displayName,
      DisplayItem: material,
      Settings: createCratePrizeSettings(),
      DisplayAmount: displayAmount,
      Weight: weight,
      Items: [buildCratePrizeItemLine(material, amount, enchantments)],
    }
    index += 1
  }
  return prizes
}
