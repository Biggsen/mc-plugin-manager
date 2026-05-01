/**
 * Resolve plugin config file path: user-provided or bundled default.
 */
const electron = require('electron')
const path = require('path')
const { existsSync } = require('fs')

import type { PluginType } from '../types'

const CONFIG_FILENAMES: Record<PluginType, string> = {
  aa: 'advancedachievements-config.yml',
  ce: 'conditionalevents-config.yml',
  tab: 'tab-config.yml',
  lm: 'levelledmobs-rules.yml',
  lmcd: 'levelledmobs-customdrops.yml',
  mc: 'mycommand-commands.yml',
  cw: 'commandwhitelist-config.yml',
}

/** When "propagate to plugin folders" is on: relative path from plugins root (folder + filename). */
export const PLUGIN_OUTPUT_RELATIVE: Record<PluginType, string> = {
  aa: 'AdvancedAchievements/config.yml',
  ce: 'ConditionalEvents/config.yml',
  tab: 'TAB/config.yml',
  lm: 'LevelledMobs/rules.yml',
  lmcd: 'LevelledMobs/customdrops.yml',
  mc: 'MyCommand/commands/commands.yml',
  cw: 'CommandWhitelist/config.yml',
}

export function getPluginOutputPaths(
  pluginId: PluginType,
  outDir: string,
  buildDir: string,
  serverNameSanitized: string,
  propagateToPluginFolders: boolean
): { outputPath: string; buildPath: string } {
  const flatName = `${serverNameSanitized}-${CONFIG_FILENAMES[pluginId]}`
  const buildPath = path.join(buildDir, flatName)
  const outputPath = propagateToPluginFolders
    ? path.join(outDir, PLUGIN_OUTPUT_RELATIVE[pluginId])
    : path.join(outDir, flatName)
  return { outputPath, buildPath }
}

/** Relative path from plugins root: `ConditionalEvents/events/<basename>.yml`. */
export function getCEEventFragmentPropagatedRelativePath(basename: string): string {
  return path.join('ConditionalEvents', 'events', `${basename}.yml`)
}

/** Flat build/output filename for one CE event fragment when not propagating. */
export function getCEEventFragmentFlatName(serverNameSanitized: string, basename: string): string {
  return `${serverNameSanitized}-ce-events-${basename}.yml`
}

/**
 * Resolve config path for a plugin: use user-provided path if set, otherwise bundled default.
 */
export function resolveConfigPath(type: PluginType, userProvidedPath?: string): string {
  if (userProvidedPath && userProvidedPath.trim().length > 0) {
    if (!existsSync(userProvidedPath)) {
      throw new Error(`${type.toUpperCase()} config file not found: ${userProvidedPath}`)
    }
    return userProvidedPath
  }

  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  const filename = CONFIG_FILENAMES[type]
  const defaultPath = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'templates', filename)
    : path.join(basePath, 'assets', 'templates', filename)

  if (!existsSync(defaultPath)) {
    throw new Error(
      `Bundled ${type.toUpperCase()} default config not found at: ${defaultPath}. This may indicate a packaging issue. Please ensure templates were copied during build.`
    )
  }

  return defaultPath
}

export { CONFIG_FILENAMES }
