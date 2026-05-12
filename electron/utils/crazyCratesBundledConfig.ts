/**
 * Bundled CrazyCrates templates (copied to assets/templates by copy-templates.js).
 */
const path = require('path')
const { existsSync } = require('fs')

export const CRAZY_CRATES_MAIN_TEMPLATE = 'crazycrates-config.yml'

/** Source filenames under assets/templates; written to CrazyCrates/crates/<basename>.yml when propagating. */
export const CRAZY_CRATES_CRATE_TEMPLATES = [
  'crazycrates-crates-HeartCrate.yml',
  'crazycrates-crates-RegionCrate.yml',
  'crazycrates-crates-VillageCrate.yml',
] as const

const PREFIX = 'crazycrates-crates-'

export function crazyCratesPropagatedCrateFilename(templateBasename: string): string {
  if (!templateBasename.startsWith(PREFIX) || !templateBasename.endsWith('.yml')) {
    throw new Error(`Unexpected CrazyCrates crate template name: ${templateBasename}`)
  }
  return templateBasename.slice(PREFIX.length)
}

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
