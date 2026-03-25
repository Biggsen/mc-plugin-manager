/**
 * Bundled BookGUI guide book templates directory (same resolution as build).
 */
const path = require('path')
const { existsSync } = require('fs')

export function getGuideBooksSourceDir(): string {
  const electron = require('electron')
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  const guideBooksDir = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'templates', 'guide-books')
    : path.join(basePath, 'assets', 'templates', 'guide-books')
  if (!existsSync(guideBooksDir)) {
    throw new Error(
      `Bundled BookGUI guide books not found at: ${guideBooksDir}. Run "npm run build:electron" to copy templates.`
    )
  }
  return guideBooksDir
}
