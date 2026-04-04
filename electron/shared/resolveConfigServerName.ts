/**
 * Canonical name for YAML / plugin output; falls back to profile display name.
 * Uses a minimal shape so this module stays free of renderer-only types.
 */
export type ConfigServerNameSource = { name: string; serverName?: string }

export function resolveConfigServerName(profile: ConfigServerNameSource): string {
  const s = profile.serverName?.trim()
  return s && s.length > 0 ? s : profile.name
}
