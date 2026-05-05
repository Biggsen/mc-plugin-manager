const { ipcMain } = require('electron')
const { randomUUID } = require('crypto')

import type {
  DropTableLibraryEntry,
  DropTableLibraryDeleteResult,
  DropTableItemOverride,
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
    if (v?.amount !== undefined && v?.amount !== '') row.amount = v.amount
    if (Object.keys(row).length) out[nk] = row
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
        filterMinPrice?: number
        filterMaxPrice?: number
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
      if (Object.prototype.hasOwnProperty.call(input, 'filterMinPrice')) {
        next.filterMinPrice =
          typeof input.filterMinPrice === 'number' && Number.isFinite(input.filterMinPrice)
            ? Math.max(0, input.filterMinPrice)
            : undefined
      }
      if (Object.prototype.hasOwnProperty.call(input, 'filterMaxPrice')) {
        next.filterMaxPrice =
          typeof input.filterMaxPrice === 'number' && Number.isFinite(input.filterMaxPrice)
            ? Math.max(0, input.filterMaxPrice)
            : undefined
      }
      if (input.selectedItems !== undefined) {
        next.selectedItems = [
          ...new Set(input.selectedItems.map((s) => normalizeItemId(String(s)))).values(),
        ].filter(Boolean)
      }
      if (input.itemOverrides !== undefined) {
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
