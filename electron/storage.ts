const { app } = require('electron')
const { join } = require('path')
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } = require('fs')

type ServerProfile = any // Will be properly typed after build

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

export function listServerIds(): string[] {
  const serversDir = getServersDirectory()
  if (!existsSync(serversDir)) {
    return []
  }

  // Read directory and filter for directories that contain profile.json
  const entries = readdirSync(serversDir, { withFileTypes: true })
  return entries
    .filter((entry: any) => entry.isDirectory())
    .map((entry: any) => entry.name)
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

export function saveBuildReport(serverId: string, buildId: string, report: any): void {
  const buildDir = ensureBuildDirectory(serverId, buildId)
  const reportPath = getBuildReportPath(serverId, buildId)
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
}

export function loadBuildReport(serverId: string, buildId: string): any | null {
  const reportPath = getBuildReportPath(serverId, buildId)
  if (!existsSync(reportPath)) {
    return null
  }

  try {
    const content = readFileSync(reportPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`Failed to load build report ${buildId}:`, error)
    return null
  }
}

export function listBuildIds(serverId: string): string[] {
  const buildsDir = getBuildsDirectory(serverId)
  if (!existsSync(buildsDir)) {
    return []
  }

  const entries = readdirSync(buildsDir, { withFileTypes: true })
  return entries
    .filter((entry: any) => entry.isDirectory())
    .map((entry: any) => entry.name)
    .sort()
    .reverse() // Most recent first
}

module.exports = {
  getDataDirectory,
  getServersDirectory,
  getServerDirectory,
  getServerProfilePath,
  initDataDirectory,
  loadServerProfile,
  saveServerProfile,
  listServerIds,
  getBuildsDirectory,
  getBuildDirectory,
  getBuildReportPath,
  ensureBuildDirectory,
  saveBuildReport,
  loadBuildReport,
  listBuildIds,
}
