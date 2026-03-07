const { ipcMain } = require('electron')
const { existsSync, writeFileSync } = require('fs')
const path = require('path')
const { loadServerProfile, saveServerProfile } = require('../../storage')
const { generateLoreBooks } = require('../../loreBooksGenerator')

import type { ServerProfile, RegionRecord } from '../../types'

export function registerLoreBookHandlers(): void {
  ipcMain.handle(
    'update-region-lore-book',
    async (
      _event: unknown,
      serverId: string,
      regionId: string,
      updates: { anchors?: string[]; description?: string }
    ): Promise<ServerProfile | null> => {
      const profile = loadServerProfile(serverId)
      if (!profile) return null
      const region = profile.regions.find((r: RegionRecord) => r.id === regionId)
      if (!region) return null
      if (updates.anchors !== undefined) {
        region.loreBookAnchors = updates.anchors.length > 0 ? updates.anchors : undefined
      }
      if (updates.description !== undefined) {
        region.loreBookDescription = updates.description.trim() || undefined
      }
      saveServerProfile(profile)
      return profile
    }
  )

  ipcMain.handle(
    'export-lore-books',
    async (
      _event: unknown,
      serverId: string,
      inputs: { outDir: string; author?: string }
    ): Promise<{ success: boolean; count?: number; error?: string }> => {
      try {
        const profile = loadServerProfile(serverId)
        if (!profile) {
          return { success: false, error: `Server profile not found: ${serverId}` }
        }
        if (!inputs.outDir || inputs.outDir.trim().length === 0) {
          return { success: false, error: 'Output directory must be set' }
        }

        const fs = require('fs')
        if (!existsSync(inputs.outDir)) {
          fs.mkdirSync(inputs.outDir, { recursive: true })
        }

        const books = generateLoreBooks(profile.regions, inputs.author || 'Admin')
        for (const [regionId, yamlContent] of books) {
          const filename = `${regionId}.yml`
          const outputPath = path.join(inputs.outDir, filename)
          writeFileSync(outputPath, yamlContent, 'utf-8')
        }

        profile.build = profile.build || {}
        profile.build.loreBooksOutputDirectory = inputs.outDir
        saveServerProfile(profile)
        return { success: true, count: books.size }
      } catch (error: unknown) {
        const err = error as Error
        return {
          success: false,
          error: err.message || 'Lore books export failed',
        }
      }
    }
  )
}
