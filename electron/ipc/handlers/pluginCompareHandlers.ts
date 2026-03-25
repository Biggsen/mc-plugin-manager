const { ipcMain } = require('electron')
const { randomUUID } = require('crypto')
const { loadComparePresets, saveComparePresets } = require('../../storage')
import type {
  PluginFolderCompareResponse,
  ComparePreset,
  ComparePresetMutationResult,
  ComparePresetDeleteResult,
} from '../../types'
import { getPmGeneratedEntries } from '../../utils/pmGeneratedPaths'
import { comparePmPluginFolders, validatePluginsRoot } from '../../utils/comparePmPluginFolders'

function sortPresetsByUpdated(presets: ComparePreset[]): ComparePreset[] {
  return [...presets].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
}

function validatePresetInput(
  name: string,
  leftPath: string,
  rightPath: string
): { ok: true } | { ok: false; error: string } {
  const n = name.trim()
  const l = leftPath.trim()
  const r = rightPath.trim()
  if (!n) return { ok: false, error: 'Name is required' }
  if (!l) return { ok: false, error: 'Left folder path is required' }
  if (!r) return { ok: false, error: 'Right folder path is required' }
  return { ok: true }
}

export function registerPluginCompareHandlers(): void {
  ipcMain.handle(
    'compare-plugin-folders',
    async (_event: unknown, leftRoot: string, rightRoot: string): Promise<PluginFolderCompareResponse> => {
      const left = validatePluginsRoot(String(leftRoot ?? ''))
      if (!left.ok) return { ok: false, error: `Left folder: ${left.error}` }
      const right = validatePluginsRoot(String(rightRoot ?? ''))
      if (!right.ok) return { ok: false, error: `Right folder: ${right.error}` }

      const { entries, bookGuiWarning } = getPmGeneratedEntries()
      const result = comparePmPluginFolders(left.resolved, right.resolved, entries, bookGuiWarning)
      return { ok: true, result }
    }
  )

  ipcMain.handle('list-compare-presets', async (): Promise<ComparePreset[]> => {
    return sortPresetsByUpdated(loadComparePresets())
  })

  ipcMain.handle(
    'save-compare-preset',
    async (
      _event: unknown,
      input: { name: string; leftPath: string; rightPath: string }
    ): Promise<ComparePresetMutationResult> => {
      const v = validatePresetInput(input.name, input.leftPath, input.rightPath)
      if (!v.ok) return { ok: false, error: v.error }
      const name = input.name.trim()
      const leftPath = input.leftPath.trim()
      const rightPath = input.rightPath.trim()
      const preset: ComparePreset = {
        id: randomUUID(),
        name,
        leftPath,
        rightPath,
        updatedAt: new Date().toISOString(),
      }
      const presets: ComparePreset[] = loadComparePresets()
      presets.push(preset)
      saveComparePresets(sortPresetsByUpdated(presets))
      return { ok: true, preset }
    }
  )

  ipcMain.handle(
    'update-compare-preset',
    async (
      _event: unknown,
      input: { id: string; name: string; leftPath: string; rightPath: string }
    ): Promise<ComparePresetMutationResult> => {
      const id = String(input.id ?? '').trim()
      if (!id) return { ok: false, error: 'Preset id is required' }
      const v = validatePresetInput(input.name, input.leftPath, input.rightPath)
      if (!v.ok) return { ok: false, error: v.error }
      const name = input.name.trim()
      const leftPath = input.leftPath.trim()
      const rightPath = input.rightPath.trim()
      const presets: ComparePreset[] = loadComparePresets()
      const idx = presets.findIndex((p) => p.id === id)
      if (idx === -1) return { ok: false, error: 'Preset not found' }
      const updated: ComparePreset = {
        ...presets[idx],
        name,
        leftPath,
        rightPath,
        updatedAt: new Date().toISOString(),
      }
      presets[idx] = updated
      saveComparePresets(sortPresetsByUpdated(presets))
      return { ok: true, preset: updated }
    }
  )

  ipcMain.handle('delete-compare-preset', async (_event: unknown, id: string): Promise<ComparePresetDeleteResult> => {
    const presetId = String(id ?? '').trim()
    if (!presetId) return { ok: false, error: 'Preset id is required' }
    const before: ComparePreset[] = loadComparePresets()
    const presets = before.filter((p) => p.id !== presetId)
    if (presets.length === before.length) {
      return { ok: false, error: 'Preset not found' }
    }
    saveComparePresets(presets)
    return { ok: true }
  })
}
