/**
 * Returns a validation error when a normal build is missing a note.
 * Test builds can omit a note.
 */
export function validateBuildNoteInput(testBuild: boolean, buildNote: string | undefined): string | null {
  const note = String(buildNote ?? '').trim()
  if (!testBuild && note.length === 0) {
    return 'Build note is required. Enable “Test build” for iterative emits without bumping generator versions.'
  }
  return null
}
