const yaml = require('yaml')
const { readFileSync } = require('fs')

import { resolveConfigPath } from './utils/configPathResolver'
import {
  ceCallExecuteLine,
  ceRewardKindFromToken,
  labelFromCeCallToken,
  type CeRewardKind,
} from './shared/ceRewardTokens'

export interface CeRewardCatalogEntry {
  /** CE event key, e.g. get_book_mending */
  token: string
  kind: CeRewardKind
  label: string
  executeLine: string
}

function parseEventsFromCeConfig(configPath: string): Record<string, unknown> {
  const parsed = yaml.parse(readFileSync(configPath, 'utf-8')) as { Events?: Record<string, unknown> }
  return parsed?.Events && typeof parsed.Events === 'object' ? parsed.Events : {}
}

/**
 * Build enchantment / potion reward options from bundled CE `Events` keys
 * (get_book_* / get_potion_* call events — same keys emitted to enchantments.yml / potions.yml on build).
 */
export function loadCeRewardCatalog(ceConfigPath?: string): CeRewardCatalogEntry[] {
  const configPath = ceConfigPath ?? resolveConfigPath('ce')
  const events = parseEventsFromCeConfig(configPath)
  const out: CeRewardCatalogEntry[] = []

  for (const token of Object.keys(events).sort()) {
    const kind = ceRewardKindFromToken(token)
    if (!kind) continue
    const label = labelFromCeCallToken(token)
    if (!label) continue
    out.push({
      token,
      kind,
      label,
      executeLine: ceCallExecuteLine(token),
    })
  }

  return out
}
