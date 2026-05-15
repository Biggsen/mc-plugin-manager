/** CrazyCrates / vanilla material id for enchanted books. */
export const CRAZY_CRATES_ENCHANTED_BOOK = 'enchanted_book'

/**
 * Parses catalog ids like `enchanted_book_feather_falling_4` or `ENCHANTED_BOOK_MENDING_1`.
 */
export function parseEnchantedBookMaterial(
  materialOrItemId: string
): { enchantment: string; level: number } | null {
  const normalized = materialOrItemId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const match = /^enchanted_book_(.+)_(\d+)$/.exec(normalized)
  if (!match) return null
  const level = Number(match[2])
  if (!Number.isFinite(level) || level < 1) return null
  return { enchantment: match[1], level: Math.round(level) }
}
