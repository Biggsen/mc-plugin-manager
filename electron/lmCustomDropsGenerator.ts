const yaml = require('yaml')
const { readFileSync } = require('fs')

import type { DropTablesConfig, DropTableCatalogSummary } from './types'

interface GeneratedCustomDrops {
  dropTables: Record<string, unknown[]>
  warnings: string[]
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function computeChanceFromUnitBuy(unitBuy: number): number {
  const chance = 0.45 / Math.pow(unitBuy, 0.85)
  return clamp(chance, 0.0005, 0.15)
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

function toItemNode(
  itemId: string,
  override?: { chance?: number; amount?: number | string },
  unitBuy?: number
): Record<string, Record<string, unknown>> {
  const normalized = normalizeItemId(itemId)
  const entry: Record<string, unknown> = {}
  const isRare = typeof unitBuy === 'number' && Number.isFinite(unitBuy) && unitBuy >= 100
  if (typeof override?.chance === 'number') {
    entry.chance = override.chance
  } else if (typeof unitBuy === 'number' && Number.isFinite(unitBuy) && unitBuy > 0) {
    // Derived baseline chance from item economy value.
    entry.chance = Number(computeChanceFromUnitBuy(unitBuy).toFixed(6))
  }
  if (override?.amount !== undefined && override?.amount !== 1 && override?.amount !== '1') {
    entry.amount = override.amount
  }
  if (isRare) {
    entry.groupid = 'rare'
    entry['group-limits'] = {
      'cap-total': 1,
    }
  }
  return { [normalized]: entry }
}

export function generateOwnedLMCustomDropTables(
  config: DropTablesConfig | undefined,
  catalogs: DropTableCatalogSummary[]
): GeneratedCustomDrops {
  const warnings: string[] = []
  const dropTables: Record<string, unknown[]> = {}
  const catalogItemsByTable = new Map<string, Set<string>>()
  const catalogValuesByTable = new Map<string, Record<string, number | undefined>>()

  for (const catalog of catalogs) {
    catalogItemsByTable.set(catalog.tableName, new Set(catalog.itemIds))
    catalogValuesByTable.set(catalog.tableName, catalog.itemValues ?? {})
  }

  const tables = config?.tables ?? {}
  for (const tableName of Object.keys(tables)) {
    const table = tables[tableName]
    if (!table || !Array.isArray(table.selectedItems) || table.selectedItems.length === 0) {
      continue
    }
    const knownItems = catalogItemsByTable.get(tableName)
    if (!knownItems) {
      warnings.push(`Skipping table "${tableName}": no valid catalog file found`)
      continue
    }

    const entries = table.selectedItems
      .map((rawId: string) => normalizeItemId(rawId))
      .filter((itemId: string) => {
        if (!knownItems.has(itemId)) {
          warnings.push(`Skipping item "${itemId}" in table "${tableName}": not found in catalog`)
          return false
        }
        return true
      })
      .sort((a: string, b: string) => a.localeCompare(b))
      .map((itemId: string) => {
        const rawOverride = table.itemOverrides?.[itemId] || table.itemOverrides?.[itemId.toLowerCase()]
        const unitBuy = catalogValuesByTable.get(tableName)?.[itemId]
        return toItemNode(itemId, rawOverride, unitBuy)
      })

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
