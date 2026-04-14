import type { BuildListItem, BuildReport } from '../types'

/**
 * Shapes one history row from a build report.
 * Missing reports return only buildId; legacy reports get testBuild=false.
 */
export function toBuildListItem(buildId: string, report: BuildReport | null): BuildListItem {
  if (!report) {
    return { buildId }
  }
  const note = report.buildNote?.trim()
  return {
    buildId,
    testBuild: Boolean(report.testBuild),
    ...(note ? { buildNote: note } : {}),
  }
}
