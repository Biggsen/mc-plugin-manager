import type { ServerProfile } from '../types'

/** Canonical name for YAML / plugin output; falls back to profile display name. */
export function resolveConfigServerName(profile: ServerProfile): string {
  const s = profile.serverName?.trim()
  return s && s.length > 0 ? s : profile.name
}
