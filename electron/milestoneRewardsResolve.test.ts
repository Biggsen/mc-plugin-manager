import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ServerProfile } from './types'

const loadMilestoneRewardsLibrary = vi.fn()
const listServerIds = vi.fn()
const loadServerProfile = vi.fn()
const saveServerProfile = vi.fn()

vi.mock('./milestoneRewardsLibrary', () => ({
  loadMilestoneRewardsLibrary: () => loadMilestoneRewardsLibrary(),
}))

vi.mock('./storage', () => ({
  listServerIds: () => listServerIds(),
  loadServerProfile: (id: string) => loadServerProfile(id),
  saveServerProfile: (p: ServerProfile) => saveServerProfile(p),
}))

import {
  resolveMilestoneRewardsForServer,
  removeMilestoneProfileIdFromAllServers,
} from './milestoneRewardsResolve'

describe('milestoneRewardsResolve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when server has no library profile', () => {
    const profile = { id: 's1', name: 'S' } as ServerProfile
    expect(resolveMilestoneRewardsForServer(profile)).toBeNull()
  })

  it('returns null when profile id is missing from library', () => {
    loadMilestoneRewardsLibrary.mockReturnValue([])
    const profile = {
      id: 's1',
      name: 'S',
      milestoneRewards: { libraryProfileId: 'missing' },
    } as ServerProfile
    expect(resolveMilestoneRewardsForServer(profile)).toBeNull()
  })

  it('returns categories when profile exists', () => {
    loadMilestoneRewardsLibrary.mockReturnValue([
      {
        id: 'p1',
        name: 'Preset',
        categories: { villages_discovered: { first: { experience: 10 } } },
        createdAt: '',
        updatedAt: '',
      },
    ])
    const profile = {
      id: 's1',
      name: 'S',
      milestoneRewards: { libraryProfileId: 'p1' },
    } as ServerProfile
    const resolved = resolveMilestoneRewardsForServer(profile)
    expect(resolved?.profileId).toBe('p1')
    expect(resolved?.categories.villages_discovered?.first?.experience).toBe(10)
  })

  it('clears profile id from all servers on delete cascade', () => {
    listServerIds.mockReturnValue(['s1', 's2'])
    const p1 = {
      id: 's1',
      name: 'One',
      milestoneRewards: { libraryProfileId: 'p1' },
    } as ServerProfile
    const p2 = {
      id: 's2',
      name: 'Two',
      milestoneRewards: { libraryProfileId: null },
    } as ServerProfile
    loadServerProfile.mockImplementation((id: string) => (id === 's1' ? p1 : p2))

    const touched = removeMilestoneProfileIdFromAllServers('p1')
    expect(touched).toEqual([{ id: 's1', name: 'One' }])
    expect(p1.milestoneRewards?.libraryProfileId).toBeNull()
    expect(saveServerProfile).toHaveBeenCalledWith(p1)
  })
})
