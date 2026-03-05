const { readFileSync } = require('fs')
const yaml = require('yaml')

interface RegionRecord {
  world: string
  id: string
  kind: string
}

const yamlOptions = { indent: 2, lineWidth: 0, singleQuote: true }

/**
 * Generate MyCommand commands.yml by substituting placeholders in the template
 *
 * Placeholders:
 * - {SERVER_NAME} -> profile.name
 * - {DISCORD_INVITE} -> only substituted when discordInvite is provided; otherwise the discord command is omitted
 *
 * When regions are provided, the lore command's tab_completer is replaced with
 * main region IDs (overworld, kind: region), sorted alphabetically.
 */
export function generateMCConfig(
  templatePath: string,
  serverName: string,
  regions: RegionRecord[] = [],
  discordInvite: string = ''
): string {
  let content = readFileSync(templatePath, 'utf-8')
  content = content.replace(/\{SERVER_NAME\}/g, serverName)

  const config = yaml.parse(content)
  const hasInvite = Boolean(discordInvite && discordInvite.trim())

  if (config?.discord) {
    if (hasInvite) {
      const invite = discordInvite.trim()
      if (Array.isArray(config.discord.text)) {
        config.discord.text = config.discord.text.map((line: string) =>
          String(line).replace(/\{DISCORD_INVITE\}/g, invite)
        )
      }
    } else {
      delete config.discord
    }
  }

  if (regions.length > 0 && config?.lore?.tab_completer) {
    const mainRegionIds = regions
      .filter((r) => r.world === 'overworld' && r.kind === 'region')
      .map((r) => r.id)
      .sort((a, b) => a.localeCompare(b))
    config.lore.tab_completer = mainRegionIds
  }

  return yaml.stringify(config, yamlOptions)
}

module.exports = {
  generateMCConfig,
}
