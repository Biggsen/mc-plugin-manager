const fs = require('fs')
const yaml = require('yaml')

import type { CrateLibraryEntry, CratePrizeEntry, CrazyCratesBundledCrateStem, ItemIndexEntry } from './types'
import {
  CRAZY_CRATES_BUNDLED_CRATE_STEMS,
  CRAZY_CRATES_CRATE_BASE_TEMPLATE,
  getCrazyCratesBundledTemplatePath,
} from './utils/crazyCratesBundledConfig'
import { loadBundledItemIndex } from './itemIndex'
import { buildCratePrizesYamlMap } from './cratePrizeGenerator'
import { stringifyCrateDocument } from './utils/crateYamlEmit'

const DISPLAY_NAME_BY_STEM: Record<CrazyCratesBundledCrateStem, string> = {
  HeartCrate: 'Heart Crate',
  RegionCrate: 'Region Crate',
  VillageCrate: 'Village Crate',
}

const DEFAULT_THEME: Record<
  CrazyCratesBundledCrateStem,
  {
    crateSlot: number
    guiItem: string
    accentTag: string
    loreLine1: string
    loreLine2: string
    animationTitle: string
  }
> = {
  HeartCrate: {
    crateSlot: 15,
    guiItem: 'lodestone',
    accentTag: 'red',
    loreLine1: '<gray>Drawn from the heart of the land.',
    loreLine2: '<gray>Its origin holds greater value.',
    animationTitle: 'Uncovering relics...',
  },
  RegionCrate: {
    crateSlot: 13,
    guiItem: 'compass',
    accentTag: 'dark_purple',
    loreLine1: '<gray>A cache of discovered relics.',
    loreLine2: '<gray>Earned through exploration.',
    animationTitle: 'Revealing contents...',
  },
  VillageCrate: {
    crateSlot: 11,
    guiItem: 'bell',
    accentTag: 'yellow',
    loreLine1: '<gray>Collected from village life.',
    loreLine2: '<gray>Tools, goods, and everyday finds.',
    animationTitle: 'Gathering goods...',
  },
}

const NEUTRAL_THEME = {
  crateSlot: 13,
  guiItem: 'chest',
  accentTag: 'gray',
  loreLine1: '<gray>A reward crate.',
  loreLine2: '<gray>Open to see what you find.',
  animationTitle: 'Opening...',
}

function themeForLibraryEntry(entry: CrateLibraryEntry): {
  crateName: string
  crateSlot: number
  guiItem: string
  accentTag: string
  loreLine1: string
  loreLine2: string
  animationTitle: string
} {
  const name = entry.name.trim() || entry.outputStem
  return {
    crateName: name,
    crateSlot:
      typeof entry.crateSlot === 'number' && Number.isFinite(entry.crateSlot) ? entry.crateSlot : NEUTRAL_THEME.crateSlot,
    guiItem:
      typeof entry.guiItem === 'string' && entry.guiItem.trim().length > 0 ? entry.guiItem.trim() : NEUTRAL_THEME.guiItem,
    accentTag:
      typeof entry.accentTag === 'string' && entry.accentTag.trim().length > 0
        ? entry.accentTag.trim()
        : NEUTRAL_THEME.accentTag,
    loreLine1:
      typeof entry.loreLine1 === 'string' && entry.loreLine1.trim().length > 0
        ? entry.loreLine1.trim()
        : NEUTRAL_THEME.loreLine1,
    loreLine2:
      typeof entry.loreLine2 === 'string' && entry.loreLine2.trim().length > 0
        ? entry.loreLine2.trim()
        : NEUTRAL_THEME.loreLine2,
    animationTitle:
      typeof entry.animationTitle === 'string' && entry.animationTitle.trim().length > 0
        ? entry.animationTitle.trim()
        : NEUTRAL_THEME.animationTitle,
  }
}

function themeForLegacyStem(stem: CrazyCratesBundledCrateStem) {
  const d = DEFAULT_THEME[stem]
  return {
    crateName: DISPLAY_NAME_BY_STEM[stem],
    crateSlot: d.crateSlot,
    guiItem: d.guiItem,
    accentTag: d.accentTag,
    loreLine1: d.loreLine1,
    loreLine2: d.loreLine2,
    animationTitle: d.animationTitle,
  }
}

function applyThemeToCrate(crate: Record<string, unknown>, t: ReturnType<typeof themeForLibraryEntry>): void {
  crate.Slot = t.crateSlot
  crate.Item = t.guiItem
  crate.BroadCast = `%prefix%<bold><gold>%player%</bold><reset> <gray>is opening a <bold><${t.accentTag}>${t.crateName}.</bold>`
  crate.Name = `<bold><${t.accentTag}>${t.crateName}</bold>`
  crate.Lore = [
    t.loreLine1,
    t.loreLine2,
    '',
    '<gray>Available keys: <yellow>%keys%',
    '<gray>(<yellow>!<gray>) Right click to inspect.',
  ]
  const preview = crate.Preview as Record<string, unknown> | undefined
  if (preview && typeof preview === 'object') {
    preview.Name = `<${t.accentTag}>${t.crateName} Preview`
  }
  crate.Animation = { ...((crate.Animation as Record<string, unknown>) || {}), Name: t.animationTitle }
  const physicalKey = crate.PhysicalKey as Record<string, unknown> | undefined
  if (physicalKey && typeof physicalKey === 'object') {
    physicalKey.Name = `<bold><${t.accentTag}>${t.crateName}</bold>`
  }
}

/**
 * Build final CrazyCrates crate YAML: base shell template + library prize rows (no bundled crate files).
 */
export function buildCrateYamlFromTemplate(params: {
  libraryEntry: CrateLibraryEntry | null
  /** When profile has no library assignments, emit legacy trio shell with empty prizes. */
  legacyStem?: CrazyCratesBundledCrateStem
}): { yaml: string; warnings: string[] } {
  const warnings: string[] = []
  const basePath = getCrazyCratesBundledTemplatePath(CRAZY_CRATES_CRATE_BASE_TEMPLATE)
  const baseRaw = fs.readFileSync(basePath, 'utf-8')
  const doc = yaml.parse(baseRaw) as Record<string, unknown>
  const crate = doc.Crate as Record<string, unknown> | undefined
  if (!crate || typeof crate !== 'object') {
    throw new Error('Crate base template: missing top-level Crate: map')
  }

  const entry = params.libraryEntry
  if (entry) {
    applyThemeToCrate(crate, themeForLibraryEntry(entry))
    const { items } = loadBundledItemIndex()
    const itemsById = new Map<string, ItemIndexEntry>(items.map((i) => [i.id, i]))
    const prizeEntries: CratePrizeEntry[] = entry.selectedPrizeEntries ?? []
    if (prizeEntries.length === 0) {
      warnings.push(`CrazyCrates crate "${entry.name}" has no prize items — emitted empty Prizes`)
    }
    crate.Prizes = buildCratePrizesYamlMap(prizeEntries, itemsById)
  } else if (params.legacyStem && CRAZY_CRATES_BUNDLED_CRATE_STEMS.includes(params.legacyStem)) {
    applyThemeToCrate(crate, themeForLegacyStem(params.legacyStem))
    crate.Prizes = {}
    warnings.push(
      `CrazyCrates legacy crate "${DISPLAY_NAME_BY_STEM[params.legacyStem]}" has no library entry — empty Prizes (assign crates in the library to add items)`
    )
  } else {
    throw new Error('buildCrateYamlFromTemplate requires libraryEntry or legacyStem')
  }

  return { yaml: stringifyCrateDocument(doc), warnings }
}
