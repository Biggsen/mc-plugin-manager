import { normalizeItemId } from '../dropTableNormalize'

export interface CeRewardCatalogLookup {
  catalogId: string
  quantity: number
}

/**
 * Map a CE call token (get_book_* / get_potion_*) to item-index catalog id(s).
 * Book levels match CE Events keys; potion `_long` → extended, `_2` → 2× base potion.
 */
export function ceRewardCatalogLookup(token: string): CeRewardCatalogLookup | null {
  if (token.startsWith('get_book_')) {
    let rest = token.slice('get_book_'.length)
    const levelMatch = rest.match(/_(\d+)$/)
    if (levelMatch) {
      const level = levelMatch[1]
      rest = rest.slice(0, -(levelMatch[0].length))
      return { catalogId: normalizeItemId(`enchanted_book_${rest}_${level}`), quantity: 1 }
    }
    return { catalogId: normalizeItemId(`enchanted_book_${rest}_1`), quantity: 1 }
  }

  if (token.startsWith('get_potion_')) {
    let rest = token.slice('get_potion_'.length)
    if (rest.endsWith('_long')) {
      const base = rest.slice(0, -'_long'.length)
      return { catalogId: normalizeItemId(`potion_of_${base}_extended`), quantity: 1 }
    }
    const stackMatch = rest.match(/^(.+)_(\d+)$/)
    if (stackMatch) {
      const count = parseInt(stackMatch[2], 10)
      if (!Number.isFinite(count) || count < 1) return null
      return {
        catalogId: normalizeItemId(`potion_of_${stackMatch[1]}_1`),
        quantity: count,
      }
    }
    return { catalogId: normalizeItemId(`potion_of_${rest}_1`), quantity: 1 }
  }

  return null
}

export function ceRewardUnitBuy(
  token: string,
  unitBuyById: (catalogId: string) => number | undefined
): number | undefined {
  const lookup = ceRewardCatalogLookup(token)
  if (!lookup) return undefined
  const unit = unitBuyById(lookup.catalogId)
  if (typeof unit !== 'number' || !Number.isFinite(unit)) return undefined
  const total = unit * lookup.quantity
  return Number.isFinite(total) ? total : undefined
}
