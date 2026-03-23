import { describe, it, expect } from 'vitest'
import { substituteDiscordSrvConfig } from './discordSrvGenerator'

describe('substituteDiscordSrvConfig', () => {
  it('replaces all bracket placeholders', () => {
    const raw = [
      'BotToken: "[bot token]"',
      'Channels: {"global": "[global channel]", "status": "[status channel]"}',
      'DiscordConsoleChannelId: "[console channel]"',
      'DiscordInviteLink: "[discord invite url]"',
    ].join('\n')
    const out = substituteDiscordSrvConfig(raw, {
      botToken: 'tok',
      globalChannelId: '111',
      statusChannelId: '222',
      consoleChannelId: '',
      discordInviteUrl: 'https://discord.gg/x',
    })
    expect(out).toContain('BotToken: "tok"')
    expect(out).toContain('"global": "111"')
    expect(out).toContain('"status": "222"')
    expect(out).toContain('DiscordConsoleChannelId: ""')
    expect(out).toContain('DiscordInviteLink: "https://discord.gg/x"')
  })
})
