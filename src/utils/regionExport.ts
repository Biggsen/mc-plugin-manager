import type { RegionKind, RegionRecord, ServerProfile } from '../types'

export interface ExportedRegion {
  world: RegionRecord['world']
  id: string
  kind: RegionKind
  name: string
  structureType?: string
}

export interface RegionExportDocument {
  serverId: string
  serverName: string
  exportedAt: string
  regions: ExportedRegion[]
}

function formatRegionId(id: string): string {
  return id
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
}

function regionDisplayName(region: RegionRecord): string {
  return region.discover.displayNameOverride ?? formatRegionId(region.id)
}

function toExportedRegion(region: RegionRecord): ExportedRegion {
  const row: ExportedRegion = {
    world: region.world,
    id: region.id,
    kind: region.kind,
    name: regionDisplayName(region),
  }
  if (region.kind === 'structure' && region.structureType) {
    row.structureType = region.structureType
  }
  return row
}

export function buildRegionExportDocument(server: ServerProfile): RegionExportDocument {
  const sorted = [...server.regions].sort((a, b) => {
    const w = a.world.localeCompare(b.world)
    if (w !== 0) return w
    return a.id.localeCompare(b.id)
  })
  return {
    serverId: server.id,
    serverName: server.name,
    exportedAt: new Date().toISOString(),
    regions: sorted.map(toExportedRegion),
  }
}

export function downloadJsonDocument(filename: string, doc: unknown): void {
  const json = JSON.stringify(doc, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function safeFilenamePart(s: string): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return t || 'server'
}

export function suggestedRegionExportFilename(server: ServerProfile): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `regions-${safeFilenamePart(server.id)}-${stamp}.json`
}
