const { existsSync, readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

import type { CrateVirtualKeyId } from './types'
import { getDataDirectory } from './storage'
import { CRATE_VIRTUAL_KEY_PRESETS } from './shared/crateKeyPresets'

export type VirtualCrateKeyValues = Partial<Record<CrateVirtualKeyId, number>>

const FILE_NAME = 'virtual-crate-key-values.json'

function getFilePath(): string {
  return join(getDataDirectory(), FILE_NAME)
}

function sanitizeValues(raw: unknown): VirtualCrateKeyValues {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: VirtualCrateKeyValues = {}
  const allowed = new Set(CRATE_VIRTUAL_KEY_PRESETS.map((p) => p.id))
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(key as CrateVirtualKeyId)) continue
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) continue
    out[key as CrateVirtualKeyId] = val
  }
  return out
}

export function loadVirtualCrateKeyValues(): VirtualCrateKeyValues {
  const path = getFilePath()
  if (!existsSync(path)) return {}
  try {
    return sanitizeValues(JSON.parse(readFileSync(path, 'utf-8')))
  } catch {
    return {}
  }
}

export function saveVirtualCrateKeyValues(values: VirtualCrateKeyValues): VirtualCrateKeyValues {
  const cleaned = sanitizeValues(values)
  writeFileSync(getFilePath(), JSON.stringify(cleaned, null, 2), 'utf-8')
  return cleaned
}
