import type { CrazyCratesBundledCrateStem, ResolvedCrazyCratesCrate, ServerProfile } from './types'
import { loadCrateLibrary } from './crateLibrary'
import { CRAZY_CRATES_BUNDLED_CRATE_STEMS } from './utils/crazyCratesBundledConfig'
import { listServerIds, loadServerProfile, saveServerProfile } from './storage'

export function resolveCrazyCratesForServer(profile: ServerProfile): {
  crates: ResolvedCrazyCratesCrate[]
  warnings: string[]
  usedLibraryAssignment: boolean
} {
  const warnings: string[] = []
  const ids = profile.crazyCrates?.libraryCrateIds ?? []

  if (ids.length === 0) {
    const crates: ResolvedCrazyCratesCrate[] = CRAZY_CRATES_BUNDLED_CRATE_STEMS.map((legacyStem) => ({
      outputStem: legacyStem,
      legacyStem,
    }))
    return { crates, warnings, usedLibraryAssignment: false }
  }

  const library = loadCrateLibrary()
  const byId = new Map(library.map((e) => [e.id, e]))
  const seenOutputStems = new Set<string>()
  const crates: ResolvedCrazyCratesCrate[] = []

  for (const rawId of ids) {
    const entry = byId.get(rawId)
    if (!entry) {
      warnings.push(`CrazyCrates library entry not found for id "${rawId}" — skipped`)
      continue
    }
    const outputStem = entry.outputStem.trim()
    if (!outputStem) {
      warnings.push(`CrazyCrates library entry "${entry.id}" has empty output stem — skipped`)
      continue
    }
    const key = outputStem.toLowerCase()
    if (seenOutputStems.has(key)) {
      warnings.push(
        `Duplicate CrazyCrates output stem "${outputStem}" in assignment for server — skipped duplicate library id "${entry.id}"`
      )
      continue
    }
    seenOutputStems.add(key)
    crates.push({
      libraryEntryId: entry.id,
      libraryEntry: entry,
      outputStem,
    })
  }

  if (crates.length === 0) {
    warnings.push('CrazyCrates: no valid library crates resolved for this server; no crate YAML files were written.')
  }

  return { crates, warnings, usedLibraryAssignment: true }
}

export function findServersReferencingLibraryCrate(crateId: string): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  for (const id of listServerIds()) {
    const p = loadServerProfile(id)
    if (!p) continue
    const ids = p.crazyCrates?.libraryCrateIds ?? []
    if (ids.includes(crateId)) {
      out.push({ id: p.id, name: p.name })
    }
  }
  return out
}

export function removeLibraryCrateIdFromAllServers(crateId: string): { id: string; name: string }[] {
  const touched: { id: string; name: string }[] = []
  for (const id of listServerIds()) {
    const p = loadServerProfile(id)
    if (!p) continue
    const cur = p.crazyCrates?.libraryCrateIds ?? []
    if (!cur.includes(crateId)) continue
    p.crazyCrates = {
      libraryCrateIds: cur.filter((x) => x !== crateId),
    }
    saveServerProfile(p)
    touched.push({ id: p.id, name: p.name })
  }
  return touched
}
