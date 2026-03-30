/**
 * Bundled GriefPreventionData template (copied to assets/templates by copy-templates.js).
 */
const path = require('path')
const { existsSync } = require('fs')

export const GRIEF_PREVENTION_BUNDLED_FILENAME = 'griefprevention-config.yml'

export function getGriefPreventionBundledConfigPath(): string {
  const electron = require('electron')
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  const filePath = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'templates', GRIEF_PREVENTION_BUNDLED_FILENAME)
    : path.join(basePath, 'assets', 'templates', GRIEF_PREVENTION_BUNDLED_FILENAME)
  if (!existsSync(filePath)) {
    throw new Error(
      `Bundled GriefPrevention template not found at: ${filePath}. Run "npm run build:electron" to copy templates.`
    )
  }
  return filePath
}
