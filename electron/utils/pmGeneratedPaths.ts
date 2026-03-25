/**
 * Relative paths (from plugins / output root) for every file Plugin Manager can emit
 * when "propagate to plugin folders" is enabled — used for folder-to-folder compare.
 */
const path = require('path')
const { readdirSync } = require('fs')
import type { PluginType } from '../types'
import { PLUGIN_TYPES } from '../types'
import { PLUGIN_OUTPUT_RELATIVE } from './configPathResolver'
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
