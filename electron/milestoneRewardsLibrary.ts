const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs')
const yaml = require('yaml')
const { randomUUID } = require('crypto')

import type {
  AAMilestoneCategoryKey,
  AAMilestoneCategorySlots,
  AAMilestoneReward,
  MilestoneRewardsLibraryEntry,
} from './types'
import { getDataDirectory } from './storage'
import { resolveConfigPath } from './utils/configPathResolver'

const FILE_NAME = 'milestone-rewards-library.json'

interface LibraryFileShape {
  version: number
  profiles: MilestoneRewardsLibraryEntry[]
}

const VALID_CATEGORY_KEYS = new Set<AAMilestoneCategoryKey>([
  'villages_discovered',
  'regions_discovered',
  'hearts_discovered',
  'nerves_discovered',
  'nether_regions_discovered',
  'nether_hearts_discovered',
  'structures_found',
])

type SlotKey = keyof AAMilestoneCategorySlots

const IMPORT_SLOT_KEYS: Record<
  AAMilestoneCategoryKey,
  Partial<Record<SlotKey, string>>
> = {
  villages_discovered: { first: '1', half: '_half', all: '_all' },
  regions_discovered: { first: '2', half: '_half', all: '_all' },
  hearts_discovered: { first: '1', half: '_half', all: '_all' },
  nerves_discovered: { first: '1', half: '_half', all: '_all' },
  nether_regions_discovered: { first: '1', half: '4', all: '8' },
  nether_hearts_discovered: { first: '1', half: '4', all: '8' },
  structures_found: {
    quarter: '_quarter',
    half: '_half',
    threeQuarter: '_threeQuarter',
    all: '_all',
  },
}

const STRUCTURES_DEFAULT_CLAIM: Record<'quarter' | 'half' | 'threeQuarter' | 'all', number> = {
  quarter: 200,
  half: 200,
  threeQuarter: 200,
  all: 500,
}

function getLibraryPath(): string {
  return require('path').join(getDataDirectory(), FILE_NAME)
}

function normalizeExecuteToLines(execute: unknown): string[] {
  if (Array.isArray(execute)) return execute.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof execute === 'string' && execute.trim()) return [execute.trim()]
  return []
}

function rewardFromBundledReward(reward: unknown): AAMilestoneReward | undefined {
  if (!reward || typeof reward !== 'object') return undefined
  const r = reward as Record<string, unknown>
  const out: AAMilestoneReward = {}
  if (typeof r.Experience === 'number' && Number.isFinite(r.Experience)) {
    out.experience = r.Experience
  }
  if (r.Item !== undefined) {
    if (typeof r.Item === 'string' && r.Item.trim()) {
      out.items = r.Item.trim()
    } else if (Array.isArray(r.Item)) {
      const items = r.Item.map(String).map((s) => s.trim()).filter(Boolean)
      if (items.length > 0) out.items = items
    }
  }
  const cmd = r.Command
  if (cmd && typeof cmd === 'object') {
    const c = cmd as Record<string, unknown>
    const execute = normalizeExecuteToLines(c.Execute)
    if (execute.length > 0) {
      out.command = { execute }
      if (typeof c.Display === 'string' && c.Display.trim()) {
        out.command.display = c.Display.trim()
      }
    }
  }
  if (out.experience === undefined && out.items === undefined && !out.command) {
    return undefined
  }
  return out
}

function claimblocksReward(amount: number): AAMilestoneReward {
  return {
    command: {
      execute: [`acb PLAYER +${amount}`],
      display: `${amount} claimblocks`,
    },
  }
}

function entryAtKey(cat: Record<string, unknown>, key: string): unknown {
  return cat[key]
}

export function extractCategorySlotsFromBundled(
  categoryKey: AAMilestoneCategoryKey,
  templateCategory: Record<string, unknown>
): AAMilestoneCategorySlots {
  const slots: AAMilestoneCategorySlots = {}
  const keyMap = IMPORT_SLOT_KEYS[categoryKey]
  if (!keyMap) return slots

  for (const [slot, yamlKey] of Object.entries(keyMap) as [SlotKey, string][]) {
    const entry = entryAtKey(templateCategory, yamlKey)
    if (!entry || typeof entry !== 'object') {
      if (categoryKey === 'structures_found' && slot in STRUCTURES_DEFAULT_CLAIM) {
        const amount = STRUCTURES_DEFAULT_CLAIM[slot as keyof typeof STRUCTURES_DEFAULT_CLAIM]
        slots[slot] = claimblocksReward(amount)
      }
      continue
    }
    const reward = rewardFromBundledReward((entry as Record<string, unknown>).Reward)
    if (reward) {
      slots[slot] = reward
    } else if (categoryKey === 'structures_found' && slot in STRUCTURES_DEFAULT_CLAIM) {
      const amount = STRUCTURES_DEFAULT_CLAIM[slot as keyof typeof STRUCTURES_DEFAULT_CLAIM]
      slots[slot] = claimblocksReward(amount)
    }
  }
  return slots
}

export function importCategoriesFromBundledConfig(): Partial<
  Record<AAMilestoneCategoryKey, AAMilestoneCategorySlots>
> {
  const configPath = resolveConfigPath('aa')
  const parsed = yaml.parse(readFileSync(configPath, 'utf-8')) as { Custom?: Record<string, unknown> }
  const custom = parsed?.Custom ?? {}
  const categories: Partial<Record<AAMilestoneCategoryKey, AAMilestoneCategorySlots>> = {}

  for (const key of VALID_CATEGORY_KEYS) {
    const cat = custom[key]
    if (!cat || typeof cat !== 'object') continue
    const slots = extractCategorySlotsFromBundled(key, cat as Record<string, unknown>)
    if (Object.keys(slots).length > 0) {
      categories[key] = slots
    }
  }
  return categories
}

function isValidReward(row: unknown): row is AAMilestoneReward {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  if (r.experience !== undefined && (typeof r.experience !== 'number' || !Number.isFinite(r.experience))) {
    return false
  }
  if (r.items !== undefined) {
    if (typeof r.items === 'string') {
      if (!r.items.trim()) return false
    } else if (!Array.isArray(r.items) || !r.items.every((x) => typeof x === 'string' && x.trim())) {
      return false
    }
  }
  if (r.command !== undefined) {
    if (typeof r.command !== 'object' || r.command === null) return false
    const c = r.command as Record<string, unknown>
    if (!Array.isArray(c.execute) || !c.execute.every((x) => typeof x === 'string')) return false
    if (c.display !== undefined && typeof c.display !== 'string') return false
  }
  return true
}

function sanitizeReward(raw: unknown): AAMilestoneReward | undefined {
  if (!isValidReward(raw)) return undefined
  const out: AAMilestoneReward = {}
  if (raw.experience !== undefined) out.experience = raw.experience
  if (raw.items !== undefined) {
    if (typeof raw.items === 'string') {
      const s = raw.items.trim()
      if (s) out.items = s
    } else {
      const items = raw.items.map((s) => s.trim()).filter(Boolean)
      if (items.length) out.items = items
    }
  }
  if (raw.command?.execute?.length) {
    const execute = [...new Set(raw.command.execute.map((s) => s.trim()).filter(Boolean))]
    if (execute.length) {
      out.command = { execute }
      const d = raw.command.display?.trim()
      if (d) out.command.display = d
    }
  }
  if (out.experience === undefined && out.items === undefined && !out.command) {
    return undefined
  }
  return out
}

function sanitizeCategorySlots(raw: unknown): AAMilestoneCategorySlots {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: AAMilestoneCategorySlots = {}
  for (const key of ['first', 'half', 'all', 'quarter', 'threeQuarter'] as SlotKey[]) {
    if (r[key] !== undefined) {
      const reward = sanitizeReward(r[key])
      if (reward) out[key] = reward
    }
  }
  return out
}

export function sanitizeMilestoneCategories(
  raw: unknown
): Partial<Record<AAMilestoneCategoryKey, AAMilestoneCategorySlots>> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Partial<Record<AAMilestoneCategoryKey, AAMilestoneCategorySlots>> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_CATEGORY_KEYS.has(k as AAMilestoneCategoryKey)) continue
    const slots = sanitizeCategorySlots(v)
    if (Object.keys(slots).length > 0) {
      out[k as AAMilestoneCategoryKey] = slots
    }
  }
  return out
}

function isValidLibraryEntry(row: unknown): row is MilestoneRewardsLibraryEntry {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.createdAt === 'string' &&
    typeof r.updatedAt === 'string' &&
    (r.categories === undefined || typeof r.categories === 'object')
  )
}

function normalizeEntry(row: MilestoneRewardsLibraryEntry): MilestoneRewardsLibraryEntry {
  return {
    ...row,
    name: row.name.trim(),
    categories: sanitizeMilestoneCategories(row.categories),
  }
}

function readProfilesFromDisk(): MilestoneRewardsLibraryEntry[] {
  const p = getLibraryPath()
  if (!existsSync(p)) return []
  try {
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as unknown
    if (!raw || typeof raw !== 'object') return []
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.profiles)) {
      return obj.profiles.filter(isValidLibraryEntry).map(normalizeEntry)
    }
    return []
  } catch (e) {
    console.error('Failed to load milestone rewards library:', e)
    return []
  }
}

export function saveMilestoneRewardsLibrary(profiles: MilestoneRewardsLibraryEntry[]): void {
  const dataDir = getDataDirectory()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  const payload: LibraryFileShape = { version: 1, profiles }
  writeFileSync(getLibraryPath(), JSON.stringify(payload, null, 2), 'utf-8')
}

export function ensureDefaultMilestoneRewardsProfile(): MilestoneRewardsLibraryEntry[] {
  let profiles = readProfilesFromDisk()
  if (profiles.length > 0) return profiles

  const iso = new Date().toISOString()
  const entry: MilestoneRewardsLibraryEntry = {
    id: randomUUID(),
    name: 'Default (bundled)',
    categories: importCategoriesFromBundledConfig(),
    createdAt: iso,
    updatedAt: iso,
  }
  profiles = [entry]
  saveMilestoneRewardsLibrary(profiles)
  return profiles
}

export function loadMilestoneRewardsLibrary(): MilestoneRewardsLibraryEntry[] {
  return ensureDefaultMilestoneRewardsProfile()
}

export function getMilestoneRewardsLibraryPath(): string {
  return getLibraryPath()
}
