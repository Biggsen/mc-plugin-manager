import { describe, it, expect } from 'vitest'
import { getStartRegionAachId, generateOwnedCEEvents } from './ceGenerator'

import type { RegionRecord, OnboardingConfig } from './types'

function region(
  id: string,
  kind: 'system' | 'region' | 'village' | 'heart',
  world: 'overworld' | 'nether' = 'overworld',
  method: 'disabled' | 'on_enter' | 'first_join' = 'on_enter',
  overrides: Partial<RegionRecord> = {}
): RegionRecord {
  const recipeId =
    kind === 'village' ? 'region' : kind === 'heart' ? (world === 'nether' ? 'nether_heart' : 'heart') : world === 'nether' ? 'nether_region' : 'region'
  return {
    world,
    id,
    kind,
    discover: { method, recipeId: recipeId as RegionRecord['discover']['recipeId'] },
    ...overrides,
  }
}

const onboarding: OnboardingConfig = {
  startRegionId: 'cherrybrook',
  teleport: { world: 'world', x: 100, y: 64, z: 200 },
}

describe('getStartRegionAachId', () => {
  it('returns command ID for start region when found in overworld', () => {
    const regions: RegionRecord[] = [
      region('cherrybrook', 'region', 'overworld', 'first_join'),
      region('oak_village', 'village'),
    ]
    expect(getStartRegionAachId(onboarding, regions)).toBe('discoverCherrybrook')
  })

  it('falls back to start region in any world if not in overworld', () => {
    const regions: RegionRecord[] = [region('cherrybrook', 'region', 'nether', 'on_enter')]
    expect(getStartRegionAachId(onboarding, regions)).toBe('discoverCherrybrook')
  })

  it('uses generateCommandId for startRegionId when region not in list', () => {
    const regions: RegionRecord[] = [region('other_place', 'region')]
    expect(getStartRegionAachId(onboarding, regions)).toBe('discoverCherrybrook')
  })

  it('uses commandIdOverride when start region has it', () => {
    const regions: RegionRecord[] = [
      region('cherrybrook', 'region', 'overworld', 'first_join', {
        discover: {
          method: 'first_join',
          recipeId: 'region',
          commandIdOverride: 'customStartAach',
        },
      }),
    ]
    expect(getStartRegionAachId(onboarding, regions)).toBe('customStartAach')
  })
})

describe('generateOwnedCEEvents', () => {
  it('includes first_join, join_log, leave_log, region_heart_discover_once', () => {
    const regions: RegionRecord[] = [region('cherrybrook', 'region', 'overworld', 'first_join')]
    const events = generateOwnedCEEvents(regions, onboarding)
    expect(events.first_join).toBeDefined()
    expect(events.first_join?.type).toBe('player_join')
    expect(events.first_join?.one_time).toBe(true)
    expect(events.join_log).toBeDefined()
    expect(events.join_log?.type).toBe('player_join')
    expect(events.leave_log).toBeDefined()
    expect(events.leave_log?.type).toBe('player_leave')
    expect(events.region_heart_discover_once).toBeDefined()
    expect(events.region_heart_discover_once?.type).toBe('wgevents_region_enter')
  })

  it('adds discover_once event per on_enter region excluding start region', () => {
    const regions: RegionRecord[] = [
      region('cherrybrook', 'region', 'overworld', 'first_join'),
      region('desert_ruins', 'region', 'overworld', 'on_enter'),
      region('oak_village', 'village', 'overworld', 'on_enter'),
    ]
    const events = generateOwnedCEEvents(regions, onboarding)
    expect(events['desert_ruins_discover_once']).toBeDefined()
    expect(events['oak_village_discover_once']).toBeDefined()
    expect(events['cherrybrook_discover_once']).toBeUndefined()
  })

  it('discover_once event has correct structure for region', () => {
    const regions: RegionRecord[] = [region('test_region', 'region', 'overworld', 'on_enter')]
    const events = generateOwnedCEEvents(regions, onboarding)
    const ev = events['test_region_discover_once']
    expect(ev).toBeDefined()
    expect(ev?.type).toBe('wgevents_region_enter')
    expect(ev?.one_time).toBe(true)
    expect(ev?.conditions).toEqual(['%region% == test_region'])
    expect(Array.isArray(ev?.actions?.default)).toBe(true)
  })

  it('discover_once event for village includes village-specific actions', () => {
    const regions: RegionRecord[] = [region('oak_village', 'village', 'overworld', 'on_enter')]
    const events = generateOwnedCEEvents(regions, onboarding)
    const ev = events['oak_village_discover_once']
    expect(ev).toBeDefined()
    const actions = ev!.actions!.default as string[]
    expect(actions.some((a) => a.includes('villages_discovered'))).toBe(true)
    expect(actions.some((a) => a.includes('VillageCrate'))).toBe(true)
  })

  it('first_join actions include teleport and start region discovery', () => {
    const regions: RegionRecord[] = [region('cherrybrook', 'region', 'overworld', 'first_join')]
    const events = generateOwnedCEEvents(regions, onboarding)
    const actions = events.first_join!.actions!.default as string[]
    expect(actions.some((a) => a.startsWith('console_command: tp %player% 100'))).toBe(true)
    expect(actions.some((a) => a.includes('Welcome to {SERVER_NAME}'))).toBe(true)
    expect(actions.some((a) => a.includes('aach give'))).toBe(true)
  })
})
