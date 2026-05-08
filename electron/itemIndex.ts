const { readFileSync, existsSync } = require('fs')
const path = require('path')
const electron = require('electron')

import type { ItemIndexEntry } from './types'
import { normalizeItemId } from './dropTableNormalize'

const ALL_JSON = 'all.json'

function isIgnoredCatalogKey(key: string): boolean {
  return key.startsWith('_')
}

function coerceNumeric(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function getBundledItemIndexPath(): string {
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  const dataDir = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'data')
    : path.join(basePath, 'reference', 'data')
  return path.join(dataDir, ALL_JSON)
}

export function loadBundledItemIndex(): {
  items: ItemIndexEntry[]
  warnings: string[]
  sourcePath: string
} {
  const warnings: string[] = []
  const sourcePath = getBundledItemIndexPath()
  if (!existsSync(sourcePath)) {
    warnings.push(`Item index not found: ${sourcePath}`)
    return { items: [], warnings, sourcePath }
  }
  try {
    const parsed = JSON.parse(readFileSync(sourcePath, 'utf-8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      warnings.push(`Expected JSON object in ${ALL_JSON}`)
      return { items: [], warnings, sourcePath }
    }
    const parsedObj = parsed as Record<string, unknown>
    const items: ItemIndexEntry[] = []
    for (const rawKey of Object.keys(parsedObj)) {
      if (isIgnoredCatalogKey(rawKey)) continue
      const normalized = normalizeItemId(rawKey)
      if (!normalized) continue
      const row = parsedObj[rawKey]
      const name =
        row && typeof row === 'object' && !Array.isArray(row) && typeof (row as Record<string, unknown>).name === 'string'
          ? String((row as Record<string, unknown>).name)
          : rawKey
      const category =
        row && typeof row === 'object' && !Array.isArray(row) && typeof (row as Record<string, unknown>).category === 'string'
          ? String((row as Record<string, unknown>).category)
          : undefined
      const stack =
        row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>).stack : undefined
      const unitBuy =
        row && typeof row === 'object' && !Array.isArray(row)
          ? coerceNumeric((row as Record<string, unknown>).unit_buy)
          : undefined
      items.push({
        id: normalized,
        rawKey,
        name,
        category,
        stack: typeof stack === 'number' || typeof stack === 'string' ? stack : undefined,
        unitBuy,
      })
    }
    items.sort((a, b) => a.id.localeCompare(b.id))
    if (items.length === 0) {
      warnings.push(`No items parsed from ${ALL_JSON}`)
    }
    return { items, warnings, sourcePath }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    warnings.push(`Failed to read ${ALL_JSON}: ${msg}`)
    return { items: [], warnings, sourcePath }
  }
}

/** Map normalized item id -> unit_buy for build resolution. */
export function itemIndexToUnitBuyMap(items: ItemIndexEntry[]): Record<string, number | undefined> {
  const m: Record<string, number | undefined> = {}
  for (const it of items) {
    m[it.id] = it.unitBuy
  }
  return m
}
