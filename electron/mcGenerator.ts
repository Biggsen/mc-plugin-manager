const { readFileSync } = require('fs')
const yaml = require('yaml')

interface RegionRecord {
  world: string
  id: string
  kind: string
}

/**
 * Generate MyCommand commands.yml by substituting placeholders in the template
 *
 * Placeholders:
 * - {SERVER_NAME} -> profile.name
 *
 * When regions are provided, the lore command's tab_completer is replaced with
 * main region IDs (overworld, kind: region), sorted alphabetically.
 */
export function generateMCConfig(
  templatePath: string,
  serverName: string,
  regions: RegionRecord[] = []
): string {
  let content = readFileSync(templatePath, 'utf-8')

  content = content.replace(/\{SERVER_NAME\}/g, serverName)

  if (regions.length > 0) {
    const mainRegionIds = regions
      .filter((r) => r.world === 'overworld' && r.kind === 'region')
      .map((r) => r.id)
      .sort((a, b) => a.localeCompare(b))

    const config = yaml.parse(content)
    if (config?.lore?.tab_completer) {
      config.lore.tab_completer = mainRegionIds
      content = yaml.stringify(config, {
        indent: 2,
        lineWidth: 0,
        singleQuote: true,
      })
    }
  }

  return content
}

module.exports = {
  generateMCConfig,
}
