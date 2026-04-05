/**
 * Relative paths (from plugins / output root) for every file Plugin Manager can emit
 * when "propagate to plugin folders" is enabled — used for folder-to-folder compare.
 */
const path = require('path')
const { readdirSync } = require('fs')
import type { PluginType } from '../types'
import { PLUGIN_TYPES } from '../types'
import { PLUGIN_OUTPUT_RELATIVE, getCEEventFragmentPropagatedRelativePath } from './configPathResolver'
import { getWorldGuardRegionsPropagatedRelativePath } from './worldGuardRegionsPaths'
import { CE_EVENT_FRAGMENT_BASENAMES } from '../ceGenerator'
import { getGuideBooksSourceDir } from './guideBooksDir'

export interface PmGeneratedEntry {
  id: string
  label: string
  relativePath: string
}

const PLUGIN_LABELS: Record<PluginType, string> = {
  aa: 'AdvancedAchievements',
  ce: 'ConditionalEvents',
  tab: 'TAB',
  lm: 'LevelledMobs',
  mc: 'MyCommand',
  cw: 'CommandWhitelist',
}

/**
 * Ordered list of PM-generated files to compare between two plugin trees.
 * BookGUI entries come from bundled guide book filenames; if the bundle is missing, they are omitted.
 */
export function getPmGeneratedEntries(): { entries: PmGeneratedEntry[]; bookGuiWarning?: string } {
  const entries: PmGeneratedEntry[] = []

  for (const id of PLUGIN_TYPES) {
    entries.push({
      id,
      label: PLUGIN_LABELS[id],
      relativePath: PLUGIN_OUTPUT_RELATIVE[id],
    })
    if (id === 'ce') {
      for (const basename of CE_EVENT_FRAGMENT_BASENAMES) {
        entries.push({
          id: `ce-events-${basename}`,
          label: `ConditionalEvents (events/${basename}.yml)`,
          relativePath: getCEEventFragmentPropagatedRelativePath(basename),
        })
      }
    }
  }

  entries.push(
    {
      id: 'discordsrv-config',
      label: 'DiscordSRV (config.yml)',
      relativePath: 'DiscordSRV/config.yml',
    },
    {
      id: 'discordsrv-messages',
      label: 'DiscordSRV (messages.yml)',
      relativePath: 'DiscordSRV/messages.yml',
    },
    {
      id: 'griefprevention',
      label: 'GriefPreventionData (config.yml)',
      relativePath: 'GriefPreventionData/config.yml',
    },
    {
      id: 'worldguardregions',
      label: 'WorldGuard (worlds/world/regions.yml)',
      relativePath: getWorldGuardRegionsPropagatedRelativePath('world'),
    },
    {
      id: 'worldguardregionsnether',
      label: 'WorldGuard nether (worlds/world_nether/regions.yml)',
      relativePath: getWorldGuardRegionsPropagatedRelativePath('world_nether'),
    }
  )

  let bookGuiWarning: string | undefined
  try {
    const guideDir = getGuideBooksSourceDir()
    const files = readdirSync(guideDir).filter((f: string) => f.endsWith('.yml'))
    for (const filename of files.sort()) {
      entries.push({
        id: `bookgui:${filename}`,
        label: `BookGUI (${filename})`,
        relativePath: path.join('BookGUI', 'books', filename),
      })
    }
  } catch {
    bookGuiWarning =
      'BookGUI guide books could not be listed (bundled templates missing). BookGUI files are skipped from this compare.'
  }

  return { entries, bookGuiWarning }
}
