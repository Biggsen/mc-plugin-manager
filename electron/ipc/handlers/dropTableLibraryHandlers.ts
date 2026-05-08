const { ipcMain } = require('electron')
const { randomUUID } = require('crypto')

import type {
  DropTableLibraryEntry,
  DropTableLibraryDeleteResult,
  DropTableItemOverride,
  DropTableSelectedEntry,
} from '../../types'
import { loadDropTableLibrary, saveDropTableLibrary } from '../../dropTableLibrary'
import { loadBundledItemIndex } from '../../itemIndex'
import { normalizeItemId } from '../../dropTableNormalize'
import { findServersReferencingLibraryTable, removeLibraryTableIdFromAllServers } from '../../dropTableResolve'

function sanitizeLmTableName(raw: string): string {
  const s = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
  return s.length > 0 ? s : 'drop_table'
}

function nameTaken(tables: DropTableLibraryEntry[], name: string, exceptId?: string): boolean {
  const n = name.trim().toLowerCase()
  return tables.some((t) => t.id !== exceptId && t.name.trim().toLowerCase() === n)
}

function sanitizeOverrides(overrides: Record<string, DropTableItemOverride>): Record<string, DropTableItemOverride> {
  const out: Record<string, DropTableItemOverride> = {}
  for (const [k, v] of Object.entries(overrides)) {
    const nk = normalizeItemId(k)
    if (!nk) continue
    const row: DropTableItemOverride = {}
    if (typeof v?.chance === 'number' && Number.isFinite(v.chance)) row.chance = v.chance
    if (v?.amount !== undefined) {
      const amount = String(v.amount).trim()
      if (amount.length > 0) row.amount = amount
    }
    if (typeof v?.minLevel === 'number' && Number.isFinite(v.minLevel)) row.minLevel = v.minLevel
    if (typeof v?.maxLevel === 'number' && Number.isFinite(v.maxLevel)) row.maxLevel = v.maxLevel
    if (Object.keys(row).length) out[nk] = row
  }
  return out
}

function sanitizeOverrideValue(input: DropTableItemOverride | undefined): DropTableItemOverride | undefined {
  const row: DropTableItemOverride = {}
  if (typeof input?.chance === 'number' && Number.isFinite(input.chance)) row.chance = input.chance
  if (input?.amount !== undefined) {
    const amount = String(input.amount).trim()
    if (amount.length > 0) row.amount = amount
  }
  if (typeof input?.minLevel === 'number' && Number.isFinite(input.minLevel)) row.minLevel = input.minLevel
  if (typeof input?.maxLevel === 'number' && Number.isFinite(input.maxLevel)) row.maxLevel = input.maxLevel
  return Object.keys(row).length > 0 ? row : undefined
}

function sanitizeSelectedEntries(entries: DropTableSelectedEntry[]): DropTableSelectedEntry[] {
  const out: DropTableSelectedEntry[] = []
  for (const raw of entries) {
    const itemId = normalizeItemId(String(raw?.itemId ?? ''))
    if (!itemId) continue
    const entryId =
      typeof raw?.entryId === 'string' && raw.entryId.trim().length > 0 ? raw.entryId.trim() : randomUUID()
    out.push({
      entryId,
      itemId,
      override: sanitizeOverrideValue(raw.override),
    })
  }
  return out
}

export function registerDropTableLibraryHandlers(): void {
  ipcMain.handle('scan-item-index', async () => {
    const { items, warnings, sourcePath } = loadBundledItemIndex()
    return { items, warnings, sourcePath }
  })

  ipcMain.handle('list-drop-table-library', async () => {
    return loadDropTableLibrary()
  })

  ipcMain.handle(
    'create-drop-table',
    async (_e: unknown, input: { name?: string; description?: string } | undefined) => {
      const tables = loadDropTableLibrary()
      const iso = new Date().toISOString()
      const baseName = sanitizeLmTableName(input?.name ?? 'New_drop_table')
      let name = baseName
      let n = 2
      while (nameTaken(tables, name)) {
        name = sanitizeLmTableName(`${baseName}_${n}`)
        n += 1
      }
      const entry: DropTableLibraryEntry = {
        id: randomUUID(),
        name,
        description: typeof input?.description === 'string' ? input.description : undefined,
        selectedEntries: [],
        selectedItems: [],
        itemOverrides: {},
        createdAt: iso,
        updatedAt: iso,
      }
      tables.push(entry)
      saveDropTableLibrary(tables)
      return entry
    }
  )

  ipcMain.handle(
    'update-drop-table',
    async (
      _e: unknown,
      input: {
        id: string
        name?: string
        description?: string
        selectedEntries?: DropTableSelectedEntry[]
        selectedItems?: string[]
        itemOverrides?: Record<string, DropTableItemOverride>
      }
    ) => {
      const tables = loadDropTableLibrary()
      const idx = tables.findIndex((t) => t.id === input.id)
      if (idx < 0) {
        throw new Error('Drop table not found')
      }
      const cur = tables[idx]
      const next: DropTableLibraryEntry = { ...cur }
      if (input.name !== undefined) {
        const nm = sanitizeLmTableName(input.name)
        if (nameTaken(tables, nm, cur.id)) {
          throw new Error(`Another table already uses the name "${nm}"`)
        }
        next.name = nm
      }
      if (input.description !== undefined) {
        next.description = input.description
      }
      const selectedEntriesInput = input.selectedEntries
      const hasSelectedEntries = selectedEntriesInput !== undefined
      if (hasSelectedEntries) {
        next.selectedEntries = sanitizeSelectedEntries(selectedEntriesInput)
        // Keep legacy projections in sync for older readers.
        next.selectedItems = next.selectedEntries.map((entry) => entry.itemId)
        next.itemOverrides = {}
      }
      // Only apply legacy fields when the v2 instance-based shape is not provided.
      if (!hasSelectedEntries && input.selectedItems !== undefined) {
        next.selectedItems = [
          ...input.selectedItems.map((s) => normalizeItemId(String(s))),
        ].filter(Boolean)
      }
      if (!hasSelectedEntries && input.itemOverrides !== undefined) {
        next.itemOverrides = sanitizeOverrides(input.itemOverrides)
      }
      next.updatedAt = new Date().toISOString()
      tables[idx] = next
      saveDropTableLibrary(tables)
      return next
    }
  )

  ipcMain.handle('delete-drop-table', async (_e: unknown, id: string): Promise<DropTableLibraryDeleteResult> => {
    const tables = loadDropTableLibrary()
    const idx = tables.findIndex((t) => t.id === id)
    if (idx < 0) {
      return { ok: false, error: 'Drop table not found' }
    }
    const refs = findServersReferencingLibraryTable(id)
    removeLibraryTableIdFromAllServers(id)
    tables.splice(idx, 1)
    saveDropTableLibrary(tables)
    return { ok: true, removedFromServers: refs }
  })
}
