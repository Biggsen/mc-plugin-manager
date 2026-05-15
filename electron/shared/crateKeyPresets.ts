import type { CratePrizeEntry, CrateVirtualKeyId } from '../types'

export type VirtualCrateKeyValues = Partial<Record<CrateVirtualKeyId, number>>

export interface CrateVirtualKeyPreset {
  id: CrateVirtualKeyId
  buttonLabel: string
  listLabel: string
  displayName: string
  displayItem: string
  crazyCratesCrateName: string
  sentinelItemId: string
}

export const CRATE_VIRTUAL_KEY_PRESETS: CrateVirtualKeyPreset[] = [
  {
    id: 'heart',
    buttonLabel: 'Heart Crate Key',
    listLabel: 'Heart Crate Key',
    displayName: '<white>Heart Crate Key',
    displayItem: 'tripwire_hook',
    crazyCratesCrateName: 'HeartCrate',
    sentinelItemId: 'CRATE_KEY_HEART',
  },
  {
    id: 'region',
    buttonLabel: 'Region Crate Key',
    listLabel: 'Region Crate Key',
    displayName: '<white>Region Crate Key',
    displayItem: 'tripwire_hook',
    crazyCratesCrateName: 'RegionCrate',
    sentinelItemId: 'CRATE_KEY_REGION',
  },
  {
    id: 'village',
    buttonLabel: 'Village Crate Key',
    listLabel: 'Village Crate Key',
    displayName: '<white>Village Crate Key',
    displayItem: 'tripwire_hook',
    crazyCratesCrateName: 'VillageCrate',
    sentinelItemId: 'CRATE_KEY_VILLAGE',
  },
  {
    id: 'nerve',
    buttonLabel: 'Nerve Crate Key',
    listLabel: 'Nerve Crate Key',
    displayName: '<white>Nerve Crate Key',
    displayItem: 'tripwire_hook',
    crazyCratesCrateName: 'NerveCrate',
    sentinelItemId: 'CRATE_KEY_NERVE',
  },
]

const PRESET_BY_ID = new Map(CRATE_VIRTUAL_KEY_PRESETS.map((p) => [p.id, p]))
const PRESET_BY_SENTINEL = new Map(CRATE_VIRTUAL_KEY_PRESETS.map((p) => [p.sentinelItemId, p]))

export function isValidVirtualKeyId(raw: unknown): raw is CrateVirtualKeyId {
  return typeof raw === 'string' && PRESET_BY_ID.has(raw as CrateVirtualKeyId)
}

export function getVirtualKeyPreset(keyId: CrateVirtualKeyId): CrateVirtualKeyPreset | undefined {
  return PRESET_BY_ID.get(keyId)
}

export function getVirtualKeyPresetBySentinel(itemId: string): CrateVirtualKeyPreset | undefined {
  const normalized = itemId.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toUpperCase()
  return PRESET_BY_SENTINEL.get(normalized)
}

export function isVirtualKeyPrize(row: CratePrizeEntry): boolean {
  if (row.prizeKind === 'virtual_key' && row.keyId && isValidVirtualKeyId(row.keyId)) return true
  return getVirtualKeyPresetBySentinel(row.itemId) != null
}

export function resolveVirtualKeyId(row: CratePrizeEntry): CrateVirtualKeyId | undefined {
  if (row.keyId && isValidVirtualKeyId(row.keyId)) return row.keyId
  return getVirtualKeyPresetBySentinel(row.itemId)?.id
}

export function normalizeVirtualKeyPrizeEntry(row: CratePrizeEntry): CratePrizeEntry {
  const keyId = resolveVirtualKeyId(row)
  if (!keyId) {
    if (row.prizeKind === 'virtual_key') {
      return { ...row, prizeKind: 'item', keyId: undefined }
    }
    return row
  }
  const preset = getVirtualKeyPreset(keyId)!
  const override = row.override ? { ...row.override } : undefined
  if (override) delete override.enchantments
  return {
    entryId: row.entryId,
    prizeKind: 'virtual_key',
    keyId,
    itemId: preset.sentinelItemId,
    override,
  }
}

export function createVirtualKeyPrizeEntry(keyId: CrateVirtualKeyId): CratePrizeEntry {
  const preset = getVirtualKeyPreset(keyId)
  if (!preset) throw new Error(`Unknown virtual key: ${keyId}`)
  return {
    entryId: `key_${keyId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    prizeKind: 'virtual_key',
    keyId,
    itemId: preset.sentinelItemId,
  }
}

/** Integer keys granted per win; ranges use rounded average. */
export function virtualKeyGrantCount(amount: string | undefined): number {
  const s = (amount ?? '1').trim()
  if (!s) return 1
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 1
  }
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(s)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      return Math.max(1, Math.round((a + b) / 2))
    }
  }
  return 1
}

export function buildVirtualKeyCommand(preset: CrateVirtualKeyPreset, amount: string | undefined): string {
  const count = virtualKeyGrantCount(amount)
  return `cc give virtual ${preset.crazyCratesCrateName} ${count} %player%`
}

/** Editor-only value from global per-key settings (unit value × keys granted). */
export function getVirtualKeyPrizeValue(row: CratePrizeEntry, values: VirtualCrateKeyValues): number | undefined {
  const keyId = resolveVirtualKeyId(row)
  if (!keyId) return undefined
  const unit = values[keyId]
  if (typeof unit !== 'number' || !Number.isFinite(unit) || unit < 0) return undefined
  const amount = row.override?.amount?.trim() || '1'
  return unit * virtualKeyGrantCount(amount)
}
