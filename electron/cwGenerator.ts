const { readFileSync } = require('fs')

/**
 * Generate CommandWhitelist config.yml from the template.
 *
 * - `discord` is listed only when a Discord invite is set (same source as MyCommand).
 * - `guidelore` and `lore` are listed only when the profile has lore content (same rule
 *   as MyCommand `generateMCConfig` / `hasLore`).
 */
export function generateCWConfig(
  templatePath: string,
  discordInvite: string = '',
  hasLore: boolean = true
): string {
  let content = readFileSync(templatePath, 'utf-8')
  const hasInvite = Boolean(discordInvite && String(discordInvite).trim())

  content = content.replace(/\r?\n    - guidelore(?=\r?\n|$)/g, '')
  content = content.replace(/\r?\n    - lore(?=\r?\n|$)/g, '')
  content = content.replace(/\r?\n    - discord(?=\r?\n|$)/g, '')

  if (hasLore) {
    const guideRe = /(\r?\n    - guidediscovery)(\r?\n    - guideregions)/
    const withGuideLore = content.replace(
      guideRe,
      (_m: string, before: string, after: string) => {
        const nl = after.startsWith('\r\n') ? '\r\n' : '\n'
        return `${before}${nl}    - guidelore${after}`
      }
    )
    if (withGuideLore === content) {
      throw new Error(
        'CommandWhitelist template: could not find "    - guidediscovery" followed by "    - guideregions" (required to place guidelore)'
      )
    }
    content = withGuideLore

    const loreRe = /(\r?\n    - sb)(\r?\n    - bookgui)/
    const withLore = content.replace(loreRe, (_m: string, before: string, after: string) => {
      const nl = after.startsWith('\r\n') ? '\r\n' : '\n'
      return `${before}${nl}    - lore${after}`
    })
    if (withLore === content) {
      throw new Error(
        'CommandWhitelist template: could not find "    - sb" followed by "    - bookgui" (required to place lore)'
      )
    }
    content = withLore
  }

  if (hasInvite) {
    const replaced = content.replace(
      /(\r?\n    - bookgui)(\r?\n    subcommands:)/,
      (_m: string, before: string, after: string) => {
        const nl = after.startsWith('\r\n') ? '\r\n' : '\n'
        return `${before}${nl}    - discord${after}`
      }
    )
    if (replaced === content) {
      throw new Error(
        'CommandWhitelist template: could not find "    - bookgui" followed by "    subcommands:"'
      )
    }
    content = replaced
  }

  return content
}

module.exports = {
  generateCWConfig,
}
