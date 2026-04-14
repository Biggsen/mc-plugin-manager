const { app } = require('electron')
const { join } = require('path')
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } = require('fs')

import type { ServerProfile, BuildReport, BuildListItem, ComparePreset } from './types'

const DATA_DIR_NAME = 'mc-plugin-manager-data'

export function getDataDirectory(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, DATA_DIR_NAME)
}

export function getServersDirectory(): string {
  return join(getDataDirectory(), 'servers')
}

export function getServerDirectory(serverId: string): string {
  return join(getServersDirectory(), serverId)
}

export function getServerProfilePath(serverId: string): string {
  return join(getServerDirectory(serverId), 'profile.json')
}

export async function initDataDirectory(): Promise<void> {
  const dataDir = getDataDirectory()
  const serversDir = getServersDirectory()

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  if (!existsSync(serversDir)) {
    mkdirSync(serversDir, { recursive: true })
  }
}

export function loadServerProfile(serverId: string): ServerProfile | null {
  const profilePath = getServerProfilePath(serverId)
  if (!existsSync(profilePath)) {
    return null
  }

  try {
    const content = readFileSync(profilePath, 'utf-8')
    return JSON.parse(content) as ServerProfile
  } catch (error) {
    console.error(`Failed to load server profile ${serverId}:`, error)
    return null
  }
}

export function saveServerProfile(profile: ServerProfile): void {
  const serverDir = getServerDirectory(profile.id)
  if (!existsSync(serverDir)) {
    mkdirSync(serverDir, { recursive: true })
  }

  const profilePath = getServerProfilePath(profile.id)
  writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf-8')
}

export function deleteServer(serverId: string): void {
  const serverDir = getServerDirectory(serverId)
  if (!existsSync(serverDir)) {
    return
  }
  rmSync(serverDir, { recursive: true })
}

export function listServerIds(): string[] {
  const serversDir = getServersDirectory()
  if (!existsSync(serversDir)) {
    return []
  }

  // Read directory and filter for directories that contain profile.json
  const entries = readdirSync(serversDir, { withFileTypes: true }) as import('fs').Dirent[]
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id: string) => {
      const profilePath = getServerProfilePath(id)
      return existsSync(profilePath)
    })
}

export function getBuildsDirectory(serverId: string): string {
  return join(getServerDirectory(serverId), 'builds')
}

export function getBuildDirectory(serverId: string, buildId: string): string {
  return join(getBuildsDirectory(serverId), buildId)
}

export function getBuildReportPath(serverId: string, buildId: string): string {
  return join(getBuildDirectory(serverId, buildId), 'report.json')
}

export function ensureBuildDirectory(serverId: string, buildId: string): string {
  const buildDir = getBuildDirectory(serverId, buildId)
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, { recursive: true })
  }
  return buildDir
}

export function saveBuildReport(serverId: string, buildId: string, report: BuildReport): void {
  const buildDir = ensureBuildDirectory(serverId, buildId)
  const reportPath = getBuildReportPath(serverId, buildId)
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
}

export function loadBuildReport(serverId: string, buildId: string): BuildReport | null {
  const reportPath = getBuildReportPath(serverId, buildId)
  if (!existsSync(reportPath)) {
    return null
  }

  try {
    const content = readFileSync(reportPath, 'utf-8')
    return JSON.parse(content) as BuildReport
  } catch (error) {
    console.error(`Failed to load build report ${buildId}:`, error)
    return null
  }
}

export function getComparePresetsPath(): string {
  return join(getDataDirectory(), 'compare-presets.json')
}

export function loadComparePresets(): ComparePreset[] {
  const p = getComparePresetsPath()
  if (!existsSync(p)) {
    return []
  }
  try {
    const content = readFileSync(p, 'utf-8')
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (row): row is ComparePreset =>
        typeof row === 'object' &&
        row !== null &&
        typeof (row as ComparePreset).id === 'string' &&
        typeof (row as ComparePreset).name === 'string' &&
        typeof (row as ComparePreset).leftPath === 'string' &&
        typeof (row as ComparePreset).rightPath === 'string' &&
        typeof (row as ComparePreset).updatedAt === 'string'
    )
  } catch (error) {
    console.error('Failed to load compare presets:', error)
    return []
  }
}

export function saveComparePresets(presets: ComparePreset[]): void {
  const dataDir = getDataDirectory()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  const p = getComparePresetsPath()
  writeFileSync(p, JSON.stringify(presets, null, 2), 'utf-8')
}

export function listBuildIds(serverId: string): string[] {
  const buildsDir = getBuildsDirectory(serverId)
  if (!existsSync(buildsDir)) {
    return []
  }

  const entries = readdirSync(buildsDir, { withFileTypes: true }) as import('fs').Dirent[]
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse() // Most recent first
}

/** Build history rows for UI (reads each report.json). */
export function listBuildSummaries(serverId: string): BuildListItem[] {
  return listBuildIds(serverId).map((buildId) => {
    const report = loadBuildReport(serverId, buildId)
    if (!report) {
      return { buildId }
    }
    const note = report.buildNote?.trim()
    return {
      buildId,
      testBuild: Boolean(report.testBuild),
      ...(note ? { buildNote: note } : {}),
    }
  })
}

module.exports = {
  getDataDirectory,
  getServersDirectory,
  getServerDirectory,
  getServerProfilePath,
  initDataDirectory,
  loadServerProfile,
  saveServerProfile,
  deleteServer,
  listServerIds,
  getBuildsDirectory,
  getBuildDirectory,
  getBuildReportPath,
  ensureBuildDirectory,
  saveBuildReport,
  loadBuildReport,
  listBuildIds,
  listBuildSummaries,
  getComparePresetsPath,
  loadComparePresets,
  saveComparePresets,
}
