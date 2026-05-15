/**
 * Build reference/data/enchantments-data.json from items-prod-Full.json (dev source only).
 * Run: npm run build:data
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const PROD_PATH = path.join(ROOT, 'reference', 'data', 'items-prod-Full.json')
const ALL_PATH = path.join(ROOT, 'reference', 'data', 'all.json')
const OUT_PATH = path.join(ROOT, 'reference', 'data', 'enchantments-data.json')

const BOOK_PREFIX = 'enchanted_book_'

function titleCaseEnchantId(id) {
  return id
    .split('_')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function parseEnchantBookMaterialId(materialId) {
  if (!materialId.startsWith(BOOK_PREFIX) || materialId === 'enchanted_book') return null
  const rest = materialId.slice(BOOK_PREFIX.length)
  const m = /^(.+)_(\d+)$/.exec(rest)
  if (!m) return null
  return { enchantId: m[1], level: Number(m[2]) }
}

function main() {
  if (!fs.existsSync(PROD_PATH)) {
    console.error(`Missing source: ${PROD_PATH}`)
    process.exit(1)
  }
  if (!fs.existsSync(ALL_PATH)) {
    console.error(`Missing catalog: ${ALL_PATH}`)
    process.exit(1)
  }

  const prod = JSON.parse(fs.readFileSync(PROD_PATH, 'utf-8'))
  const all = JSON.parse(fs.readFileSync(ALL_PATH, 'utf-8'))
  const allKeys = new Set(Object.keys(all).filter((k) => !k.startsWith('_')))

  if (!Array.isArray(prod.items)) {
    console.error('items-prod-Full.json: expected items array')
    process.exit(1)
  }

  const enchants = {}
  const items = {}
  const warnings = []

  for (const row of prod.items) {
    const materialId = String(row.material_id ?? '').trim().toLowerCase()
    if (!materialId) continue

    if (row.enchantable === true && Array.isArray(row.enchantCategories)) {
      const categories = [...new Set(row.enchantCategories.map((c) => String(c).trim()).filter(Boolean))].sort()
      items[materialId] = { enchantable: true, categories }
      if (!allKeys.has(materialId)) {
        warnings.push(`enchantable item missing from all.json: ${materialId}`)
      }
    }

    const parsed = parseEnchantBookMaterialId(materialId)
    if (!parsed) continue
    const { enchantId } = parsed
    if (enchants[enchantId]) continue
    let category = row.enchantment_category
    let maxLevel = row.enchantment_max_level
    if (typeof category !== 'string' || !category.trim()) {
      const curseFallback = {
        curse_of_binding: { category: 'armor', maxLevel: 1 },
        curse_of_vanishing: { category: 'vanishing', maxLevel: 1 },
      }
      const fb = curseFallback[enchantId]
      if (fb) {
        category = fb.category
        maxLevel = fb.maxLevel
      } else {
        warnings.push(`enchanted book missing category: ${materialId}`)
        continue
      }
    }
    if (typeof maxLevel !== 'number' || !Number.isFinite(maxLevel) || maxLevel < 1) {
      warnings.push(`enchanted book missing maxLevel: ${materialId}`)
      continue
    }
    const exclude = Array.isArray(row.enchantment_exclude)
      ? [...new Set(row.enchantment_exclude.map((x) => String(x).trim().toLowerCase()).filter(Boolean))].sort()
      : []
    const name = titleCaseEnchantId(enchantId)
    enchants[enchantId] = {
      name,
      maxLevel: Math.round(maxLevel),
      category: category.trim(),
      ...(exclude.length > 0 ? { exclude } : {}),
    }
  }

  const out = {
    schemaVersion: 1,
    enchants,
    items,
  }

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf-8')
  console.log(
    `Wrote ${OUT_PATH}: ${Object.keys(enchants).length} enchants, ${Object.keys(items).length} enchantable items`
  )
  if (warnings.length > 0) {
    console.warn(`Warnings (${warnings.length}):`)
    for (const w of warnings.slice(0, 20)) console.warn(`  - ${w}`)
    if (warnings.length > 20) console.warn(`  ... and ${warnings.length - 20} more`)
  }
}

main()
