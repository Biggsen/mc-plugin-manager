const CHARS_PER_PAGE = 256

function escapeForDoubleQuotedYaml(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

interface RegionRecord {
  world: string
  id: string
  kind: string
  discover: {
    displayNameOverride?: string
  }
  description?: string
  loreBookAnchors?: string[]
  loreBookDescription?: string
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

  const lines = trimmed.split(/\n/)
  const pages: string[] = []
  let currentPage: string[] = []
  let currentLength = 0

  for (const line of lines) {
    const lineWithBreak = line + '\n'
    const lineLen = lineWithBreak.length

    if (currentLength + lineLen <= charsPerPage) {
      currentPage.push(line)
      currentLength += lineLen
      continue
    }

    let lineRemaining = line
    const spaceLeft = charsPerPage - currentLength - 1
    if (currentPage.length > 0 && spaceLeft > 0 && lineRemaining.length > 0) {
      const chunkSize = Math.min(lineRemaining.length, spaceLeft)
      let cut = chunkSize
      const chunk = lineRemaining.slice(0, chunkSize)
      const lastSpace = chunk.lastIndexOf(' ')
      if (lastSpace >= chunkSize * 0.5) cut = lastSpace + 1
      const head = lineRemaining.slice(0, cut).trim()
      if (head.length > 0) {
        currentPage.push(head)
        currentLength += head.length + 1
        lineRemaining = lineRemaining.slice(cut).trimStart()
      }
    }

    if (currentPage.length > 0) {
      pages.push(currentPage.join('\n').trimEnd())
      currentPage = []
      currentLength = 0
    }

    if (lineRemaining.length === 0) continue

    if (lineRemaining.length <= charsPerPage) {
      currentPage.push(lineRemaining)
      currentLength = lineRemaining.length + 1
    } else {
      let remaining = lineRemaining
      while (remaining.length > 0) {
        if (remaining.length <= charsPerPage) {
          currentPage.push(remaining)
          currentLength = remaining.length + 1
          break
        }
        const chunk = remaining.slice(0, charsPerPage)
        const lastSpace = chunk.lastIndexOf(' ')
        const cut = lastSpace >= charsPerPage * 0.5 ? lastSpace + 1 : charsPerPage
        currentPage.push(remaining.slice(0, cut).trim())
        pages.push(currentPage.join('\n').trimEnd())
        currentPage = []
        currentLength = 0
        remaining = remaining.slice(cut).trimStart()
      }
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join('\n').trimEnd())
  }

  return pages
}

function splitByAnchors(text: string, anchors: string[]): string[] {
  const trimmed = text.trim()
  if (!trimmed || anchors.length === 0) return [trimmed]
  let remaining = trimmed
  const pages: string[] = []
  for (const anchor of anchors) {
    const idx = remaining.indexOf(anchor)
    if (idx === -1) continue
    const cut = idx + anchor.length
    pages.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trimStart()
  }
  if (remaining.length > 0) pages.push(remaining.trim())
  return pages.length > 0 ? pages : [trimmed]
}

function generateLoreBookYaml(
  region: RegionRecord,
  author: string = 'Admin'
): string | null {
  const description = (region.loreBookDescription ?? region.description)?.trim()
  if (!description) return null

  const title = region.discover.displayNameOverride ?? formatRegionTitle(region.id)
  const pages =
    region.loreBookAnchors?.length
      ? splitByAnchors(description, region.loreBookAnchors)
      : paginateDescription(description)

  const expandParagraphBreaks = (s: string) => s.replace(/\n\n/g, '\n\n\n')
  const pageLines = pages.map((p) => `- "${escapeForDoubleQuotedYaml(expandParagraphBreaks(p))}"`)
  const safeScalar = (s: string) => /[\n":\\\t]/.test(s) ? `"${escapeForDoubleQuotedYaml(s)}"` : s
  const lines = [
    `title: ${safeScalar(title)}`,
    `author: ${safeScalar(author)}`,
    'pages:',
    ...pageLines,
  ]
  return lines.join('\n') + '\n'
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
