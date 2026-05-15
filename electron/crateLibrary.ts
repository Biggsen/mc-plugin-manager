const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

import type { CrateLibraryEntry, CratePrizeEntry } from './types'
import { getDataDirectory } from './storage'

const FILE_NAME = 'crazy-crates-library.json'

interface LibraryFileShape {
  version: number
  crates: CrateLibraryEntry[]
}

function getLibraryPath(): string {
  return join(getDataDirectory(), FILE_NAME)
}

function isValidPrizeEntry(row: unknown): row is CratePrizeEntry {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  if (typeof r.entryId !== 'string' || typeof r.itemId !== 'string') return false
  if (r.prizeKind !== undefined && r.prizeKind !== 'item' && r.prizeKind !== 'virtual_key') return false
  if (r.keyId !== undefined && typeof r.keyId !== 'string') return false
  if (r.override !== undefined) {
    if (typeof r.override !== 'object' || r.override === null) return false
    const o = r.override as Record<string, unknown>
    if (o.weight !== undefined && (typeof o.weight !== 'number' || !Number.isFinite(o.weight))) return false
    if (o.amount !== undefined && typeof o.amount !== 'string') return false
    if (o.displayName !== undefined && typeof o.displayName !== 'string') return false
    if (o.enchantments !== undefined) {
      if (typeof o.enchantments !== 'object' || o.enchantments === null || Array.isArray(o.enchantments)) return false
      for (const v of Object.values(o.enchantments as Record<string, unknown>)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) return false
      }
    }
  }
  return true
}

function normalizePrizeEntries(raw: unknown): CratePrizeEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isValidPrizeEntry)
}

function isValidLibraryEntry(row: unknown): row is CrateLibraryEntry {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  if (
    typeof r.id !== 'string' ||
    typeof r.name !== 'string' ||
    typeof r.outputStem !== 'string' ||
    typeof r.createdAt !== 'string' ||
    typeof r.updatedAt !== 'string'
  ) {
    return false
  }
  if (r.description !== undefined && typeof r.description !== 'string') return false
  if (r.accentTag !== undefined && typeof r.accentTag !== 'string') return false
  if (r.guiItem !== undefined && typeof r.guiItem !== 'string') return false
  if (r.loreLine1 !== undefined && typeof r.loreLine1 !== 'string') return false
  if (r.loreLine2 !== undefined && typeof r.loreLine2 !== 'string') return false
  if (r.animationTitle !== undefined && typeof r.animationTitle !== 'string') return false
  if (r.crateSlot !== undefined && (typeof r.crateSlot !== 'number' || !Number.isFinite(r.crateSlot))) return false
  return true
}

function normalizeEntry(row: CrateLibraryEntry): CrateLibraryEntry {
  return {
    ...row,
    selectedPrizeEntries: normalizePrizeEntries(row.selectedPrizeEntries),
  }
}

export function loadCrateLibrary(): CrateLibraryEntry[] {
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
    if (Array.isArray(obj.crates)) {
      return obj.crates.filter(isValidLibraryEntry).map(normalizeEntry)
    }
    return []
  } catch (e) {
    console.error('Failed to load CrazyCrates library:', e)
    return []
  }
}

export function saveCrateLibrary(crates: CrateLibraryEntry[]): void {
  const dataDir = getDataDirectory()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  const payload: LibraryFileShape = { version: 1, crates }
  writeFileSync(getLibraryPath(), JSON.stringify(payload, null, 2), 'utf-8')
}

export function getCrateLibraryPath(): string {
  return getLibraryPath()
}
