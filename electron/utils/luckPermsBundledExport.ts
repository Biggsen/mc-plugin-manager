/**
 * Bundled LuckPerms binary export (copied verbatim to assets/templates by copy-templates.js).
 */
const path = require('path')
const { existsSync } = require('fs')

export const LUCKPERMS_BUNDLED_EXPORT_FILENAME = 'perms-exploration.json.gz'

export function getLuckPermsBundledExportPath(): string {
  const electron = require('electron')
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  const filePath = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'templates', LUCKPERMS_BUNDLED_EXPORT_FILENAME)
    : path.join(basePath, 'assets', 'templates', LUCKPERMS_BUNDLED_EXPORT_FILENAME)
  if (!existsSync(filePath)) {
    throw new Error(
      `Bundled LuckPerms export not found at: ${filePath}. Run "npm run build:electron" to copy templates.`
    )
  }
  return filePath
}
