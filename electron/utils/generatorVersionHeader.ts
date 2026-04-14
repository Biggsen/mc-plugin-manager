import type { GeneratorVersionKey } from '../types'

/** Machine-discoverable prefix for line 1 of generated plugin YAML. */
export const GENERATOR_VERSION_HEADER_PREFIX = '# mc-plugin-manager:'

export interface GeneratorVersionHeaderOptions {
  plugin: GeneratorVersionKey
  profileId: string
  buildId: string
  nextVersion: number
  generatedAt: string
  /** Raw or trimmed note; sanitized for `build-note=`; omitted when empty after sanitize. */
  buildNote?: string
  /** Adds `emit=test` (test build / no version bump). */
  testEmit?: boolean
}

/** Collapse whitespace, strip segment separators, cap length for a single header line. */
export function sanitizeBuildNoteForHeader(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw.replace(/\r\n|\n|\r/g, ' ').replace(/;/g, ',').trim()
  s = s.replace(/\s+/g, ' ')
  if (s.length > 200) {
    s = s.slice(0, 200).trim()
  }
  return s
}

/** Zero-pad to at least 3 digits through 999; wider unpadded beyond that. */
export function formatGeneratorVersionDisplay(n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`generator version must be a positive integer, got ${n}`)
  }
  return n <= 999 ? String(n).padStart(3, '0') : String(n)
}

export function prependGeneratorVersionHeader(
  content: string,
  opts: GeneratorVersionHeaderOptions
): string {
  const gv = formatGeneratorVersionDisplay(opts.nextVersion)
  const segments = [
    `generator-version=${gv}`,
    `generated-at=${opts.generatedAt}`,
    `profile=${opts.profileId}`,
    `plugin=${opts.plugin}`,
    `build-id=${opts.buildId}`,
  ]
  if (opts.testEmit) {
    segments.push('emit=test')
  }
  const noteForLine = opts.buildNote !== undefined && opts.buildNote !== ''
    ? sanitizeBuildNoteForHeader(opts.buildNote)
    : ''
  if (noteForLine.length > 0) {
    segments.push(`build-note=${noteForLine}`)
  }
  const line = `${GENERATOR_VERSION_HEADER_PREFIX} ${segments.join('; ')}`
  if (content.length === 0) {
    return `${line}\n`
  }
  return `${line}\n${content}`
}

/**
 * Remove leading full-line comments emitted by this tool (v1: one line; tolerate consecutive matches).
 */
export function stripGeneratorVersionCommentLines(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  let i = 0
  while (i < lines.length && lines[i].startsWith(GENERATOR_VERSION_HEADER_PREFIX)) {
    i++
  }
  if (i === 0) {
    return raw
  }
  const rest = lines.slice(i).join('\n')
  return rest
}
