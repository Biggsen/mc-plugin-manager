/**
 * Bundled CrazyCrates templates (copied to assets/templates by copy-templates.js).
 */
const path = require('path')
const { existsSync } = require('fs')

export const CRAZY_CRATES_MAIN_TEMPLATE = 'crazycrates-config.yml'

/** Crate body shell; library entries supply theme fields and Prizes at emit. */
export const CRAZY_CRATES_CRATE_BASE_TEMPLATE = 'crazycrates-crate-base-template.yml'

/** Legacy fallback crate output stems when a server has no library assignments. */
export const CRAZY_CRATES_BUNDLED_CRATE_STEMS = ['HeartCrate', 'RegionCrate', 'VillageCrate'] as const

export type CrazyCratesBundledCrateStem = (typeof CRAZY_CRATES_BUNDLED_CRATE_STEMS)[number]

function bundledTemplatesDir(): string {
  const electron = require('electron')
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  return isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'templates')
    : path.join(basePath, 'assets', 'templates')
}

export function getCrazyCratesBundledTemplatePath(filename: string): string {
  const filePath = path.join(bundledTemplatesDir(), filename)
  if (!existsSync(filePath)) {
    throw new Error(
      `Bundled CrazyCrates template not found at: ${filePath}. Run "npm run build:electron" to copy templates.`
    )
  }
  return filePath
}
