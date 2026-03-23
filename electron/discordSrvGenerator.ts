const { readFileSync, existsSync } = require('fs')
const electron = require('electron')
const path = require('path')

export interface DiscordSrvSubstitutions {
  botToken: string
  globalChannelId: string
  statusChannelId: string
  consoleChannelId: string
  discordInviteUrl: string
}

const TEMPLATE_CONFIG = 'discordsrv-config.yml'
const TEMPLATE_MESSAGES = 'discordsrv-messages.yml'

function resolveBundledDiscordSrvPath(filename: string): string {
  const isPackaged = electron.app.isPackaged
  const basePath = isPackaged ? electron.app.getAppPath() : path.join(__dirname, '..')
  const defaultPath = isPackaged
    ? path.join(basePath, 'dist-electron', 'assets', 'templates', filename)
    : path.join(basePath, 'assets', 'templates', filename)
  if (!existsSync(defaultPath)) {
    throw new Error(
      `Bundled DiscordSRV template not found at: ${defaultPath}. Run "npm run build:electron" to copy templates.`
    )
  }
  return defaultPath
}

/**
 * Replace template placeholders in DiscordSRV config.yml.
 * Template uses bracketed placeholders: [bot token], [global channel], etc.
 */
export function substituteDiscordSrvConfig(
  templateContent: string,
  sub: DiscordSrvSubstitutions
): string {
  let content = templateContent
  content = content.replace(/\[bot token\]/g, sub.botToken.trim())
  content = content.replace(/\[global channel\]/g, sub.globalChannelId.trim())
  content = content.replace(/\[status channel\]/g, sub.statusChannelId.trim())
  content = content.replace(/\[console channel\]/g, sub.consoleChannelId.trim())
  content = content.replace(/\[discord invite url\]/g, sub.discordInviteUrl.trim())
  return content
}

export function readDiscordSrvTemplatePaths(): { configPath: string; messagesPath: string } {
  return {
    configPath: resolveBundledDiscordSrvPath(TEMPLATE_CONFIG),
    messagesPath: resolveBundledDiscordSrvPath(TEMPLATE_MESSAGES),
  }
}

export function generateDiscordSrvConfigContent(
  configTemplatePath: string,
  sub: DiscordSrvSubstitutions
): string {
  const raw = readFileSync(configTemplatePath, 'utf-8')
  return substituteDiscordSrvConfig(raw, sub)
}

export function readDiscordSrvMessagesContent(messagesTemplatePath: string): string {
  return readFileSync(messagesTemplatePath, 'utf-8')
}

module.exports = {
  substituteDiscordSrvConfig,
  readDiscordSrvTemplatePaths,
  generateDiscordSrvConfigContent,
  readDiscordSrvMessagesContent,
}
