import { extractCeCallToken } from '@shared/ceRewardTokens'
import { ceRewardUnitBuy } from '@shared/ceRewardValue'
import type { AAMilestoneReward, ItemIndexEntry } from '../types'
import { parseAaItemsToRows } from './MilestoneRewardItemsEditor'

export function formatMilestoneValue(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '-'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** Sum item-index unit_buy for milestone slot items + CE book/potion commands. */
export function sumMilestoneRewardValue(
  reward: AAMilestoneReward | undefined,
  itemsIndex: ItemIndexEntry[]
): number | null {
  if (!reward) return null

  const itemById = new Map<string, ItemIndexEntry>()
  for (const it of itemsIndex) itemById.set(it.id, it)

  let sum = 0
  let any = false

  for (const row of parseAaItemsToRows(reward.items)) {
    const unit = itemById.get(row.itemId)?.unitBuy
    if (typeof unit === 'number' && Number.isFinite(unit)) {
      sum += unit * row.quantity
      any = true
    }
  }

  const unitBuyById = (id: string) => itemById.get(id)?.unitBuy
  for (const line of reward.command?.execute ?? []) {
    const token = extractCeCallToken(line.trim())
    if (!token) continue
    const v = ceRewardUnitBuy(token, unitBuyById)
    if (v !== undefined) {
      sum += v
      any = true
    }
  }

  return any ? sum : null
}
