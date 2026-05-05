const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

import type { DropTableLibraryEntry } from './types'
import { getDataDirectory } from './storage'

const FILE_NAME = 'drop-table-library.json'

interface LibraryFileShape {
  version: number
  tables: DropTableLibraryEntry[]
}

function getLibraryPath(): string {
  return join(getDataDirectory(), FILE_NAME)
}

export function loadDropTableLibrary(): DropTableLibraryEntry[] {
  const p = getLibraryPath()
  if (!existsSync(p)) {
    return []
  }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as unknown
    if (!raw || typeof raw !== 'object') {
      return []
    }
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.tables)) {
      return obj.tables.filter(isValidLibraryEntry)
    }
    return []
  } catch (e) {
    console.error('Failed to load drop table library:', e)
    return []
  }
}

function isValidLibraryEntry(row: unknown): row is DropTableLibraryEntry {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  if (
    typeof r.id !== 'string' ||
    typeof r.name !== 'string' ||
    !Array.isArray(r.selectedItems) ||
    typeof r.createdAt !== 'string' ||
    typeof r.updatedAt !== 'string'
  ) {
    return false
  }
  if (r.itemOverrides !== undefined && (typeof r.itemOverrides !== 'object' || r.itemOverrides === null)) {
    return false
  }
  return true
}

export function saveDropTableLibrary(tables: DropTableLibraryEntry[]): void {
  const dataDir = getDataDirectory()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  const payload: LibraryFileShape = { version: 1, tables }
  writeFileSync(getLibraryPath(), JSON.stringify(payload, null, 2), 'utf-8')
}

export function getDropTableLibraryPath(): string {
  return getLibraryPath()
}
