/**
 * Single-folder world name under plugins/WorldGuard/worlds/<name>/regions.yml
 * (no path separators or traversal).
 */
export function sanitizeWorldGuardWorldFolder(raw: unknown): string {
  const s = String(raw ?? 'world').trim() || 'world'
  const cleaned = s.replace(/[^a-zA-Z0-9_-]/g, '')
  return cleaned.length > 0 ? cleaned.slice(0, 128) : 'world'
}

/** POSIX-style relative path for compare UI and docs. */
export function getWorldGuardRegionsPropagatedRelativePath(worldFolder: string): string {
  const safe = sanitizeWorldGuardWorldFolder(worldFolder)
  return `WorldGuard/worlds/${safe}/regions.yml`
}
