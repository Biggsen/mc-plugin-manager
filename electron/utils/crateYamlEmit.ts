const yaml = require('yaml')

import { YAML_STRINGIFY_OPTIONS } from './yamlOptions'

export type CratePrizeSettings = {
  'Custom-Model-Data': number
  Model: { Namespace: string; Id: string }
}

/** Fresh object per prize so YAML emit does not use anchors (`&a1` / `*a1`). */
export function createCratePrizeSettings(): CratePrizeSettings {
  return { 'Custom-Model-Data': -1, Model: { Namespace: '', Id: '' } }
}

function applyInlineFlowToPrizeSettings(prizesNode: unknown): void {
  if (!prizesNode || typeof prizesNode !== 'object' || !('items' in prizesNode)) return
  const items = (prizesNode as { items: { value: { get: (k: string, d?: boolean) => unknown } }[] }).items
  for (const entry of items) {
    const prize = entry.value
    if (!prize || typeof prize.get !== 'function') continue
    const settings = prize.get('Settings', true) as { flow?: boolean; get?: (k: string, d?: boolean) => unknown } | null
    if (!settings || typeof settings !== 'object') continue
    settings.flow = true
    const model = settings.get?.('Model', true) as { flow?: boolean } | null
    if (model && typeof model === 'object') model.flow = true
  }
}

/** Stringify crate doc with inline `Settings: { ... }` on every prize (matches bundled crate YAML). */
export function stringifyCrateDocument(doc: Record<string, unknown>): string {
  const parsed = yaml.parseDocument(yaml.stringify(doc, YAML_STRINGIFY_OPTIONS))
  applyInlineFlowToPrizeSettings(parsed.getIn(['Crate', 'Prizes'], true))
  return String(parsed)
}
