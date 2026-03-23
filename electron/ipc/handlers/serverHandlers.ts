const { ipcMain } = require('electron')
const { randomUUID } = require('crypto')
const {
  loadServerProfile,
  saveServerProfile,
  deleteServer,
  listServerIds,
} = require('../../storage')
const { sanitizeServerName } = require('../../utils/stringFormatters')

import type { ServerProfile, OnboardingConfig, DiscordSrvSettings } from '../../types'

export function registerServerHandlers(): void {
  ipcMain.handle('list-servers', async (_event: unknown) => {
    const serverIds = listServerIds()
    const summaries = []

    for (const id of serverIds) {
      const profile = loadServerProfile(id)
      if (!profile) continue

      const regions: Array<{ world?: string; kind?: string }> = profile.regions || []
      const regionCount = regions.filter((r) => r.world === 'overworld' && r.kind === 'region').length
      const villageCount = regions.filter((r) => r.world === 'overworld' && r.kind === 'village').length
      const heartCount = regions.filter((r) => r.world === 'overworld' && r.kind === 'heart').length
      const netherRegionCount = regions.filter((r) => r.world === 'nether' && r.kind === 'region').length

      const dates = [
        profile.sources?.overworld?.importedAtIso,
        profile.sources?.nether?.importedAtIso,
        profile.sources?.end?.importedAtIso,
      ].filter(Boolean)
      const lastImportIso = dates.length > 0 ? (dates as string[]).sort().reverse()[0] : null

      summaries.push({
        id: profile.id,
        name: profile.name,
        regionCount,
        villageCount,
        heartCount,
        netherRegionCount,
        lastImportIso,
      })
    }

    return summaries
  })

  ipcMain.handle(
    'create-server',
    async (_event: unknown, name: string): Promise<ServerProfile> => {
      const id = sanitizeServerName(name)
      const serverId = `${id}-${randomUUID().substring(0, 8)}`

      const profile: ServerProfile = {
        id: serverId,
        name,
        sources: {},
        regions: [],
        onboarding: {
          startRegionId: '',
          teleport: {
            world: '',
            x: 0,
            z: 0,
          },
        },
        build: {},
      }

      saveServerProfile(profile)
      return profile
    }
  )

  ipcMain.handle(
    'get-server',
    async (_event: unknown, serverId: string): Promise<ServerProfile | null> => {
      return loadServerProfile(serverId)
    }
  )

  ipcMain.handle(
    'delete-server',
    async (_event: unknown, serverId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        deleteServer(serverId)
        return { success: true }
      } catch (error: unknown) {
        const err = error as Error
        return {
          success: false,
          error: err?.message ?? 'Failed to delete server',
        }
      }
    }
  )

  ipcMain.handle(
    'set-discordsrv-settings',
    async (_event: unknown, serverId: string, partial: DiscordSrvSettings): Promise<void> => {
      const profile = loadServerProfile(serverId)
      if (!profile) return
      profile.discordSrv = { ...(profile.discordSrv ?? {}), ...partial }
      saveServerProfile(profile)
    }
  )

  ipcMain.handle(
    'update-onboarding',
    async (
      _event: unknown,
      serverId: string,
      onboarding: OnboardingConfig
    ): Promise<ServerProfile | null> => {
      const profile = loadServerProfile(serverId)
      if (!profile) return null
      profile.onboarding = onboarding
      saveServerProfile(profile)
      return profile
    }
  )
}
