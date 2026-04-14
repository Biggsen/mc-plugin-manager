import { describe, expect, it } from 'vitest'
import { validateBuildNoteInput } from './buildNotes'

describe('validateBuildNoteInput', () => {
  it('requires a note for normal builds', () => {
    expect(validateBuildNoteInput(false, '   ')).toContain('Build note is required')
  })

  it('allows empty note for test builds', () => {
    expect(validateBuildNoteInput(true, '   ')).toBeNull()
  })

  it('accepts note for normal builds', () => {
    expect(validateBuildNoteInput(false, 'Fix TAB footer')).toBeNull()
  })
})
