const { ipcMain } = require('electron')
const { randomUUID } = require('crypto')

import type {
  AAMilestoneCategoryKey,
  AAMilestoneCategorySlots,
  MilestoneRewardsLibraryDeleteResult,
  MilestoneRewardsLibraryEntry,
} from '../../types'
import {
  loadMilestoneRewardsLibrary,
  saveMilestoneRewardsLibrary,
  sanitizeMilestoneCategories,
} from '../../milestoneRewardsLibrary'
import { removeMilestoneProfileIdFromAllServers } from '../../milestoneRewardsResolve'
import { loadCeRewardCatalog } from '../../ceRewardCatalog'

function nameTaken(profiles: MilestoneRewardsLibraryEntry[], name: string, exceptId?: string): boolean {
  const n = name.trim().toLowerCase()
  return profiles.some((p) => p.id !== exceptId && p.name.trim().toLowerCase() === n)
}

export function registerMilestoneRewardsLibraryHandlers(): void {
  ipcMain.handle('list-milestone-rewards-library', async () => {
    return loadMilestoneRewardsLibrary()
  })

  ipcMain.handle('list-ce-reward-catalog', async () => {
    return loadCeRewardCatalog()
  })

  ipcMain.handle(
    'create-milestone-rewards-profile',
    async (_e: unknown, input: { name?: string } | undefined) => {
      const profiles = loadMilestoneRewardsLibrary()
      const iso = new Date().toISOString()
      let name = (input?.name ?? 'New milestone profile').trim()
      if (!name) name = 'New milestone profile'
      let n = 2
      const base = name
      while (nameTaken(profiles, name)) {
        name = `${base} ${n}`
        n += 1
      }
      const entry: MilestoneRewardsLibraryEntry = {
        id: randomUUID(),
        name,
        categories: {},
        createdAt: iso,
        updatedAt: iso,
      }
      profiles.push(entry)
      saveMilestoneRewardsLibrary(profiles)
      return entry
    }
  )

  ipcMain.handle(
    'update-milestone-rewards-profile',
    async (
      _e: unknown,
      input: {
        id: string
        name?: string
        categories?: Partial<Record<AAMilestoneCategoryKey, AAMilestoneCategorySlots>>
      }
    ) => {
      const profiles = loadMilestoneRewardsLibrary()
      const idx = profiles.findIndex((p) => p.id === input.id)
      if (idx < 0) throw new Error('Milestone rewards profile not found')

      const cur = profiles[idx]
      if (input.name !== undefined) {
        const name = input.name.trim()
        if (!name) throw new Error('Profile name cannot be empty')
        if (nameTaken(profiles, name, input.id)) {
          throw new Error(`A profile named "${name}" already exists`)
        }
        cur.name = name
      }
      if (input.categories !== undefined) {
        cur.categories = sanitizeMilestoneCategories(input.categories)
      }
      cur.updatedAt = new Date().toISOString()
      profiles[idx] = cur
      saveMilestoneRewardsLibrary(profiles)
      return loadMilestoneRewardsLibrary().find((p) => p.id === input.id)!
    }
  )

  ipcMain.handle('delete-milestone-rewards-profile', async (_e: unknown, id: string) => {
    const profiles = loadMilestoneRewardsLibrary()
    const idx = profiles.findIndex((p) => p.id === id)
    if (idx < 0) {
      return { ok: false, error: 'Profile not found' } satisfies MilestoneRewardsLibraryDeleteResult
    }
    profiles.splice(idx, 1)
    saveMilestoneRewardsLibrary(profiles)
    const removedFromServers = removeMilestoneProfileIdFromAllServers(id)
    return { ok: true, removedFromServers } satisfies MilestoneRewardsLibraryDeleteResult
  })
}
