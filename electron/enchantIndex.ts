const { readFileSync, existsSync } = require('fs')
const path = require('path')
const electron = require('electron')

export const ENCHANTMENTS_DATA_JSON = 'enchantments-data.json'

export interface EnchantDefinition {
  name: string
  maxLevel: number
  category: string
  exclude?: string[]
}

export interface ItemEnchantMeta {
  enchantable: boolean
  categories: string[]
}

export interface EnchantCatalog {
  schemaVersion: number
  enchants: Record<string, EnchantDefinition>
  items: Record<string, ItemEnchantMeta>
}

export interface EnchantIndexEntry {
  id: string
  name: string
  maxLevel: number
  category: string
  exclude: string[]
}

export function getBundledEnchantDataPath(): string {
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  const dataDir = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'data')
    : path.join(basePath, 'reference', 'data')
  return path.join(dataDir, ENCHANTMENTS_DATA_JSON)
}

export function loadBundledEnchantCatalog(): {
  catalog: EnchantCatalog | null
  warnings: string[]
  sourcePath: string
} {
  const warnings: string[] = []
  const sourcePath = getBundledEnchantDataPath()
  if (!existsSync(sourcePath)) {
    warnings.push(`Enchant catalog not found: ${sourcePath}`)
    return { catalog: null, warnings, sourcePath }
  }
  try {
    const parsed = JSON.parse(readFileSync(sourcePath, 'utf-8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      warnings.push(`Expected JSON object in ${ENCHANTMENTS_DATA_JSON}`)
      return { catalog: null, warnings, sourcePath }
    }
    const doc = parsed as Record<string, unknown>
    const enchants = doc.enchants
    const items = doc.items
    if (!enchants || typeof enchants !== 'object' || Array.isArray(enchants)) {
      warnings.push('Missing enchants map')
      return { catalog: null, warnings, sourcePath }
    }
    if (!items || typeof items !== 'object' || Array.isArray(items)) {
      warnings.push('Missing items map')
      return { catalog: null, warnings, sourcePath }
    }
    const catalog: EnchantCatalog = {
      schemaVersion: typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1,
      enchants: enchants as Record<string, EnchantDefinition>,
      items: items as Record<string, ItemEnchantMeta>,
    }
    return { catalog, warnings, sourcePath }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    warnings.push(`Failed to read ${ENCHANTMENTS_DATA_JSON}: ${msg}`)
    return { catalog: null, warnings, sourcePath }
  }
}

export function listEnchantDefinitions(catalog: EnchantCatalog): EnchantIndexEntry[] {
  const out: EnchantIndexEntry[] = []
  for (const id of Object.keys(catalog.enchants).sort()) {
    const row = catalog.enchants[id]
    if (!row || typeof row !== 'object') continue
    out.push({
      id,
      name: typeof row.name === 'string' ? row.name : id,
      maxLevel:
        typeof row.maxLevel === 'number' && Number.isFinite(row.maxLevel) ? Math.max(1, Math.round(row.maxLevel)) : 1,
      category: typeof row.category === 'string' ? row.category : '',
      exclude: Array.isArray(row.exclude) ? row.exclude.map((x) => String(x).toLowerCase()) : [],
    })
  }
  return out
}

export function getItemEnchantMeta(catalog: EnchantCatalog, materialId: string): ItemEnchantMeta | undefined {
  const key = materialId.trim().toLowerCase()
  return catalog.items[key]
}

export function isEnchantCompatibleWithItem(
  catalog: EnchantCatalog,
  materialId: string,
  enchantId: string
): boolean {
  const meta = getItemEnchantMeta(catalog, materialId)
  const enchant = catalog.enchants[enchantId]
  if (!meta?.categories?.length || !enchant?.category) return false
  return meta.categories.includes(enchant.category)
}

export function enchantConflictsWithSet(
  catalog: EnchantCatalog,
  enchantId: string,
  selected: Record<string, number>
): string | null {
  const def = catalog.enchants[enchantId]
  if (!def) return 'Unknown enchantment'
  const selectedIds = Object.keys(selected)
  for (const otherId of selectedIds) {
    if (otherId === enchantId) continue
    const other = catalog.enchants[otherId]
    if (!other) continue
    if (def.exclude?.includes(otherId)) return `Conflicts with ${other.name ?? otherId}`
    if (other.exclude?.includes(enchantId)) return `Conflicts with ${other.name ?? otherId}`
  }
  return null
}

export function getCompatibleEnchantsForItem(
  catalog: EnchantCatalog,
  materialId: string
): EnchantIndexEntry[] {
  const meta = getItemEnchantMeta(catalog, materialId)
  if (!meta) return []
  const all = listEnchantDefinitions(catalog)
  return all.filter((e) => meta.categories.includes(e.category))
}

export function sanitizeEnchantmentsForItem(
  catalog: EnchantCatalog,
  materialId: string,
  raw: Record<string, number> | undefined
): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [enchantId, level] of Object.entries(raw)) {
    const id = enchantId.trim().toLowerCase()
    if (!id) continue
    if (!isEnchantCompatibleWithItem(catalog, materialId, id)) continue
    const def = catalog.enchants[id]
    if (!def) continue
    const max = typeof def.maxLevel === 'number' ? def.maxLevel : 1
    const n = typeof level === 'number' && Number.isFinite(level) ? Math.round(level) : 1
    out[id] = Math.min(max, Math.max(1, n))
  }
  const ids = Object.keys(out)
  if (ids.length === 0) return undefined
  for (const id of ids) {
    const conflict = enchantConflictsWithSet(catalog, id, out)
    if (conflict) delete out[id]
  }
  return Object.keys(out).length > 0 ? out : undefined
}
