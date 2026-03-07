const { ipcMain } = require('electron')
const { existsSync } = require('fs')
const { loadServerProfile, saveServerProfile } = require('../../storage')
const { importRegions, importRegionsMeta } = require('../../regionParser')

import type { ImportResult, RegionRecord } from '../../types'

export function registerImportHandlers(): void {
  ipcMain.handle(
    'import-regions',
    async (
      _event: unknown,
      serverId: string,
      world: 'overworld' | 'nether',
      filePath: string
    ): Promise<ImportResult> => {
      try {
        const profile = loadServerProfile(serverId)
        if (!profile) {
          return { success: false, error: `Server profile not found: ${serverId}` }
        }
        if (!existsSync(filePath)) {
          return { success: false, error: `File not found: ${filePath}` }
        }

        const result = importRegions(
          filePath,
          world,
          profile.regions,
          profile.onboarding
        )

        profile.regions = result.regions
        if (world === 'overworld') {
          profile.sources.overworld = result.source
        } else {
          profile.sources.nether = result.source
        }
        saveServerProfile(profile)

        return {
          success: true,
          regionCount: result.regions.filter((r: RegionRecord) => r.world === world).length,
        }
      } catch (error: unknown) {
        const err = error as Error
        return {
          success: false,
          error: err.message || 'Unknown error during import',
        }
      }
    }
  )

  ipcMain.handle(
    'import-regions-meta',
    async (
      _event: unknown,
      serverId: string,
      world: 'overworld' | 'nether' | 'end',
      filePath: string
    ): Promise<ImportResult> => {
      try {
        const profile = loadServerProfile(serverId)
        if (!profile) {
          return { success: false, error: `Server profile not found: ${serverId}` }
        }
        if (!existsSync(filePath)) {
          return { success: false, error: `File not found: ${filePath}` }
        }

        const result = importRegionsMeta(filePath, world)

        const existingByKey = new Map<string, { loreBookAnchors?: string[] }>()
        for (const r of profile.regions) {
          if (r.world === result.world) {
            existingByKey.set(r.id, r)
          }
        }

        profile.regions = profile.regions.filter((r: RegionRecord) => r.world !== result.world)
        const mergedRegions = result.regions.map((r: RegionRecord) => {
          const existing = existingByKey.get(r.id)
          const merged = { ...r }
          if (existing?.loreBookAnchors) merged.loreBookAnchors = existing.loreBookAnchors
          merged.loreBookDescription = undefined
          return merged
        })
        profile.regions.push(...mergedRegions)

        if (result.world === 'overworld') {
          profile.sources.overworld = result.source
          profile.sources.world = result.source
        } else if (result.world === 'nether') {
          profile.sources.nether = result.source
        } else if (result.world === 'end') {
          profile.sources.end = result.source
        }

        if (result.spawnCenter && result.world === 'overworld') {
          profile.spawnCenter = result.spawnCenter
          result.source.spawnCenter = result.spawnCenter
        }

        if (result.onboarding && result.world === 'overworld') {
          profile.onboarding = {
            ...profile.onboarding,
            ...result.onboarding,
            teleport: { ...result.onboarding.teleport },
          }
        }

        if (result.levelledMobs) {
          if (!profile.regionsMeta) profile.regionsMeta = { levelledMobs: {} }
          if (!profile.regionsMeta.levelledMobs) profile.regionsMeta.levelledMobs = {}
          if (result.levelledMobs.villageBandStrategy !== undefined) {
            profile.regionsMeta.levelledMobs.villageBandStrategy = result.levelledMobs.villageBandStrategy
          }
          if (result.levelledMobs.regionBands) {
            profile.regionsMeta.levelledMobs.regionBands = {
              ...profile.regionsMeta.levelledMobs.regionBands,
              ...result.levelledMobs.regionBands,
            }
          }
        }

        saveServerProfile(profile)
        return { success: true, regionCount: result.regions.length }
      } catch (error: unknown) {
        const err = error as Error
        return {
          success: false,
          error: err.message || 'Unknown error during import',
        }
      }
    }
  )
}
