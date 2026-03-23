import { mkdtempSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, it, expect } from 'vitest'
import { classifyRegion, importRegionsMeta } from './regionParser'

describe('classifyRegion', () => {
  const noOnboarding = { startRegionId: '', teleport: { world: 'world', x: 0, z: 0 } }

  it('spawn -> system, disabled, none', () => {
    const result = classifyRegion('spawn', {}, 'overworld', noOnboarding)
    expect(result.kind).toBe('system')
    expect(result.discover.method).toBe('disabled')
    expect(result.discover.recipeId).toBe('none')
  })

  it('heart_of_monkvos -> heart, on_enter, heart', () => {
    const result = classifyRegion('heart_of_monkvos', {}, 'overworld', noOnboarding)
    expect(result.kind).toBe('heart')
    expect(result.discover.method).toBe('on_enter')
    expect(result.discover.recipeId).toBe('heart')
  })

  it('heart_of_nether_x -> heart, on_enter, nether_heart', () => {
    const result = classifyRegion('heart_of_nether_x', {}, 'nether', noOnboarding)
    expect(result.kind).toBe('heart')
    expect(result.discover.method).toBe('on_enter')
    expect(result.discover.recipeId).toBe('nether_heart')
  })

  it('first-join region cherrybrook -> region, first_join, region', () => {
    const onboarding = {
      startRegionId: 'cherrybrook',
      teleport: { world: 'world', x: 0, z: 0 },
    }
    const result = classifyRegion('cherrybrook', {}, 'overworld', onboarding)
    expect(result.kind).toBe('region')
    expect(result.discover.method).toBe('first_join')
    expect(result.discover.recipeId).toBe('region')
  })

  it('village (greeting contains village) -> village, on_enter, region', () => {
    const result = classifyRegion(
      'oak_village',
      { flags: { greeting: 'Welcome to the Village!' } },
      'overworld',
      noOnboarding
    )
    expect(result.kind).toBe('village')
    expect(result.discover.method).toBe('on_enter')
    expect(result.discover.recipeId).toBe('region')
  })

  it('regular region (empty greeting) -> region, on_enter, region', () => {
    const result = classifyRegion(
      'desert_ruins',
      { flags: { greeting: '' } },
      'overworld',
      noOnboarding
    )
    expect(result.kind).toBe('region')
    expect(result.discover.method).toBe('on_enter')
    expect(result.discover.recipeId).toBe('region')
  })

  it('nether region -> region, on_enter, nether_region', () => {
    const result = classifyRegion('nether_fortress', {}, 'nether', noOnboarding)
    expect(result.kind).toBe('region')
    expect(result.discover.method).toBe('on_enter')
    expect(result.discover.recipeId).toBe('nether_region')
  })
})

describe('importRegionsMeta', () => {
  it('derives recipeId when discover.recipeId is omitted', () => {
    const dir = mkdtempSync(join(tmpdir(), 'regions-meta-'))
    const filePath = join(dir, 'm.yml')
    writeFileSync(
      filePath,
      `format: 1
world: overworld
regions:
  - id: spawn
    world: overworld
    kind: system
    discover:
      method: disabled
  - id: rotherhithe
    world: overworld
    kind: village
    discover:
      method: on_enter
`,
      'utf-8'
    )
    try {
      const result = importRegionsMeta(filePath, 'overworld')
      const spawn = result.regions.find((r) => r.id === 'spawn')
      const village = result.regions.find((r) => r.id === 'rotherhithe')
      expect(spawn?.discover.recipeId).toBe('none')
      expect(village?.discover.recipeId).toBe('village')
    } finally {
      unlinkSync(filePath)
    }
  })
})
