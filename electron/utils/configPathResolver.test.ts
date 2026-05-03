import { describe, it, expect } from 'vitest'
import path from 'path'
import {
  getPluginOutputPaths,
  CONFIG_FILENAMES,
  PLUGIN_OUTPUT_RELATIVE,
} from './configPathResolver'

describe('CONFIG_FILENAMES', () => {
  it('has entry for each plugin type', () => {
    expect(CONFIG_FILENAMES.aa).toBe('advancedachievements-config.yml')
    expect(CONFIG_FILENAMES.ce).toBe('conditionalevents-config.yml')
    expect(CONFIG_FILENAMES.tab).toBe('tab-config.yml')
    expect(CONFIG_FILENAMES.lm).toBe('levelledmobs-rules.yml')
    expect(CONFIG_FILENAMES.lmcd).toBe('levelledmobs-customdrops.yml')
    expect(CONFIG_FILENAMES.mc).toBe('mycommand-commands.yml')
    expect(CONFIG_FILENAMES.cw).toBe('commandwhitelist-config.yml')
  })
})

describe('PLUGIN_OUTPUT_RELATIVE', () => {
  it('has plugin folder path for each type', () => {
    expect(PLUGIN_OUTPUT_RELATIVE.aa).toBe('AdvancedAchievements/config.yml')
    expect(PLUGIN_OUTPUT_RELATIVE.mc).toBe('MyCommand/commands/commands.yml')
  })
})

describe('getPluginOutputPaths', () => {
  it('when not propagating: outputPath and buildPath use flat filename in given dirs', () => {
    const outDir = '/build'
    const buildDir = '/build/dir'
    const serverNameSanitized = 'my-server'
    const { outputPath, buildPath } = getPluginOutputPaths(
      'aa',
      outDir,
      buildDir,
      serverNameSanitized,
      false
    )
    expect(outputPath).toBe(path.join(outDir, 'my-server-advancedachievements-config.yml'))
    expect(buildPath).toBe(path.join(buildDir, 'my-server-advancedachievements-config.yml'))
  })

  it('when propagating: outputPath uses PLUGIN_OUTPUT_RELATIVE under outDir', () => {
    const outDir = '/plugins'
    const buildDir = '/build'
    const { outputPath, buildPath } = getPluginOutputPaths(
      'tab',
      outDir,
      buildDir,
      'server',
      true
    )
    expect(outputPath).toBe(path.join(outDir, 'TAB/config.yml'))
    expect(buildPath).toBe(path.join(buildDir, 'server-tab-config.yml'))
  })
})
