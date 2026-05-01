const { readdirSync, readFileSync, existsSync } = require('fs')
const path = require('path')
const electron = require('electron')

import type { DropTableCatalogSummary } from './types'

function normalizeItemId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toUpperCase()
}

function isIgnoredCatalogKey(key: string): boolean {
  return key.startsWith('_')
}

export function loadDropTableCatalogsFromDirectory(
  dirPath: string
): { catalogs: DropTableCatalogSummary[]; warnings: string[] } {
  const warnings: string[] = []
  const catalogs: DropTableCatalogSummary[] = []
  const trimmed = String(dirPath ?? '').trim()

  if (!trimmed) {
    return { catalogs, warnings: ['Drop table catalog directory is not configured'] }
  }
  if (!existsSync(trimmed)) {
    return { catalogs, warnings: [`Drop table catalog directory not found: ${trimmed}`] }
  }

  const files = readdirSync(trimmed).filter((name: string) => name.toLowerCase().endsWith('.json')).sort()
  for (const file of files) {
    const filePath = path.join(trimmed, file)
    const tableName = path.basename(file, '.json')
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        warnings.push(`Skipped ${file}: expected JSON object root`)
        continue
      }

      const itemIds = Object.keys(parsed)
        .filter((k) => !isIgnoredCatalogKey(k))
        .map(normalizeItemId)
        .filter((k) => k.length > 0)
        .sort((a, b) => a.localeCompare(b))

      catalogs.push({
        tableName,
        sourcePath: filePath,
        itemIds,
        itemCount: itemIds.length,
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      warnings.push(`Skipped ${file}: ${msg}`)
    }
  }

  if (catalogs.length === 0) {
    warnings.push(`No valid JSON category catalogs found in ${trimmed}`)
  }

  return { catalogs, warnings }
}

export function getBundledDropTableCatalogDirectory(): string {
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  return isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'data')
    : path.join(basePath, 'reference', 'data')
}

export function loadBundledDropTableCatalogs(): {
  catalogs: DropTableCatalogSummary[]
  warnings: string[]
  sourceDir: string
} {
  const sourceDir = getBundledDropTableCatalogDirectory()
  const result = loadDropTableCatalogsFromDirectory(sourceDir)
  return { ...result, sourceDir }
}

module.exports = {
  loadDropTableCatalogsFromDirectory,
  getBundledDropTableCatalogDirectory,
  loadBundledDropTableCatalogs,
}
