const { ipcMain } = require('electron')
const { randomUUID } = require('crypto')

import type { CrateLibraryEntry, CrateLibraryDeleteResult, CratePrizeEntry } from '../../types'
import { loadCrateLibrary, saveCrateLibrary } from '../../crateLibrary'
import { findServersReferencingLibraryCrate, removeLibraryCrateIdFromAllServers } from '../../crateResolve'
import { loadBundledEnchantCatalog, sanitizeEnchantmentsForItem } from '../../enchantIndex'
import { isVirtualKeyPrize, normalizeVirtualKeyPrizeEntry } from '../../shared/crateKeyPresets'
import { loadVirtualCrateKeyValues, saveVirtualCrateKeyValues } from '../../virtualCrateKeyValues'
import type { VirtualCrateKeyValues } from '../../types'

function sanitizeCrateOutputStem(raw: string): string {
  const s = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
  return s.length > 0 ? s : 'Crate'
}

function stemTaken(crates: CrateLibraryEntry[], outputStem: string, exceptId?: string): boolean {
  const n = outputStem.trim().toLowerCase()
  return crates.some((c) => c.id !== exceptId && c.outputStem.trim().toLowerCase() === n)
}

function sanitizePrizeEntries(entries: CratePrizeEntry[]): CratePrizeEntry[] {
  const { catalog } = loadBundledEnchantCatalog()
  const out: CratePrizeEntry[] = []
  for (const raw of entries) {
    const entryId =
      typeof raw?.entryId === 'string' && raw.entryId.trim().length > 0 ? raw.entryId.trim() : randomUUID()
    const draft: CratePrizeEntry = { ...raw, entryId }

    if (isVirtualKeyPrize(draft)) {
      const row = normalizeVirtualKeyPrizeEntry(draft)
      if (raw.override && typeof raw.override === 'object') {
        const o = raw.override
        const override: CratePrizeEntry['override'] = {}
        if (typeof o.weight === 'number' && Number.isFinite(o.weight)) {
          override.weight = Math.max(1, Math.round(o.weight))
        }
        if (o.amount !== undefined) {
          const amount = String(o.amount).trim()
          if (amount.length > 0) override.amount = amount
        }
        if (Object.keys(override).length > 0) row.override = override
      }
      out.push(row)
      continue
    }

    const itemId = String(raw?.itemId ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .toUpperCase()
    if (!itemId) continue
    const row: CratePrizeEntry = { entryId, itemId, prizeKind: 'item' }
    if (raw.override && typeof raw.override === 'object') {
      const o = raw.override
      const override: CratePrizeEntry['override'] = {}
      if (typeof o.weight === 'number' && Number.isFinite(o.weight)) {
        override.weight = Math.max(1, Math.round(o.weight))
      }
      if (o.amount !== undefined) {
        const amount = String(o.amount).trim()
        if (amount.length > 0) override.amount = amount
      }
      if (o.displayName !== undefined) {
        const displayName = String(o.displayName).trim()
        if (displayName.length > 0) override.displayName = displayName
      }
      if (o.enchantments && typeof o.enchantments === 'object' && catalog) {
        const materialId = itemId.toLowerCase()
        const cleaned = sanitizeEnchantmentsForItem(catalog, materialId, o.enchantments as Record<string, number>)
        if (cleaned) override.enchantments = cleaned
      } else if (o.enchantments && typeof o.enchantments === 'object' && !catalog) {
        const cleaned: Record<string, number> = {}
        for (const [k, v] of Object.entries(o.enchantments as Record<string, number>)) {
          const id = String(k).trim().toLowerCase()
          if (!id) continue
          const level = typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.round(v)) : 1
          cleaned[id] = level
        }
        if (Object.keys(cleaned).length > 0) override.enchantments = cleaned
      }
      if (Object.keys(override).length > 0) row.override = override
    }
    out.push(row)
  }
  return out
}

export function registerCrateLibraryHandlers(): void {
  ipcMain.handle('list-crate-library', async () => {
    return loadCrateLibrary()
  })

  ipcMain.handle('get-virtual-crate-key-values', async () => {
    return loadVirtualCrateKeyValues()
  })

  ipcMain.handle('set-virtual-crate-key-values', async (_e: unknown, values: VirtualCrateKeyValues) => {
    return saveVirtualCrateKeyValues(values ?? {})
  })

  ipcMain.handle(
    'create-crate-library-entry',
    async (
      _e: unknown,
      input:
        | {
            name?: string
            description?: string
            outputStem?: string
            accentTag?: string
            crateSlot?: number
            guiItem?: string
            loreLine1?: string
            loreLine2?: string
            animationTitle?: string
            selectedPrizeEntries?: CratePrizeEntry[]
          }
        | undefined
    ) => {
      const crates = loadCrateLibrary()
      const iso = new Date().toISOString()
      const baseStem = sanitizeCrateOutputStem(input?.outputStem ?? input?.name ?? 'New_crate')
      let outputStem = baseStem
      let n = 2
      while (stemTaken(crates, outputStem)) {
        outputStem = sanitizeCrateOutputStem(`${baseStem}_${n}`)
        n += 1
      }
      const baseName = typeof input?.name === 'string' && input.name.trim().length > 0 ? input.name.trim() : outputStem
      const entry: CrateLibraryEntry = {
        id: randomUUID(),
        name: baseName,
        description: typeof input?.description === 'string' ? input.description : undefined,
        outputStem,
        accentTag: typeof input?.accentTag === 'string' && input.accentTag.trim() ? input.accentTag.trim() : undefined,
        crateSlot:
          typeof input?.crateSlot === 'number' && Number.isFinite(input.crateSlot)
            ? Math.round(input.crateSlot)
            : undefined,
        guiItem: typeof input?.guiItem === 'string' && input.guiItem.trim() ? input.guiItem.trim() : undefined,
        loreLine1: typeof input?.loreLine1 === 'string' && input.loreLine1.trim() ? input.loreLine1.trim() : undefined,
        loreLine2: typeof input?.loreLine2 === 'string' && input.loreLine2.trim() ? input.loreLine2.trim() : undefined,
        animationTitle:
          typeof input?.animationTitle === 'string' && input.animationTitle.trim()
            ? input.animationTitle.trim()
            : undefined,
        selectedPrizeEntries: sanitizePrizeEntries(input?.selectedPrizeEntries ?? []),
        createdAt: iso,
        updatedAt: iso,
      }
      crates.push(entry)
      saveCrateLibrary(crates)
      return entry
    }
  )

  ipcMain.handle(
    'update-crate-library-entry',
    async (
      _e: unknown,
      input: {
        id: string
        name?: string
        description?: string
        outputStem?: string
        accentTag?: string
        crateSlot?: number
        guiItem?: string
        loreLine1?: string
        loreLine2?: string
        animationTitle?: string
        selectedPrizeEntries?: CratePrizeEntry[]
      }
    ) => {
      const crates = loadCrateLibrary()
      const idx = crates.findIndex((c) => c.id === input.id)
      if (idx < 0) {
        throw new Error('Crate library entry not found')
      }
      const cur = crates[idx]
      const next: CrateLibraryEntry = { ...cur }
      if (input.name !== undefined) {
        const nm = input.name.trim()
        if (nm.length === 0) {
          throw new Error('Name cannot be empty')
        }
        next.name = nm
      }
      if (input.description !== undefined) {
        next.description = input.description
      }
      if (input.outputStem !== undefined) {
        const stem = sanitizeCrateOutputStem(input.outputStem)
        if (!stem) {
          throw new Error('Output stem cannot be empty')
        }
        if (stemTaken(crates, stem, cur.id)) {
          throw new Error(`Another crate already uses output stem "${stem}"`)
        }
        next.outputStem = stem
      }
      if (input.accentTag !== undefined) {
        next.accentTag = input.accentTag.trim().length > 0 ? input.accentTag.trim() : undefined
      }
      if (input.crateSlot !== undefined) {
        next.crateSlot =
          typeof input.crateSlot === 'number' && Number.isFinite(input.crateSlot) ? Math.round(input.crateSlot) : undefined
      }
      if (input.guiItem !== undefined) {
        next.guiItem = input.guiItem.trim().length > 0 ? input.guiItem.trim() : undefined
      }
      if (input.loreLine1 !== undefined) {
        next.loreLine1 = input.loreLine1.trim().length > 0 ? input.loreLine1.trim() : undefined
      }
      if (input.loreLine2 !== undefined) {
        next.loreLine2 = input.loreLine2.trim().length > 0 ? input.loreLine2.trim() : undefined
      }
      if (input.animationTitle !== undefined) {
        next.animationTitle = input.animationTitle.trim().length > 0 ? input.animationTitle.trim() : undefined
      }
      if (input.selectedPrizeEntries !== undefined) {
        next.selectedPrizeEntries = sanitizePrizeEntries(input.selectedPrizeEntries)
      }
      next.updatedAt = new Date().toISOString()
      crates[idx] = next
      saveCrateLibrary(crates)
      return next
    }
  )

  ipcMain.handle('delete-crate-library-entry', async (_e: unknown, id: string): Promise<CrateLibraryDeleteResult> => {
    const crates = loadCrateLibrary()
    const idx = crates.findIndex((c) => c.id === id)
    if (idx < 0) {
      return { ok: false, error: 'Crate library entry not found' }
    }
    const refs = findServersReferencingLibraryCrate(id)
    removeLibraryCrateIdFromAllServers(id)
    crates.splice(idx, 1)
    saveCrateLibrary(crates)
    return { ok: true, removedFromServers: refs }
  })
}
