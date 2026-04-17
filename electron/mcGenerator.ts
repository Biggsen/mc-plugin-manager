const { readFileSync } = require('fs')
const yaml = require('yaml')

import type { RegionRecord } from './types'
import { YAML_STRINGIFY_OPTIONS } from './utils/yamlOptions'

const LORE_GUIDES_LINE = '&e> Lore; &d/guidelore;/guidelore'

/**
 * Generate MyCommand commands.yml by substituting placeholders in the template
 *
 * Placeholders:
 * - {SERVER_NAME} -> resolved config server name (see resolveConfigServerName)
 * - {TEBEX_SUBDOMAIN} -> custom Tebex subdomain (left side of `.tebex.io`)
 *
 * Any `discord` command block is removed (DiscordSRV owns /discord).
 *
 * When hasLore is true and regions are provided, the lore command's tab_completer is replaced with
 * main region IDs (overworld, kind: region), sorted alphabetically.
 * When hasLore is false, the lore command, server_guide_lore, and the Lore line in server_guides are omitted.
 */
export function generateMCConfig(
  templatePath: string,
  serverName: string,
  tebexSubdomain: string,
  regions: RegionRecord[] = [],
  hasLore: boolean = false
): string {
  let content = readFileSync(templatePath, 'utf-8')
  content = content.replace(/\{SERVER_NAME\}/g, serverName)
  content = content.replace(/\{TEBEX_SUBDOMAIN\}/g, tebexSubdomain.trim())

  const config = yaml.parse(content)
  if (config?.discord) {
    delete config.discord
  }

  if (!hasLore) {
    delete config.lore
    delete config.server_guide_lore
    if (Array.isArray(config?.server_guides?.text)) {
      config.server_guides.text = config.server_guides.text.filter(
        (line: string) => String(line).trim() !== LORE_GUIDES_LINE
      )
    }
  } else if (regions.length > 0 && config?.lore?.tab_completer) {
    const mainRegionIds = regions
      .filter((r) => r.world === 'overworld' && r.kind === 'region')
      .map((r) => r.id)
      .sort((a, b) => a.localeCompare(b))
    config.lore.tab_completer = mainRegionIds
  }

  return yaml.stringify(config, YAML_STRINGIFY_OPTIONS)
}

module.exports = {
  generateMCConfig,
}
