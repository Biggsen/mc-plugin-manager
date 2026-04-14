import { describe, expect, it } from 'vitest'
import { toBuildListItem } from './buildSummary'

describe('toBuildListItem', () => {
  it('returns buildId-only row when report is missing', () => {
    expect(toBuildListItem('build-1000', null)).toEqual({ buildId: 'build-1000' })
  })

  it('maps legacy report fields with testBuild default false', () => {
    const legacyReport = {
      buildId: 'build-1001',
      timestamp: '2026-01-01T00:00:00.000Z',
      regionCounts: {
        overworld: 0,
        nether: 0,
        hearts: 0,
        villages: 0,
        regions: 0,
        system: 0,
        structures: 0,
        water: 0,
      },
      generated: {
        aa: false,
        bookgui: false,
        ce: false,
        tab: false,
        lm: false,
        mc: false,
        cw: false,
      },
      warnings: [],
      errors: [],
    }

    expect(toBuildListItem('build-1001', legacyReport as any)).toEqual({
      buildId: 'build-1001',
      testBuild: false,
    })
  })
})
