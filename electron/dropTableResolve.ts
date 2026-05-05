import type { ServerProfile, ResolvedDropTable } from './types'
import { loadDropTableLibrary } from './dropTableLibrary'
import { loadBundledItemIndex, itemIndexToUnitBuyMap } from './itemIndex'
import { normalizeItemId } from './dropTableNormalize'
import { listServerIds, loadServerProfile, saveServerProfile } from './storage'

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
    const selected = (entry.selectedItems ?? [])
      .map((s) => normalizeItemId(String(s)))
      .filter((id) => {
        if (!knownItemIds.has(id)) {
          warnings.push(`Unknown item "${id}" in table "${tableName}" — skipped`)
          return false
        }
        return true
      })
    if (selected.length === 0) {
      continue
    }
    const itemValues: Record<string, number | undefined> = {}
    for (const itemId of selected) {
      itemValues[itemId] = unitBuyByItem[itemId]
    }
    resolved.push({
      tableName,
      libraryEntryId: entry.id,
      selectedItems: [...selected].sort((a, b) => a.localeCompare(b)),
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
