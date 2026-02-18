const yaml = require('yaml')

const CHARS_PER_PAGE = 256

interface RegionRecord {
  world: string
  id: string
  kind: string
  discover: {
    displayNameOverride?: string
  }
  description?: string
}

function formatRegionTitle(id: string): string {
  return id
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
}

function paginateDescription(text: string, charsPerPage: number = CHARS_PER_PAGE): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const pages: string[] = []
  let remaining = trimmed

  while (remaining.length > 0) {
    if (remaining.length <= charsPerPage) {
      pages.push(remaining.trim())
      break
    }

    let cut = charsPerPage
    const chunk = remaining.slice(0, charsPerPage)
    const lastNewline = chunk.lastIndexOf('\n')
    const lastSpace = chunk.lastIndexOf(' ')

    if (lastNewline >= charsPerPage * 0.5) {
      cut = lastNewline + 1
    } else if (lastSpace >= charsPerPage * 0.5) {
      cut = lastSpace + 1
    }

    pages.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trimStart()
  }

  return pages
}

function generateLoreBookYaml(
  region: RegionRecord,
  author: string = 'Admin'
): string | null {
  const description = region.description?.trim()
  if (!description) return null

  const title = region.discover.displayNameOverride ?? formatRegionTitle(region.id)
  const pages = paginateDescription(description)

  const book = {
    title,
    author,
    pages,
  }

  return yaml.stringify(book, { lineWidth: 0 })
}

export function generateLoreBooks(
  regions: RegionRecord[],
  author: string = 'Admin'
): Map<string, string> {
  const result = new Map<string, string>()

  for (const region of regions) {
    if (!region.description?.trim()) continue

    const yamlContent = generateLoreBookYaml(region, author)
    if (yamlContent) {
      result.set(region.id, yamlContent)
    }
  }

  return result
}
