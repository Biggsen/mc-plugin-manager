const yaml = require('yaml')
const { readFileSync } = require('fs')

import type { DropTablesConfig, DropTableCatalogSummary } from './types'

interface GeneratedCustomDrops {
  dropTables: Record<string, unknown[]>
  warnings: string[]
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
  override?: { chance?: number; amount?: number | string }
): Record<string, Record<string, unknown>> {
  const normalized = normalizeItemId(itemId)
  const entry: Record<string, unknown> = {}
  if (typeof override?.chance === 'number') {
    entry.chance = override.chance
  }
  if (override?.amount !== undefined && override?.amount !== 1 && override?.amount !== '1') {
    entry.amount = override.amount
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

  for (const catalog of catalogs) {
    catalogItemsByTable.set(catalog.tableName, new Set(catalog.itemIds))
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
        return toItemNode(itemId, rawOverride)
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
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  })
}

module.exports = { generateOwnedLMCustomDropTables, mergeLMCustomDropsConfig }
