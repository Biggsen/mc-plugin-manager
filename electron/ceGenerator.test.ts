import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  getStartRegionAachId,
  generateOwnedCEEvents,
  partitionOwnedCEEventsForFragments,
  buildCEConfigBundle,
} from './ceGenerator'

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

  it('does not emit structure discover_once without structureFamilies', () => {
    const regions: RegionRecord[] = [
      region('cherrybrook', 'region', 'overworld', 'first_join'),
      {
        world: 'overworld',
        id: 'inner_core',
        kind: 'structure',
        structureType: 'ancient_city',
        discover: { method: 'on_enter', recipeId: 'none' },
      },
    ]
    const events = generateOwnedCEEvents(regions, onboarding)
    expect(events['inner_core_discover_once']).toBeUndefined()
  })

  it('emits structure discover_once with waits and metrics for family counter only', () => {
    const families = {
      ancient_city: { label: 'Ancient Cities', counter: 'ancient_cities_found' },
    }
    const regions: RegionRecord[] = [
      region('cherrybrook', 'region', 'overworld', 'first_join'),
      {
        world: 'overworld',
        id: 'inner_core',
        kind: 'structure',
        structureType: 'ancient_city',
        discover: { method: 'on_enter', recipeId: 'none' },
      },
    ]
    const events = generateOwnedCEEvents(regions, onboarding, undefined, families)
    const ev = events['inner_core_discover_once']
    expect(ev).toBeDefined()
    expect(ev?.type).toBe('wgevents_region_enter')
    expect(ev?.one_time).toBe(true)
    expect(ev?.conditions).toEqual(['%region% == inner_core'])
    const actions = ev!.actions!.default as string[]
    expect(actions).toEqual([
      'wait: 3',
      'console_command: aach give discoverInnerCore %player%',
      'console_message: [EXPMETRIC] server={SERVER_NAME} type=discovery entity=structure player=%player% uuid=%player_uuid% region=Inner Core diff=0',
      'wait: 6',
      'console_command: aach add 1 Custom.ancient_cities_found %player%',
      'wait: 6',
      'console_command: aach add 1 Custom.structures_found %player%',
      'console_message: [EXPMETRIC] server={SERVER_NAME} type=state entity=structure player=%player% uuid=%player_uuid% ancient_cities_found=%aach_custom_ancient_cities_found% structures_found=%aach_custom_structures_found%',
    ])
    expect(actions.some((a) => a.includes('cc give virtual'))).toBe(false)
    expect(actions.some((a) => a.includes('total_discovered'))).toBe(false)
  })
})

describe('partitionOwnedCEEventsForFragments', () => {
  it('places first_join, join_log, leave_log in server-core; region heart tip in overworld-regions', () => {
    const regions: RegionRecord[] = [region('cherrybrook', 'region', 'overworld', 'first_join')]
    const owned = generateOwnedCEEvents(regions, onboarding)
    const parts = partitionOwnedCEEventsForFragments(owned, regions)
    expect(parts['server-core'].first_join).toBeDefined()
    expect(parts['server-core'].join_log).toBeDefined()
    expect(parts['server-core'].leave_log).toBeDefined()
    expect(parts['overworld-regions'].region_heart_discover_once).toBeDefined()
  })

  it('splits discover_once by kind and world', () => {
    const regions: RegionRecord[] = [
      region('cherrybrook', 'region', 'overworld', 'first_join'),
      region('v1', 'village', 'overworld', 'on_enter'),
      region('h1', 'heart', 'overworld', 'on_enter'),
      region('h2', 'heart', 'nether', 'on_enter'),
      region('r1', 'region', 'overworld', 'on_enter'),
      region('r2', 'region', 'nether', 'on_enter'),
    ]
    const owned = generateOwnedCEEvents(regions, onboarding)
    const parts = partitionOwnedCEEventsForFragments(owned, regions)
    expect(parts['overworld-villages'].v1_discover_once).toBeDefined()
    expect(parts['overworld-hearts'].h1_discover_once).toBeDefined()
    expect(parts['nether-hearts'].h2_discover_once).toBeDefined()
    expect(parts['overworld-regions'].r1_discover_once).toBeDefined()
    expect(parts['nether-regions'].r2_discover_once).toBeDefined()
  })
})

describe('buildCEConfigBundle', () => {
  it('keeps call event packs only in their CE fragments', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-bundle-'))
    const tpl = path.join(dir, 'tpl.yml')
    fs.writeFileSync(
      tpl,
      [
        'Config:',
        '  x: 1',
        'Messages:',
        '  p: hi',
        'Events:',
        '  get_book_mending:',
        '    type: call',
        '    actions:',
        '      default: []',
        '  get_potion_fire_resistance:',
        '    type: call',
        '    actions:',
        '      default: []',
        '  world_change:',
        '    type: player_world_change',
        '    actions:',
        '      default: []',
        '  store_reminder_on_join:',
        '    type: player_join',
        '    actions:',
        '      default: []',
        '  keep_me:',
        '    type: player_join',
        '    one_time: false',
        '    actions:',
        '      default: []',
        '',
      ].join('\n'),
      'utf-8'
    )
    const regions: RegionRecord[] = [region('cherrybrook', 'region', 'overworld', 'first_join')]
    const owned = generateOwnedCEEvents(regions, onboarding)
    const bundle = buildCEConfigBundle(tpl, owned, regions)
    expect(bundle.mainYaml).toContain('keep_me')
    expect(bundle.mainYaml).not.toContain('get_book_mending')
    expect(bundle.mainYaml).not.toContain('get_potion_fire_resistance')
    expect(bundle.mainYaml).not.toContain('world_change')
    expect(bundle.mainYaml).not.toContain('store_reminder_on_join')
    expect(bundle.eventFragmentYamls.enchantments).toContain('get_book_mending')
    expect(bundle.eventFragmentYamls.potions).toContain('get_potion_fire_resistance')
    expect(bundle.eventFragmentYamls['server-core']).toContain('world_change')
    expect(bundle.eventFragmentYamls['server-core']).toContain('store_reminder_on_join')
    expect(bundle.eventFragmentYamls['server-core']).toContain('first_join')
  })
})
