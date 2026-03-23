import { describe, it, expect } from 'vitest'
import path from 'path'
import { generateMCConfig } from './mcGenerator'
import type { RegionRecord } from './types'

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'mc-template.yml')

function region(id: string, kind: 'region' | 'village' | 'heart', world: 'overworld' | 'nether' = 'overworld'): RegionRecord {
  return {
    world,
    id,
    kind,
    discover: { method: 'on_enter', recipeId: 'region' },
  }
}

describe('generateMCConfig', () => {
  it('replaces SERVER_NAME in output', () => {
    const out = generateMCConfig(FIXTURE_PATH, 'My Server', [], false)
    expect(out).toContain('My Server')
    expect(out).not.toContain('{SERVER_NAME}')
  })

  it('omits discord command block', () => {
    const out = generateMCConfig(FIXTURE_PATH, 'Srv', [], false)
    expect(out).not.toMatch(/discord:/)
  })

  it('when hasLore is false, omits lore and server_guide_lore and Lore line in server_guides', () => {
    const out = generateMCConfig(FIXTURE_PATH, 'Srv', [], false)
    expect(out).not.toMatch(/lore:/)
    expect(out).not.toMatch(/server_guide_lore:/)
    expect(out).not.toContain('&e> Lore; &d/guidelore;/guidelore')
    expect(out).toContain('Other line')
  })

  it('when hasLore is true, keeps lore and sets tab_completer from overworld regions', () => {
    const regions: RegionRecord[] = [
      region('z_region', 'region'),
      region('a_region', 'region'),
      region('nether_place', 'region', 'nether'),
      region('oak_village', 'village'),
    ]
    const out = generateMCConfig(FIXTURE_PATH, 'Srv', regions, true)
    expect(out).toMatch(/lore:/)
    expect(out).toContain('a_region')
    expect(out).toContain('z_region')
    expect(out).not.toContain('nether_place')
    expect(out).not.toContain('oak_village')
  })

  it('tab_completer is sorted alphabetically', () => {
    const regions: RegionRecord[] = [region('cherrybrook', 'region'), region('desert_ruins', 'region')]
    const out = generateMCConfig(FIXTURE_PATH, 'Srv', regions, true)
    const cherryIdx = out.indexOf('cherrybrook')
    const desertIdx = out.indexOf('desert_ruins')
    expect(cherryIdx).toBeLessThan(desertIdx)
  })
})
