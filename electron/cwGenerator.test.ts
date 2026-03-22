import { describe, it, expect } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { generateCWConfig } from './cwGenerator'

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'cw-template.yml')

describe('generateCWConfig', () => {
  it('omits discord when discordInvite is empty', () => {
    const out = generateCWConfig(FIXTURE_PATH, '', true)
    expect(out).not.toMatch(/\n    - discord\n/)
    expect(out).toContain('- bookgui')
    expect(out).toContain('subcommands:')
  })

  it('omits discord when discordInvite is whitespace only', () => {
    const out = generateCWConfig(FIXTURE_PATH, '  \t  ', true)
    expect(out).not.toMatch(/\n    - discord\n/)
  })

  it('adds discord after bookgui when invite is provided', () => {
    const out = generateCWConfig(FIXTURE_PATH, 'https://discord.gg/abc', true)
    expect(out).toMatch(/- bookgui\r?\n    - discord\r?\n    subcommands:/)
  })

  it('removes duplicate discord then adds one when invite provided', () => {
    const tmp = path.join(os.tmpdir(), `cw-gen-test-${Date.now()}.yml`)
    const base = fs.readFileSync(FIXTURE_PATH, 'utf-8')
    const withDup = base.replace(
      /(\n    - bookgui)(\n    subcommands:)/,
      '$1\n    - discord\n    - discord$2'
    )
    fs.writeFileSync(tmp, withDup, 'utf-8')
    try {
      const out = generateCWConfig(tmp, 'https://discord.gg/x', true)
      const matches = out.match(/\n    - discord/g)
      expect(matches?.length).toBe(1)
    } finally {
      try {
        fs.unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('omits guidelore and lore when hasLore is false', () => {
    const out = generateCWConfig(FIXTURE_PATH, '', false)
    expect(out).not.toMatch(/\n    - guidelore\r?\n/)
    expect(out).not.toMatch(/\n    - lore\r?\n/)
    expect(out).toMatch(/- guidediscovery\r?\n    - guideregions/)
    expect(out).toMatch(/- sb\r?\n    - bookgui/)
  })

  it('inserts guidelore and lore when hasLore is true', () => {
    const out = generateCWConfig(FIXTURE_PATH, '', true)
    expect(out).toMatch(
      /- guidediscovery\r?\n    - guidelore\r?\n    - guideregions/
    )
    expect(out).toMatch(/- sb\r?\n    - lore\r?\n    - bookgui/)
  })

  it('removes duplicate lore then adds one when hasLore is true', () => {
    const tmp = path.join(os.tmpdir(), `cw-lore-test-${Date.now()}.yml`)
    const base = fs.readFileSync(FIXTURE_PATH, 'utf-8')
    const withDup = base.replace(
      /(\n    - sb)(\n    - bookgui)/,
      '$1\n    - lore\n    - lore$2'
    )
    fs.writeFileSync(tmp, withDup, 'utf-8')
    try {
      const out = generateCWConfig(tmp, '', true)
      expect(out.match(/\n    - lore/g)?.length).toBe(1)
    } finally {
      try {
        fs.unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('with invite and no lore: discord only, no guidelore or lore', () => {
    const out = generateCWConfig(FIXTURE_PATH, 'https://discord.gg/z', false)
    expect(out).toMatch(/- bookgui\r?\n    - discord\r?\n    subcommands:/)
    expect(out).not.toMatch(/\n    - guidelore\r?\n/)
    expect(out).not.toMatch(/\n    - lore\r?\n/)
  })

  it('removes duplicate guidelore then adds one when hasLore is true', () => {
    const tmp = path.join(os.tmpdir(), `cw-guidelore-test-${Date.now()}.yml`)
    const base = fs.readFileSync(FIXTURE_PATH, 'utf-8')
    const withDup = base.replace(
      /(\n    - guidediscovery)(\n    - guideregions)/,
      '$1\n    - guidelore\n    - guidelore$2'
    )
    fs.writeFileSync(tmp, withDup, 'utf-8')
    try {
      const out = generateCWConfig(tmp, '', true)
      expect(out.match(/\n    - guidelore/g)?.length).toBe(1)
    } finally {
      try {
        fs.unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })
})
