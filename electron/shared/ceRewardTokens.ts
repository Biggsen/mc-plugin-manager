import { snakeToTitleCase } from './stringFormatters'

/** Roman numerals I–X for enchant / potion stack labels */
export function toRomanLevel(n: number): string {
  const r = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
  if (n >= 1 && n <= 10) return r[n]
  return String(n)
}

export function extractCeCallToken(line: string): string | null {
  const m = String(line).match(/ce\s+call\s+(\S+)/i)
  return m ? m[1] : null
}

export function ceCallExecuteLine(token: string): string {
  return `ce call ${token} player:PLAYER`
}

function displayFromBookToken(token: string): string | null {
  if (!token.startsWith('get_book_')) return null
  let rest = token.slice('get_book_'.length)
  const levelMatch = rest.match(/_(\d+)$/)
  let level: number | null = null
  if (levelMatch) {
    level = parseInt(levelMatch[1], 10)
    rest = rest.slice(0, -(levelMatch[0].length))
  }
  const title = snakeToTitleCase(rest)
  if (level !== null) {
    return `${title} ${toRomanLevel(level)}`
  }
  return title
}

function displayFromPotionToken(token: string): string | null {
  if (!token.startsWith('get_potion_')) return null
  let rest = token.slice('get_potion_'.length)
  if (rest.endsWith('_long')) {
    const base = rest.slice(0, -'_long'.length)
    return `Potion of ${snakeToTitleCase(base)} Long`
  }
  const stackMatch = rest.match(/^(.+)_(\d+)$/)
  if (stackMatch) {
    const base = stackMatch[1]
    const count = parseInt(stackMatch[2], 10)
    const baseTitle = snakeToTitleCase(base)
    return `${count} Potions of ${baseTitle}`
  }
  return `Potion of ${snakeToTitleCase(rest)}`
}

export function labelFromCeCallToken(token: string): string | null {
  return displayFromBookToken(token) ?? displayFromPotionToken(token)
}

export function rewardDisplayFromCeExecuteLine(line: string): string | null {
  const token = extractCeCallToken(line)
  if (!token) return null
  return labelFromCeCallToken(token)
}

export type CeRewardKind = 'enchantment' | 'potion'

export function ceRewardKindFromToken(token: string): CeRewardKind | null {
  if (token.startsWith('get_book_')) return 'enchantment'
  if (token.startsWith('get_potion_')) return 'potion'
  return null
}
