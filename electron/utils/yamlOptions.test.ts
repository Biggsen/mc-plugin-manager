import { describe, it, expect } from 'vitest'
import { YAML_STRINGIFY_OPTIONS } from './yamlOptions'

describe('YAML_STRINGIFY_OPTIONS', () => {
  it('has expected shape for generator output', () => {
    expect(YAML_STRINGIFY_OPTIONS.indent).toBe(2)
    expect(YAML_STRINGIFY_OPTIONS.lineWidth).toBe(0)
    expect(YAML_STRINGIFY_OPTIONS.singleQuote).toBe(true)
    expect(YAML_STRINGIFY_OPTIONS.simpleKeys).toBe(false)
  })
})
