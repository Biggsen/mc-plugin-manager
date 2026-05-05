const yaml = require('yaml')
const { readFileSync } = require('fs')

import type { ResolvedDropTable } from './types'

interface GeneratedCustomDrops {
  dropTables: Record<string, unknown[]>
  warnings: string[]
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Baseline per-item chance from economy value: softer curve + higher floor than v1. */
function computeChanceFromUnitBuy(unitBuy: number): number {
  const chance = 0.9 / Math.pow(unitBuy, 0.72)
  return clamp(chance, 0.001, 0.15)
}

function normalizeItemId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toUpperCase()
}

function sortedObject<T>(obj: Record<string, T>): Record<string, T> {
  return Object.keys(obj)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, key) => {
      acc[key] = obj[key]
      return acc
    }, {} as Record<string, T>)
}

function parseEnchantedBookEntry(itemId: string): { enchantment: string; level: number } | null {
  const match = /^ENCHANTED_BOOK_(.+)_(\d+)$/.exec(itemId)
  if (!match) return null
  const enchantment = match[1].toLowerCase()
  const level = Number(match[2])
  if (!Number.isFinite(level) || level < 1) return null
  return { enchantment, level }
}

function parseDifficultyGroupId(tableName: string): string | undefined {
  const lower = String(tableName ?? '').trim().toLowerCase()
  const match = /^(easy|normal|hard|severe|deadly)_drops$/.exec(lower)
  return match ? match[1] : undefined
}

function toItemNode(
  itemId: string,
  override?: { chance?: number; amount?: number | string },
  unitBuy?: number,
  groupId?: string,
  includeGroupLimit?: boolean
): Record<string, Record<string, unknown>> {
  const normalized = normalizeItemId(itemId)
  const enchantedBook = parseEnchantedBookEntry(normalized)
  const outputItemId = enchantedBook ? 'ENCHANTED_BOOK' : normalized
  const entry: Record<string, unknown> = {}
  if (typeof override?.chance === 'number') {
    entry.chance = override.chance
  } else if (typeof unitBuy === 'number' && Number.isFinite(unitBuy) && unitBuy > 0) {
    // Derived baseline chance from item economy value.
    entry.chance = Number(computeChanceFromUnitBuy(unitBuy).toFixed(6))
  }
  if (override?.amount !== undefined && override?.amount !== 1 && override?.amount !== '1') {
    entry.amount = override.amount
  }
  if (groupId) {
    entry.groupid = groupId
    if (includeGroupLimit) {
      entry['group-limits'] = {
        'cap-total': 1,
      }
    }
  }
  if (enchantedBook) {
    entry.enchantments = {
      [enchantedBook.enchantment]: enchantedBook.level,
    }
  }
  return { [outputItemId]: entry }
}

export function generateOwnedLMCustomDropTables(resolvedTables: ResolvedDropTable[]): GeneratedCustomDrops {
  const warnings: string[] = []
  const dropTables: Record<string, unknown[]> = {}

  for (const rt of resolvedTables) {
    const tableName = rt.tableName
    if (!tableName || !Array.isArray(rt.selectedItems) || rt.selectedItems.length === 0) {
      continue
    }
    const itemValues = rt.itemValues ?? {}
    const groupId = parseDifficultyGroupId(tableName)

    const normalizedItemIds = [...new Set(rt.selectedItems.map((rawId: string) => normalizeItemId(rawId)))].sort(
      (a: string, b: string) => a.localeCompare(b)
    )
    const entries: unknown[] = []
    let groupLimitAssigned = false
    for (const itemId of normalizedItemIds) {
      const rawOverride = rt.itemOverrides?.[itemId] || rt.itemOverrides?.[itemId.toLowerCase()]
      const unitBuy = itemValues[itemId]
      const includeGroupLimit = Boolean(groupId) && !groupLimitAssigned
      if (includeGroupLimit) {
        groupLimitAssigned = true
      }
      entries.push(toItemNode(itemId, rawOverride, unitBuy, groupId, includeGroupLimit))
    }

    if (entries.length > 0) {
      dropTables[tableName] = entries
    }
  }

  return { dropTables: sortedObject(dropTables), warnings }
}

export function mergeLMCustomDropsConfig(
  existingPath: string,
  generated: GeneratedCustomDrops,
  ownedTableNames: string[]
): string {
  const existingContent = readFileSync(existingPath, 'utf-8')
  const doc = yaml.parseDocument(existingContent)
  const config = doc.toJS() as Record<string, unknown>
  if (!config || typeof config !== 'object') {
    throw new Error('Failed to parse existing LevelledMobs customdrops config')
  }

  const dropTable = (config['drop-table'] && typeof config['drop-table'] === 'object'
    ? { ...(config['drop-table'] as Record<string, unknown>) }
    : {}) as Record<string, unknown>

  for (const ownedName of ownedTableNames) {
    delete dropTable[ownedName]
  }
  for (const [name, value] of Object.entries(generated.dropTables)) {
    dropTable[name] = value
  }

  if (Object.keys(dropTable).length === 0) {
    delete config['drop-table']
  } else {
    config['drop-table'] = dropTable
  }

  if (doc.contents && typeof doc.contents === 'object') {
    const contents = doc.contents as any
    if (contents.set) {
      if (config['drop-table']) {
        contents.set('drop-table', doc.createNode(config['drop-table']))
      } else {
        contents.delete?.('drop-table')
      }
    }
  }

  return doc.toString({
    indent: 2,
    lineWidth: 0,
    simpleKeys: false,
    doubleQuotedAsJSON: false,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  })
}

module.exports = { generateOwnedLMCustomDropTables, mergeLMCustomDropsConfig }
