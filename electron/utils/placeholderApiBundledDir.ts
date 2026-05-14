/**
 * Bundled PlaceholderAPI plugin-shaped tree under assets/templates/PlaceholderAPI (see copy-templates.js).
 */
const path = require('path')
const { existsSync, readdirSync } = require('fs')

export function getPlaceholderApiBundledRoot(): string {
  const electron = require('electron')
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  const dir = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'templates', 'PlaceholderAPI')
    : path.join(basePath, 'assets', 'templates', 'PlaceholderAPI')
  if (!existsSync(dir)) {
    throw new Error(
      `Bundled PlaceholderAPI templates not found at: ${dir}. Run "npm run build:electron" to copy templates.`
    )
  }
  return dir
}

/** Sorted relative paths from the bundled root (for builds and folder-compare entries). */
export function listPlaceholderApiBundledRelativePaths(): string[] {
  const root = getPlaceholderApiBundledRoot()
  const out: string[] = []
  function walk(dir: string): void {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        walk(full)
      } else {
        out.push(path.relative(root, full))
      }
    }
  }
  walk(root)
  return out.sort((a, b) => a.localeCompare(b))
}
