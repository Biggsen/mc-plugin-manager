const path = require('path')
const { existsSync, statSync, readFileSync } = require('fs')
const { createTwoFilesPatch } = require('diff')
import type { PluginFolderCompareFileResult, PluginFolderCompareResult } from '../types'
import type { PmGeneratedEntry } from './pmGeneratedPaths'
import { stripGeneratorVersionCommentLines } from './generatorVersionHeader'

const MAX_BYTES = 6 * 1024 * 1024

function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n')
}

/** Line endings normalized; leading `# mc-plugin-manager:` line(s) stripped so compare/diffs ignore generator metadata. */
function normalizeForCompare(s: string): string {
  return normalizeText(stripGeneratorVersionCommentLines(normalizeText(s)))
}

export function comparePmPluginFolders(
  leftRoot: string,
  rightRoot: string,
  entries: PmGeneratedEntry[],
  bookGuiWarning?: string
): PluginFolderCompareResult {
  const files: PluginFolderCompareFileResult[] = []
  const summary = {
    identical: 0,
    different: 0,
    missingLeft: 0,
    missingRight: 0,
    missingBoth: 0,
    readErrors: 0,
  }

  for (const entry of entries) {
    const leftPath = path.join(leftRoot, entry.relativePath)
    const rightPath = path.join(rightRoot, entry.relativePath)
    const leftExists = existsSync(leftPath)
    const rightExists = existsSync(rightPath)

    if (!leftExists && !rightExists) {
      files.push({
        id: entry.id,
        label: entry.label,
        relativePath: entry.relativePath,
        status: 'missing_both',
      })
      summary.missingBoth++
      continue
    }
    if (!leftExists) {
      files.push({
        id: entry.id,
        label: entry.label,
        relativePath: entry.relativePath,
        status: 'missing_left',
      })
      summary.missingLeft++
      continue
    }
    if (!rightExists) {
      files.push({
        id: entry.id,
        label: entry.label,
        relativePath: entry.relativePath,
        status: 'missing_right',
      })
      summary.missingRight++
      continue
    }

    let leftStat
    let rightStat
    try {
      leftStat = statSync(leftPath)
      rightStat = statSync(rightPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      files.push({
        id: entry.id,
        label: entry.label,
        relativePath: entry.relativePath,
        status: 'read_error',
        error: msg,
      })
      summary.readErrors++
      continue
    }

    if (!leftStat.isFile() || !rightStat.isFile()) {
      files.push({
        id: entry.id,
        label: entry.label,
        relativePath: entry.relativePath,
        status: 'read_error',
        error: 'Not a regular file on one or both sides',
      })
      summary.readErrors++
      continue
    }

    if (leftStat.size > MAX_BYTES || rightStat.size > MAX_BYTES) {
      files.push({
        id: entry.id,
        label: entry.label,
        relativePath: entry.relativePath,
        status: 'read_error',
        error: `File too large to compare (max ${MAX_BYTES} bytes)`,
      })
      summary.readErrors++
      continue
    }

    let leftContent: string
    let rightContent: string
    try {
      leftContent = readFileSync(leftPath, 'utf-8')
      rightContent = readFileSync(rightPath, 'utf-8')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      files.push({
        id: entry.id,
        label: entry.label,
        relativePath: entry.relativePath,
        status: 'read_error',
        error: msg,
      })
      summary.readErrors++
      continue
    }

    const a = normalizeForCompare(leftContent)
    const b = normalizeForCompare(rightContent)
    if (a === b) {
      files.push({
        id: entry.id,
        label: entry.label,
        relativePath: entry.relativePath,
        status: 'identical',
      })
      summary.identical++
    } else {
      const patch = createTwoFilesPatch(
        entry.relativePath,
        entry.relativePath,
        a,
        b,
        'Left',
        'Right'
      )
      files.push({
        id: entry.id,
        label: entry.label,
        relativePath: entry.relativePath,
        status: 'different',
        unifiedDiff: patch,
      })
      summary.different++
    }
  }

  return {
    leftRoot,
    rightRoot,
    ...(bookGuiWarning ? { bookGuiWarning } : {}),
    files,
    summary,
  }
}

export function validatePluginsRoot(
  dir: string
): { ok: true; resolved: string } | { ok: false; error: string } {
  if (!dir || dir.trim().length === 0) {
    return { ok: false, error: 'Path is empty' }
  }
  const resolved = path.resolve(dir)
  if (!existsSync(resolved)) {
    return { ok: false, error: `Path does not exist: ${resolved}` }
  }
  try {
    const st = statSync(resolved)
    if (!st.isDirectory()) {
      return { ok: false, error: 'Not a directory' }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
  return { ok: true, resolved }
}
