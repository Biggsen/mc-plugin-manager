import type { DropTableSelectedEntry, ServerProfile, ResolvedDropTable } from './types'
import { loadDropTableLibrary } from './dropTableLibrary'
import { loadBundledItemIndex, itemIndexToUnitBuyMap } from './itemIndex'
import { normalizeItemId } from './dropTableNormalize'
import { listServerIds, loadServerProfile, saveServerProfile } from './storage'

function normalizeResolvedEntries(
  selectedEntries: DropTableSelectedEntry[] | undefined,
  selectedItems: string[],
  itemOverrides: Record<string, { chance?: number; amount?: string; minLevel?: number; maxLevel?: number }> | undefined
): DropTableSelectedEntry[] {
  if (Array.isArray(selectedEntries) && selectedEntries.length > 0) {
    const out: DropTableSelectedEntry[] = []
    for (const row of selectedEntries) {
      const itemId = normalizeItemId(String(row.itemId ?? ''))
      if (!itemId) continue
      out.push({
        entryId: typeof row.entryId === 'string' && row.entryId.trim().length > 0 ? row.entryId : `${itemId}_${out.length + 1}`,
        itemId,
        override: row.override,
      })
    }
    return out
  }

  return selectedItems.map((itemId, idx) => {
    const normalized = normalizeItemId(String(itemId))
    return {
      entryId: `${normalized}_${idx + 1}`,
      itemId: normalized,
      override: itemOverrides?.[normalized] ?? itemOverrides?.[normalized.toLowerCase()],
    }
  })
}

export function resolveDropTablesForServer(profile: ServerProfile): {
  resolved: ResolvedDropTable[]
  warnings: string[]
} {
  const warnings: string[] = []
  const library = loadDropTableLibrary()
  const byId = new Map(library.map((e) => [e.id, e]))
  const { items } = loadBundledItemIndex()
  const unitBuyByItem = itemIndexToUnitBuyMap(items)
  const knownItemIds = new Set(items.map((i) => i.id))

  const ids = profile.dropTables?.libraryTableIds ?? []
  const resolved: ResolvedDropTable[] = []

  for (const rawId of ids) {
    const entry = byId.get(rawId)
    if (!entry) {
      warnings.push(`Drop table library entry not found for id "${rawId}" — skipped`)
      continue
    }
    const tableName = entry.name.trim()
    if (!tableName) {
      warnings.push(`Library entry "${entry.id}" has empty name — skipped`)
      continue
    }
    const selectedEntries = normalizeResolvedEntries(
      entry.selectedEntries,
      entry.selectedItems ?? [],
      entry.itemOverrides
    ).filter((row) => {
        if (!knownItemIds.has(row.itemId)) {
          warnings.push(`Unknown item "${row.itemId}" in table "${tableName}" — skipped`)
          return false
        }
        return true
      })
    if (selectedEntries.length === 0) {
      continue
    }
    const itemValues: Record<string, number | undefined> = {}
    for (const row of selectedEntries) {
      itemValues[row.itemId] = unitBuyByItem[row.itemId]
    }
    resolved.push({
      tableName,
      libraryEntryId: entry.id,
      selectedEntries,
      selectedItems: selectedEntries.map((row) => row.itemId),
      itemOverrides: entry.itemOverrides,
      itemValues,
    })
  }

  return { resolved, warnings }
}

/** All LM YAML table keys owned by the app (for merge delete-before-write). */
export function allLibraryTableNames(): string[] {
  const library = loadDropTableLibrary()
  const names = new Set<string>()
  for (const e of library) {
    const n = e.name.trim()
    if (n.length > 0) names.add(n)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

export function findServersReferencingLibraryTable(tableId: string): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  for (const id of listServerIds()) {
    const p = loadServerProfile(id)
    if (!p) continue
    const ids = p.dropTables?.libraryTableIds ?? []
    if (ids.includes(tableId)) {
      out.push({ id: p.id, name: p.name })
    }
  }
  return out
}

export function removeLibraryTableIdFromAllServers(tableId: string): { id: string; name: string }[] {
  const touched: { id: string; name: string }[] = []
  for (const id of listServerIds()) {
    const p = loadServerProfile(id)
    if (!p) continue
    const cur = p.dropTables?.libraryTableIds ?? []
    if (!cur.includes(tableId)) continue
    p.dropTables = {
      libraryTableIds: cur.filter((x) => x !== tableId),
    }
    saveServerProfile(p)
    touched.push({ id: p.id, name: p.name })
  }
  return touched
}
