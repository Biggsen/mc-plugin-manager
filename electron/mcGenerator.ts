const { readFileSync } = require('fs')

/**
 * Generate MyCommand commands.yml by substituting placeholders in the template
 * 
 * Placeholders:
 * - {SERVER_NAME} -> profile.name
 */
export function generateMCConfig(templatePath: string, serverName: string): string {
  const content = readFileSync(templatePath, 'utf-8')
  
  // Replace placeholders
  const result = content.replace(/\{SERVER_NAME\}/g, serverName)
  
  return result
}

module.exports = {
  generateMCConfig,
}
