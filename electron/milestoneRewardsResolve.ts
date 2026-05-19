import type { ResolvedMilestoneRewards, ServerProfile } from './types'
import { loadMilestoneRewardsLibrary } from './milestoneRewardsLibrary'
import { listServerIds, loadServerProfile, saveServerProfile } from './storage'

export function resolveMilestoneRewardsForServer(
  profile: ServerProfile
): ResolvedMilestoneRewards | null {
  const profileId = profile.milestoneRewards?.libraryProfileId
  if (!profileId || typeof profileId !== 'string') return null

  const library = loadMilestoneRewardsLibrary()
  const entry = library.find((p) => p.id === profileId)
  if (!entry) return null

  return {
    profileId: entry.id,
    categories: entry.categories ?? {},
  }
}

export function findServersReferencingMilestoneProfile(profileId: string): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  for (const id of listServerIds()) {
    const p = loadServerProfile(id)
    if (!p) continue
    if (p.milestoneRewards?.libraryProfileId === profileId) {
      out.push({ id: p.id, name: p.name })
    }
  }
  return out
}

export function removeMilestoneProfileIdFromAllServers(profileId: string): { id: string; name: string }[] {
  const touched: { id: string; name: string }[] = []
  for (const id of listServerIds()) {
    const p = loadServerProfile(id)
    if (!p) continue
    if (p.milestoneRewards?.libraryProfileId !== profileId) continue
    p.milestoneRewards = { libraryProfileId: null }
    saveServerProfile(p)
    touched.push({ id: p.id, name: p.name })
  }
  return touched
}
