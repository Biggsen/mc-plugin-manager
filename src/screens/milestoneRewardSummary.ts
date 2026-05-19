import { ceRewardKindFromToken, extractCeCallToken, labelFromCeCallToken } from '@shared/ceRewardTokens'
import type {
  AAMilestoneCategoryKey,
  AAMilestoneCategorySlots,
  AAMilestoneReward,
  ItemIndexEntry,
} from '../types'
import { parseAaItemsToRows } from './MilestoneRewardItemsEditor'
import { formatMilestoneValue, sumMilestoneRewardValue } from './milestoneRewardValue'
import {
  MILESTONE_CATEGORY_ORDER,
  MILESTONE_SLOT_LABELS,
  SLOTS_BY_CATEGORY,
  type MilestoneSlotKey,
} from './milestoneRewardsEditorConstants'

export interface MilestoneSlotSummary {
  slotKey: MilestoneSlotKey
  slotLabel: string
  value: number | null
  experience: number | undefined
  items: string[]
  enchantments: string[]
  potions: string[]
  otherCommands: string[]
  isEmpty: boolean
}

export interface MilestoneCategorySummary {
  categoryKey: AAMilestoneCategoryKey
  categoryLabel: string
  totalValue: number | null
  slots: MilestoneSlotSummary[]
}

function rewardIsEmpty(r: AAMilestoneReward | undefined): boolean {
  if (!r) return true
  return r.experience === undefined && r.items === undefined && !r.command?.execute?.length
}

function formatItemLines(
  reward: AAMilestoneReward | undefined,
  itemById: Map<string, ItemIndexEntry>
): string[] {
  return parseAaItemsToRows(reward?.items).map((row) => {
    const name = itemById.get(row.itemId)?.name ?? row.materialKey
    return `${name} ×${row.quantity}`
  })
}

function parseCommandBreakdown(execute: string[] | undefined): {
  enchantments: string[]
  potions: string[]
  otherCommands: string[]
} {
  const enchantments: string[] = []
  const potions: string[] = []
  const otherCommands: string[] = []

  for (const line of execute ?? []) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const token = extractCeCallToken(trimmed)
    if (token) {
      const kind = ceRewardKindFromToken(token)
      const label = labelFromCeCallToken(token) ?? token
      if (kind === 'enchantment') {
        if (!enchantments.includes(label)) enchantments.push(label)
        continue
      }
      if (kind === 'potion') {
        if (!potions.includes(label)) potions.push(label)
        continue
      }
    }
    if (!otherCommands.includes(trimmed)) otherCommands.push(trimmed)
  }

  return { enchantments, potions, otherCommands }
}

export function summarizeMilestoneSlot(
  slotKey: MilestoneSlotKey,
  reward: AAMilestoneReward | undefined,
  itemsIndex: ItemIndexEntry[]
): MilestoneSlotSummary {
  const itemById = new Map<string, ItemIndexEntry>()
  for (const it of itemsIndex) itemById.set(it.id, it)

  const { enchantments, potions, otherCommands } = parseCommandBreakdown(reward?.command?.execute)

  return {
    slotKey,
    slotLabel: MILESTONE_SLOT_LABELS[slotKey],
    value: sumMilestoneRewardValue(reward, itemsIndex),
    experience: reward?.experience,
    items: formatItemLines(reward, itemById),
    enchantments,
    potions,
    otherCommands,
    isEmpty: rewardIsEmpty(reward),
  }
}

export function summarizeMilestoneCategory(
  categoryKey: AAMilestoneCategoryKey,
  categoryLabel: string,
  slots: AAMilestoneCategorySlots | undefined,
  itemsIndex: ItemIndexEntry[]
): MilestoneCategorySummary | null {
  const slotKeys = SLOTS_BY_CATEGORY[categoryKey]
  const slotSummaries = slotKeys
    .map((key) => summarizeMilestoneSlot(key, slots?.[key], itemsIndex))
    .filter((s) => !s.isEmpty)

  if (slotSummaries.length === 0) return null

  let total = 0
  let hasValue = false
  for (const s of slotSummaries) {
    if (s.value !== null) {
      total += s.value
      hasValue = true
    }
  }

  return {
    categoryKey,
    categoryLabel,
    totalValue: hasValue ? total : null,
    slots: slotSummaries,
  }
}

export function summarizeMilestoneProfile(
  categories: Partial<Record<AAMilestoneCategoryKey, AAMilestoneCategorySlots>> | undefined,
  categoryLabels: Record<AAMilestoneCategoryKey, string>,
  itemsIndex: ItemIndexEntry[]
): MilestoneCategorySummary[] {
  const out: MilestoneCategorySummary[] = []
  for (const key of MILESTONE_CATEGORY_ORDER) {
    const summary = summarizeMilestoneCategory(
      key,
      categoryLabels[key],
      categories?.[key],
      itemsIndex
    )
    if (summary) out.push(summary)
  }
  return out
}

export function formatSummaryList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : '—'
}

export function formatExperience(xp: number | undefined): string {
  if (xp === undefined || !Number.isFinite(xp)) return '—'
  return String(xp)
}

export function formatSlotValue(value: number | null): string {
  if (value === null) return '—'
  return formatMilestoneValue(value)
}
