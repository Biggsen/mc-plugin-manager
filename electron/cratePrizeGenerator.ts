import type { CratePrizeEntry, ItemIndexEntry } from './types'

export const DEFAULT_CRATE_PRIZE_WEIGHT = 50
const PRIZE_SETTINGS = { 'Custom-Model-Data': -1, Model: { Namespace: '', Id: '' } }

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
  return `<white>${displayAmount}x ${prefix}${label}`
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
    const itemId = row.itemId.trim().toUpperCase()
    if (!itemId) continue
    const catalog = itemsById.get(itemId)
    const material = materialIdForCrazyCrates(itemId)
    const amount = row.override?.amount?.trim() || '1'
    const displayAmount = parseDisplayAmount(amount)
    const enchantments = row.override?.enchantments
    const hasEnchants = enchantments != null && Object.keys(enchantments).length > 0
    const weight =
      typeof row.override?.weight === 'number' && Number.isFinite(row.override.weight)
        ? Math.max(1, Math.round(row.override.weight))
        : DEFAULT_CRATE_PRIZE_WEIGHT
    const displayName =
      row.override?.displayName?.trim() ||
      formatDisplayName(catalog?.name ?? material.replace(/_/g, ' '), displayAmount, hasEnchants)

    prizes[String(index)] = {
      DisplayName: displayName,
      DisplayItem: material,
      Settings: PRIZE_SETTINGS,
      DisplayAmount: displayAmount,
      Weight: weight,
      Items: [buildCratePrizeItemLine(material, amount, enchantments)],
    }
    index += 1
  }
  return prizes
}
