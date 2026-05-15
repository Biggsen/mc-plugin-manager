import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  Modal,
  NumberInput,
  UnstyledButton,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import styles from './DropTableEditorScreen.module.css'
import {
  CRATE_VIRTUAL_KEY_PRESETS,
  createVirtualKeyPrizeEntry,
  getVirtualKeyPreset,
  getVirtualKeyPrizeValue,
  isVirtualKeyPrize,
  normalizeVirtualKeyPrizeEntry,
  resolveVirtualKeyId,
} from '@shared/crateKeyPresets'
import type {
  CrateLibraryDeleteResult,
  CratePrizeEntry,
  CratePrizeOverride,
  CrateVirtualKeyId,
  VirtualCrateKeyValues,
  EnchantIndexEntry,
  ItemEnchantMeta,
  ItemIndexEntry,
} from '../types'

const DEFAULT_WEIGHT = 50
const WEIGHT_STEP = 5
const DEFAULT_STACK_SIZE = 64
const LIST_ROW_HEIGHT = 34
const LIST_OVERSCAN_ROWS = 12

type PrizeSortColumn = 'value' | 'weight' | 'chance' | 'none'

function normalizeItemId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toUpperCase()
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function prizeAmountDisplay(amount: string): string {
  return amount.trim() || '1'
}

function parseAverageAmount(rawAmount: string | undefined): number | undefined {
  if (rawAmount === undefined) return 1
  const s = String(rawAmount).trim()
  if (!s) return 1
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  const m = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(s)
  if (!m) return undefined
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return undefined
  return (a + b) / 2
}

function getEntryWeight(row: CratePrizeEntry): number {
  const w = row.override?.weight
  return typeof w === 'number' && Number.isFinite(w) ? Math.max(1, Math.round(w)) : DEFAULT_WEIGHT
}

function formatWeightPercent(weight: number, totalWeight: number): string {
  if (totalWeight <= 0) return '—'
  return `${((weight / totalWeight) * 100).toFixed(1)}%`
}

function enchantBookCatalogId(enchantId: string, level: number): string {
  return normalizeItemId(`enchanted_book_${enchantId}_${level}`)
}

function getEnchantBookUnitBuy(
  enchantId: string,
  level: number,
  itemById: Map<string, ItemIndexEntry>
): number | undefined {
  const book = itemById.get(enchantBookCatalogId(enchantId, level))
  if (typeof book?.unitBuy !== 'number' || !Number.isFinite(book.unitBuy)) return undefined
  return book.unitBuy
}

function sumAppliedEnchantmentValue(
  enchantments: Record<string, number> | undefined,
  itemById: Map<string, ItemIndexEntry>,
  amountMultiplier: number
): number {
  if (!enchantments) return 0
  let sum = 0
  for (const [enchantId, level] of Object.entries(enchantments)) {
    const bookBuy = getEnchantBookUnitBuy(enchantId, level, itemById)
    if (bookBuy !== undefined) sum += bookBuy * amountMultiplier
  }
  return sum
}

function formatPrizeListLabel(
  row: CratePrizeEntry,
  amount: string,
  itemById: Map<string, ItemIndexEntry>,
  enchantments?: Record<string, number>
): string {
  if (isVirtualKeyPrize(row)) {
    const keyId = resolveVirtualKeyId(row)
    const preset = keyId ? getVirtualKeyPreset(keyId) : undefined
    const name = preset?.listLabel ?? 'Crate Key'
    const display = prizeAmountDisplay(amount)
    if (display === '1') return name
    return `${display}x ${name}`
  }
  const meta = itemById.get(row.itemId)
  const catalogName = meta?.name ?? row.itemId
  return formatPrizeItemLabel(amount, catalogName, enchantments)
}

function getPrizeValueNumber(
  row: CratePrizeEntry,
  itemById: Map<string, ItemIndexEntry>,
  virtualKeyValues: VirtualCrateKeyValues
): number | undefined {
  const amount = row.override?.amount !== undefined ? row.override.amount : '1'
  const avgAmount = parseAverageAmount(amount)
  if (avgAmount === undefined) return undefined

  if (isVirtualKeyPrize(row)) {
    return getVirtualKeyPrizeValue(row, virtualKeyValues)
  }

  const meta = itemById.get(row.itemId)
  if (isEnchantedBookCatalogId(row.itemId)) {
    if (typeof meta?.unitBuy !== 'number' || !Number.isFinite(meta.unitBuy)) return undefined
    const value = meta.unitBuy * avgAmount
    return Number.isFinite(value) ? value : undefined
  }

  let total = 0
  let hasComponent = false
  if (typeof meta?.unitBuy === 'number' && Number.isFinite(meta.unitBuy)) {
    total += meta.unitBuy * avgAmount
    hasComponent = true
  }
  const enchantValue = sumAppliedEnchantmentValue(row.override?.enchantments, itemById, avgAmount)
  if (enchantValue > 0) {
    total += enchantValue
    hasComponent = true
  }
  if (!hasComponent) return undefined
  return Number.isFinite(total) ? total : undefined
}

function formatPrizeValue(
  row: CratePrizeEntry,
  itemById: Map<string, ItemIndexEntry>,
  virtualKeyValues: VirtualCrateKeyValues
): string | null {
  const value = getPrizeValueNumber(row, itemById, virtualKeyValues)
  if (value === undefined) return null
  return formatMoneyAmount(value)
}

function formatPrizeCategoryLabel(row: CratePrizeEntry, itemById: Map<string, ItemIndexEntry>): string | null {
  if (isVirtualKeyPrize(row)) return 'Keys'
  const cat = itemById.get(row.itemId)?.category?.trim()
  return cat && cat.length > 0 ? cat : null
}

function formatPrizeCopyValueLabel(
  row: CratePrizeEntry,
  itemById: Map<string, ItemIndexEntry>,
  virtualKeyValues: VirtualCrateKeyValues
): string {
  const value = getPrizeValueNumber(row, itemById, virtualKeyValues)
  if (value !== undefined) return `Value: ${formatMoneyAmount(value)}`
  if (isVirtualKeyPrize(row)) return 'Value: Unknown (No items)'
  return 'Value: Unknown'
}

function formatPrizeCopyLine(
  row: CratePrizeEntry,
  itemById: Map<string, ItemIndexEntry>,
  virtualKeyValues: VirtualCrateKeyValues,
  totalWeight: number
): string {
  const amount = row.override?.amount !== undefined ? row.override.amount : '1'
  const label = formatPrizeListLabel(row, amount, itemById, row.override?.enchantments)
  const weight = getEntryWeight(row)
  const chance =
    totalWeight > 0 ? formatWeightPercent(weight, totalWeight) : '0.0%'
  return `${label} - ${formatPrizeCopyValueLabel(row, itemById, virtualKeyValues)} - Weight: ${weight} - Chance: ${chance}`
}

function buildPrizesCopyListText(
  entries: CratePrizeEntry[],
  itemById: Map<string, ItemIndexEntry>,
  virtualKeyValues: VirtualCrateKeyValues
): string {
  const totalWeight = entries.reduce((sum, row) => sum + getEntryWeight(row), 0)
  return entries
    .map((row) => formatPrizeCopyLine(row, itemById, virtualKeyValues, totalWeight))
    .join('\n')
}

function formatMoneyAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function computePrizePoolStats(
  entries: CratePrizeEntry[],
  itemById: Map<string, ItemIndexEntry>,
  virtualKeyValues: VirtualCrateKeyValues
): {
  totalWeight: number
  totalValue: number | null
  averageValueByWeight: number | null
  missingValueCount: number
} {
  let totalWeight = 0
  let totalValue = 0
  let weightedValueSum = 0
  let valuedWeight = 0
  let missingValueCount = 0
  let hasAnyValue = false

  for (const row of entries) {
    const weight = getEntryWeight(row)
    totalWeight += weight
    const value = getPrizeValueNumber(row, itemById, virtualKeyValues)
    if (value === undefined) {
      missingValueCount += 1
      continue
    }
    hasAnyValue = true
    totalValue += value
    weightedValueSum += value * weight
    valuedWeight += weight
  }

  return {
    totalWeight,
    totalValue: hasAnyValue ? totalValue : null,
    averageValueByWeight: valuedWeight > 0 ? weightedValueSum / valuedWeight : null,
    missingValueCount,
  }
}

function emptyKeyValuesDraft(): Record<CrateVirtualKeyId, string> {
  return { heart: '', region: '', village: '', nerve: '' }
}

function keyValuesDraftFromStored(values: VirtualCrateKeyValues): Record<CrateVirtualKeyId, string> {
  const draft = emptyKeyValuesDraft()
  for (const preset of CRATE_VIRTUAL_KEY_PRESETS) {
    const v = values[preset.id]
    if (typeof v === 'number' && Number.isFinite(v)) draft[preset.id] = String(v)
  }
  return draft
}

function catalogStackSize(item: ItemIndexEntry | undefined): number {
  const raw = item?.stack
  if (raw === undefined) return DEFAULT_STACK_SIZE
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STACK_SIZE
}

function materialIdFromItemId(itemId: string): string {
  return itemId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
}

function isEnchantedBookCatalogId(itemId: string): boolean {
  const m = materialIdFromItemId(itemId)
  return m === 'enchanted_book' || m.startsWith('enchanted_book_')
}

function enchantConflictsWithSet(
  enchantId: string,
  selected: Record<string, number>,
  enchantsById: Map<string, EnchantIndexEntry>
): string | null {
  const def = enchantsById.get(enchantId)
  if (!def) return 'Unknown enchantment'
  for (const otherId of Object.keys(selected)) {
    if (otherId === enchantId) continue
    const other = enchantsById.get(otherId)
    if (!other) continue
    if (def.exclude.includes(otherId)) return `Conflicts with ${other.name}`
    if (other.exclude.includes(enchantId)) return `Conflicts with ${other.name}`
  }
  return null
}

function formatEnchantTagLabel(
  enchantId: string,
  level: number,
  enchantsById: Map<string, EnchantIndexEntry>
): string {
  const def = enchantsById.get(enchantId)
  const name = (def?.name ?? enchantId.replace(/_/g, ' ')).toUpperCase()
  return `${name} ${level}`
}

function sortedEnchantmentEntries(
  enchantments: Record<string, number> | undefined
): [string, number][] {
  if (!enchantments) return []
  return Object.entries(enchantments).sort(([a], [b]) => a.localeCompare(b))
}

/** e.g. "64x enchanted diamond sword" when enchants or amount ≠ 1. */
function formatPrizeItemLabel(amount: string, itemName: string, enchantments?: Record<string, number>): string {
  const display = prizeAmountDisplay(amount)
  const hasEnchants = enchantments != null && Object.keys(enchantments).length > 0
  const prefix = hasEnchants ? 'enchanted ' : ''
  if (display === '1') return `${prefix}${itemName}`
  return `${display}x ${prefix}${itemName}`
}

function sanitizeOutputStem(raw: string): string {
  const s = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
  return s.length > 0 ? s : 'Crate'
}

interface CrateEditorScreenProps {
  crateId?: string
  onBack: () => void
  onSaved: (crateId: string) => void
}

export function CrateEditorScreen({ crateId, onBack, onSaved }: CrateEditorScreenProps) {
  const [itemsIndex, setItemsIndex] = useState<ItemIndexEntry[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [minPriceFilter, setMinPriceFilter] = useState<number | string>('')
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | string>('')
  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [outputStemDraft, setOutputStemDraft] = useState('')
  const [accentDraft, setAccentDraft] = useState('gray')
  const [slotDraft, setSlotDraft] = useState<number | string>(13)
  const [guiItemDraft, setGuiItemDraft] = useState('chest')
  const [lore1Draft, setLore1Draft] = useState('<gray>A reward crate.')
  const [lore2Draft, setLore2Draft] = useState('<gray>Open to see what you find.')
  const [animationDraft, setAnimationDraft] = useState('Opening...')
  const [selectedEntriesDraft, setSelectedEntriesDraft] = useState<CratePrizeEntry[]>([])

  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsModalError, setSettingsModalError] = useState<string | null>(null)
  const [modalOutputStem, setModalOutputStem] = useState('')
  const [modalAccent, setModalAccent] = useState('gray')
  const [modalSlot, setModalSlot] = useState<number | string>(13)
  const [modalGuiItem, setModalGuiItem] = useState('chest')
  const [modalLore1, setModalLore1] = useState('')
  const [modalLore2, setModalLore2] = useState('')
  const [modalAnimation, setModalAnimation] = useState('Opening...')

  const [enchantCatalog, setEnchantCatalog] = useState<EnchantIndexEntry[]>([])
  const [enchantItemsByMaterial, setEnchantItemsByMaterial] = useState<Record<string, ItemEnchantMeta>>({})

  const [prizeModalOpen, setPrizeModalOpen] = useState(false)
  const [prizeModalEntryId, setPrizeModalEntryId] = useState<string | null>(null)
  const [prizeModalAmountDraft, setPrizeModalAmountDraft] = useState('1')
  const [prizeModalEnchantsDraft, setPrizeModalEnchantsDraft] = useState<Record<string, number>>({})
  const [prizeModalError, setPrizeModalError] = useState<string | null>(null)
  const [virtualKeyValues, setVirtualKeyValues] = useState<VirtualCrateKeyValues>({})
  const [keyValuesModalOpen, setKeyValuesModalOpen] = useState(false)
  const [keyValuesDraft, setKeyValuesDraft] = useState<Record<CrateVirtualKeyId, string>>(emptyKeyValuesDraft)
  const [keyValuesModalError, setKeyValuesModalError] = useState<string | null>(null)
  const [keyValuesSaving, setKeyValuesSaving] = useState(false)
  const [copyListError, setCopyListError] = useState<string | null>(null)
  const [deletePrizeEntryId, setDeletePrizeEntryId] = useState<string | null>(null)
  const [editingWeightEntryId, setEditingWeightEntryId] = useState<string | null>(null)
  const [editingWeightDraft, setEditingWeightDraft] = useState('')

  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [listScrollTop, setListScrollTop] = useState(0)
  const [listViewportHeight, setListViewportHeight] = useState(420)
  const [prizeSortColumn, setPrizeSortColumn] = useState<PrizeSortColumn>('none')
  const [prizeSortDirection, setPrizeSortDirection] = useState<'asc' | 'desc'>('asc')
  const [keysSectionOpen, setKeysSectionOpen] = useState(true)

  const crateIdRef = useRef<string | undefined>(crateId)
  const listViewportRef = useRef<HTMLDivElement | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedSnapshotRef = useRef<string>('')
  const isHydratingRef = useRef(true)

  const itemById = useMemo(() => {
    const m = new Map<string, ItemIndexEntry>()
    for (const it of itemsIndex) m.set(it.id, it)
    return m
  }, [itemsIndex])

  const enchantsById = useMemo(() => {
    const m = new Map<string, EnchantIndexEntry>()
    for (const e of enchantCatalog) m.set(e.id, e)
    return m
  }, [enchantCatalog])

  const prizeModalRow = useMemo(
    () => selectedEntriesDraft.find((r) => r.entryId === prizeModalEntryId) ?? null,
    [selectedEntriesDraft, prizeModalEntryId]
  )

  const deletePrizeRow = useMemo(
    () => selectedEntriesDraft.find((r) => r.entryId === deletePrizeEntryId) ?? null,
    [selectedEntriesDraft, deletePrizeEntryId]
  )

  const prizeModalMaterialId = prizeModalRow ? materialIdFromItemId(prizeModalRow.itemId) : ''

  const prizeModalCanEnchant = useMemo(() => {
    if (!prizeModalRow) return false
    if (isVirtualKeyPrize(prizeModalRow)) return false
    if (isEnchantedBookCatalogId(prizeModalRow.itemId)) return false
    return Boolean(enchantItemsByMaterial[prizeModalMaterialId])
  }, [prizeModalRow, prizeModalMaterialId, enchantItemsByMaterial])

  const prizeModalIsVirtualKey = prizeModalRow != null && isVirtualKeyPrize(prizeModalRow)

  const compatibleEnchants = useMemo(() => {
    if (!prizeModalCanEnchant || !prizeModalMaterialId) return []
    const meta = enchantItemsByMaterial[prizeModalMaterialId]
    if (!meta) return []
    return enchantCatalog
      .filter((e) => meta.categories.includes(e.category))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [prizeModalCanEnchant, prizeModalMaterialId, enchantItemsByMaterial, enchantCatalog])

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>()
    for (const it of itemsIndex) {
      if (it.category?.trim()) categories.add(it.category.trim())
    }
    return [...categories].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c }))
  }, [itemsIndex])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    const minP = minPriceFilter === '' ? undefined : Number(minPriceFilter)
    const maxP = maxPriceFilter === '' ? undefined : Number(maxPriceFilter)
    let rows = itemsIndex
    if (categoryFilter) {
      rows = rows.filter((it) => (it.category ?? '').trim() === categoryFilter)
    }
    if (q) {
      rows = rows.filter(
        (it) => it.name.toLowerCase().includes(q) || it.id.toLowerCase().includes(q) || it.rawKey.toLowerCase().includes(q)
      )
    }
    if (minP !== undefined && Number.isFinite(minP)) {
      rows = rows.filter((it) => typeof it.unitBuy === 'number' && it.unitBuy >= minP)
    }
    if (maxP !== undefined && Number.isFinite(maxP)) {
      rows = rows.filter((it) => typeof it.unitBuy === 'number' && it.unitBuy <= maxP)
    }
    return [...rows].sort((a, b) => a.name.localeCompare(b.name))
  }, [itemsIndex, categoryFilter, search, minPriceFilter, maxPriceFilter])

  const virtualRange = useMemo(() => {
    const start = Math.max(0, Math.floor(listScrollTop / LIST_ROW_HEIGHT) - LIST_OVERSCAN_ROWS)
    const visibleCount = Math.ceil(listViewportHeight / LIST_ROW_HEIGHT) + LIST_OVERSCAN_ROWS * 2
    const end = Math.min(searchResults.length, start + visibleCount)
    return { start, end }
  }, [listScrollTop, listViewportHeight, searchResults.length])

  const virtualItems = useMemo(
    () => searchResults.slice(virtualRange.start, virtualRange.end),
    [searchResults, virtualRange.start, virtualRange.end]
  )

  const selectedIds = useMemo(() => new Set(selectedEntriesDraft.map((e) => e.itemId)), [selectedEntriesDraft])

  const addedVirtualKeyIds = useMemo(() => {
    const ids = new Set<CrateVirtualKeyId>()
    for (const row of selectedEntriesDraft) {
      const keyId = resolveVirtualKeyId(row)
      if (keyId) ids.add(keyId)
    }
    return ids
  }, [selectedEntriesDraft])

  const totalPrizeWeight = useMemo(
    () => selectedEntriesDraft.reduce((sum, row) => sum + getEntryWeight(row), 0),
    [selectedEntriesDraft]
  )

  const prizePoolStats = useMemo(
    () => computePrizePoolStats(selectedEntriesDraft, itemById, virtualKeyValues),
    [selectedEntriesDraft, itemById, virtualKeyValues]
  )

  const sortedSelectedEntries = useMemo(() => {
    if (prizeSortColumn === 'none') return selectedEntriesDraft
    const next = [...selectedEntriesDraft]
    next.sort((a, b) => {
      let base = 0
      if (prizeSortColumn === 'value') {
        const av = getPrizeValueNumber(a, itemById, virtualKeyValues) ?? -1
        const bv = getPrizeValueNumber(b, itemById, virtualKeyValues) ?? -1
        base = av - bv
      } else if (prizeSortColumn === 'weight') {
        base = getEntryWeight(a) - getEntryWeight(b)
      } else if (prizeSortColumn === 'chance') {
        const total = totalPrizeWeight
        const ap = total > 0 ? getEntryWeight(a) / total : 0
        const bp = total > 0 ? getEntryWeight(b) / total : 0
        base = ap - bp
      }
      return prizeSortDirection === 'asc' ? base : -base
    })
    return next
  }, [selectedEntriesDraft, prizeSortColumn, prizeSortDirection, totalPrizeWeight, itemById, virtualKeyValues])

  function togglePrizeSort(column: PrizeSortColumn) {
    if (column === 'none') {
      setPrizeSortColumn('none')
      return
    }
    if (prizeSortColumn === column) {
      setPrizeSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setPrizeSortColumn(column)
      setPrizeSortDirection('asc')
    }
  }

  function prizeSortButtonLabel(column: Exclude<PrizeSortColumn, 'none'>): string {
    const labels: Record<Exclude<PrizeSortColumn, 'none'>, string> = {
      value: 'Value',
      weight: 'Weight',
      chance: 'Chance',
    }
    if (prizeSortColumn !== column) return labels[column]
    return `${labels[column]} ${prizeSortDirection === 'asc' ? '↑' : '↓'}`
  }

  function buildSavePayload() {
    const slotNum = typeof slotDraft === 'number' ? slotDraft : Number(slotDraft)
    const outputStem = outputStemDraft.trim() || sanitizeOutputStem(nameDraft)
    return {
      name: nameDraft,
      description: descDraft,
      outputStem,
      accentTag: accentDraft,
      crateSlot: Number.isFinite(slotNum) ? slotNum : 13,
      guiItem: guiItemDraft,
      loreLine1: lore1Draft,
      loreLine2: lore2Draft,
      animationTitle: animationDraft,
      selectedPrizeEntries: selectedEntriesDraft,
    }
  }

  function snapshotPayload(payload: ReturnType<typeof buildSavePayload>): string {
    return JSON.stringify(payload)
  }

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [idx, enchantData, keyValues] = await Promise.all([
        window.electronAPI.scanItemIndex(),
        window.electronAPI.scanEnchantData(),
        window.electronAPI.getVirtualCrateKeyValues(),
      ])
      setItemsIndex(idx.items)
      setEnchantCatalog(enchantData.enchants)
      setEnchantItemsByMaterial(enchantData.items)
      setVirtualKeyValues(keyValues)

      if (crateId) {
        const lib = await window.electronAPI.listCrateLibrary()
        const row = lib.find((c) => c.id === crateId)
        if (!row) {
          setLoadError('Crate not found')
          return
        }
        setNameDraft(row.name)
        setDescDraft(row.description ?? '')
        setOutputStemDraft(row.outputStem)
        setAccentDraft(row.accentTag ?? 'gray')
        setSlotDraft(row.crateSlot ?? 13)
        setGuiItemDraft(row.guiItem ?? 'chest')
        setLore1Draft(row.loreLine1 ?? '<gray>A reward crate.')
        setLore2Draft(row.loreLine2 ?? '<gray>Open to see what you find.')
        setAnimationDraft(row.animationTitle ?? 'Opening...')
        const loadedPrizes = (row.selectedPrizeEntries ?? []).map((e) => normalizeVirtualKeyPrizeEntry(e))
        setSelectedEntriesDraft(loadedPrizes)
        lastSavedSnapshotRef.current = snapshotPayload({
          name: row.name,
          description: row.description ?? '',
          outputStem: row.outputStem,
          accentTag: row.accentTag ?? 'gray',
          crateSlot: row.crateSlot ?? 13,
          guiItem: row.guiItem ?? 'chest',
          loreLine1: row.loreLine1 ?? '',
          loreLine2: row.loreLine2 ?? '',
          animationTitle: row.animationTitle ?? '',
          selectedPrizeEntries: loadedPrizes,
        })
      } else {
        lastSavedSnapshotRef.current = snapshotPayload(buildSavePayload())
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      isHydratingRef.current = false
    }
  }, [crateId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const viewportEl = listViewportRef.current
    if (!viewportEl) return
    const update = () => setListViewportHeight(viewportEl.clientHeight || 420)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(viewportEl)
    return () => ro.disconnect()
  }, [])

  function addItem(rawId: string) {
    const id = normalizeItemId(rawId)
    if (!id || !itemById.has(id)) return
    setSelectedEntriesDraft((prev) => [
      ...prev,
      {
        entryId: `${id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        itemId: id,
      },
    ])
  }

  function addRandomItem() {
    if (searchResults.length === 0) {
      setLoadError('No items match the current filter')
      return
    }
    const pick = searchResults[Math.floor(Math.random() * searchResults.length)]
    addItem(pick.id)
  }

  function addAllItems() {
    for (const it of searchResults) addItem(it.id)
  }

  function addKeyPrize(keyId: CrateVirtualKeyId) {
    setSelectedEntriesDraft((prev) => [...prev, createVirtualKeyPrizeEntry(keyId)])
  }

  function removeEntry(entryId: string) {
    setSelectedEntriesDraft((prev) => prev.filter((x) => x.entryId !== entryId))
  }

  function openDeletePrizeConfirm(entryId: string) {
    setDeletePrizeEntryId(entryId)
  }

  function confirmRemovePrize() {
    if (!deletePrizeEntryId) return
    if (prizeModalEntryId === deletePrizeEntryId) {
      setPrizeModalOpen(false)
      setPrizeModalEntryId(null)
    }
    removeEntry(deletePrizeEntryId)
    setDeletePrizeEntryId(null)
  }

  function setEntryPrizeOverride(
    entryId: string,
    patch: {
      amount?: string
      enchantments?: Record<string, number> | null
    }
  ) {
    setSelectedEntriesDraft((prev) =>
      prev.map((row) => {
        if (row.entryId !== entryId) return row
        const nextOverride: CratePrizeOverride = { ...(row.override ?? {}) }
        if (patch.amount !== undefined) nextOverride.amount = patch.amount
        if (patch.enchantments === null) {
          delete nextOverride.enchantments
        } else if (patch.enchantments !== undefined) {
          if (Object.keys(patch.enchantments).length > 0) {
            nextOverride.enchantments = patch.enchantments
          } else {
            delete nextOverride.enchantments
          }
        }
        const hasOverride =
          nextOverride.weight !== undefined ||
          nextOverride.amount !== undefined ||
          nextOverride.displayName !== undefined ||
          (nextOverride.enchantments && Object.keys(nextOverride.enchantments).length > 0)
        return { ...row, override: hasOverride ? nextOverride : undefined }
      })
    )
  }

  function setEntryWeight(entryId: string, weight: number) {
    const next = clamp(Math.round(weight), 1, 10_000)
    setSelectedEntriesDraft((prev) =>
      prev.map((row) => {
        if (row.entryId !== entryId) return row
        return { ...row, override: { ...(row.override ?? {}), weight: next } }
      })
    )
  }

  function nudgeWeight(entryId: string, delta: number) {
    const row = selectedEntriesDraft.find((r) => r.entryId === entryId)
    const base = row ? getEntryWeight(row) : DEFAULT_WEIGHT
    setEntryWeight(entryId, base + delta)
  }

  function startEditWeight(entryId: string, current: number) {
    setEditingWeightEntryId(entryId)
    setEditingWeightDraft(String(current))
  }

  function cancelWeightEdit() {
    setEditingWeightEntryId(null)
    setEditingWeightDraft('')
  }

  function commitWeightEdit(entryId: string) {
    const trimmed = editingWeightDraft.trim()
    const parsed = Number(trimmed)
    if (!trimmed || !Number.isFinite(parsed) || parsed < 1) {
      cancelWeightEdit()
      return
    }
    setEntryWeight(entryId, parsed)
    cancelWeightEdit()
  }

  async function handleSave(options?: { closeAfterSave?: boolean }) {
    const closeAfterSave = options?.closeAfterSave === true
    const payload = buildSavePayload()
    if (!payload.name.trim()) {
      setLoadError('Crate name is required')
      return
    }
    if (!payload.outputStem.trim()) {
      setLoadError('Output stem is required')
      return
    }
    setIsSaving(true)
    setLoadError(null)
    try {
      const baseId = crateIdRef.current
      if (baseId) {
        await window.electronAPI.updateCrateLibraryEntry({ id: baseId, ...payload })
        lastSavedSnapshotRef.current = snapshotPayload(payload)
        if (closeAfterSave) onSaved(baseId)
      } else {
        const created = await window.electronAPI.createCrateLibraryEntry({
          name: payload.name,
          description: payload.description,
          outputStem: payload.outputStem,
        })
        await window.electronAPI.updateCrateLibraryEntry({ id: created.id, ...payload })
        crateIdRef.current = created.id
        lastSavedSnapshotRef.current = snapshotPayload(payload)
        if (closeAfterSave) onSaved(created.id)
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (isHydratingRef.current) return
    const payload = buildSavePayload()
    const snapshot = snapshotPayload(payload)
    if (snapshot === lastSavedSnapshotRef.current) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      void handleSave()
    }, 500)
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [
    nameDraft,
    descDraft,
    outputStemDraft,
    accentDraft,
    slotDraft,
    guiItemDraft,
    lore1Draft,
    lore2Draft,
    animationDraft,
    selectedEntriesDraft,
  ])

  function openSettingsModal() {
    setSettingsModalError(null)
    setModalOutputStem(outputStemDraft)
    setModalAccent(accentDraft)
    setModalSlot(slotDraft)
    setModalGuiItem(guiItemDraft)
    setModalLore1(lore1Draft)
    setModalLore2(lore2Draft)
    setModalAnimation(animationDraft)
    setSettingsModalOpen(true)
  }

  function openPrizeModal(entryId: string) {
    const row = selectedEntriesDraft.find((r) => r.entryId === entryId)
    if (!row) return
    setPrizeModalEntryId(entryId)
    setPrizeModalAmountDraft(row.override?.amount !== undefined ? row.override.amount : '1')
    setPrizeModalEnchantsDraft(
      row.override?.enchantments ? { ...row.override.enchantments } : {}
    )
    setPrizeModalError(null)
    setPrizeModalOpen(true)
  }

  function openKeyValuesModal() {
    setKeyValuesDraft(keyValuesDraftFromStored(virtualKeyValues))
    setKeyValuesModalError(null)
    setKeyValuesModalOpen(true)
  }

  async function copyPrizesList() {
    setCopyListError(null)
    if (sortedSelectedEntries.length === 0) return
    const text = buildPrizesCopyListText(sortedSelectedEntries, itemById, virtualKeyValues)
    try {
      await navigator.clipboard.writeText(text)
    } catch (e: unknown) {
      setCopyListError(e instanceof Error ? e.message : String(e))
    }
  }

  async function applyKeyValuesModal() {
    setKeyValuesModalError(null)
    const parsed: VirtualCrateKeyValues = {}
    for (const preset of CRATE_VIRTUAL_KEY_PRESETS) {
      const trimmed = keyValuesDraft[preset.id].trim()
      if (!trimmed) continue
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 0) {
        setKeyValuesModalError(`${preset.listLabel}: enter a number ≥ 0, or leave blank`)
        return
      }
      parsed[preset.id] = n
    }
    setKeyValuesSaving(true)
    try {
      const saved = await window.electronAPI.setVirtualCrateKeyValues(parsed)
      setVirtualKeyValues(saved)
      setKeyValuesModalOpen(false)
    } catch (e: unknown) {
      setKeyValuesModalError(e instanceof Error ? e.message : String(e))
    } finally {
      setKeyValuesSaving(false)
    }
  }

  function applyPrizeModal() {
    if (!prizeModalEntryId) return
    const row = selectedEntriesDraft.find((r) => r.entryId === prizeModalEntryId)
    setPrizeModalError(null)
    const trimmed = prizeModalAmountDraft.trim()
    if (!trimmed) {
      setPrizeModalError('Amount is required')
      return
    }
    if (row && isVirtualKeyPrize(row)) {
      if (!/^\d+$/.test(trimmed)) {
        setPrizeModalError('Virtual keys use a whole number amount (keys granted per win)')
        return
      }
      setEntryPrizeOverride(prizeModalEntryId, { amount: trimmed, enchantments: null })
      setPrizeModalOpen(false)
      setPrizeModalEntryId(null)
      return
    }
    const enchantments = { ...prizeModalEnchantsDraft }
    for (const id of Object.keys(enchantments)) {
      const conflict = enchantConflictsWithSet(id, enchantments, enchantsById)
      if (conflict) {
        setPrizeModalError(conflict)
        return
      }
    }
    setEntryPrizeOverride(prizeModalEntryId, {
      amount: trimmed,
      enchantments: Object.keys(enchantments).length > 0 ? enchantments : null,
    })
    setPrizeModalOpen(false)
    setPrizeModalEntryId(null)
  }

  function setPrizeModalToStack() {
    if (!prizeModalRow) return
    const stack = catalogStackSize(itemById.get(prizeModalRow.itemId))
    setPrizeModalAmountDraft(String(stack))
    setPrizeModalError(null)
  }

  function selectEnchantLevelInModal(enchantId: string, level: number) {
    const def = enchantsById.get(enchantId)
    if (!def) return
    const clamped = clamp(Math.round(level), 1, def.maxLevel)
    if (prizeModalEnchantsDraft[enchantId] === clamped) {
      setPrizeModalEnchantsDraft((prev) => {
        const next = { ...prev }
        delete next[enchantId]
        return next
      })
      setPrizeModalError(null)
      return
    }
    const next = { ...prizeModalEnchantsDraft, [enchantId]: clamped }
    const conflict = enchantConflictsWithSet(enchantId, next, enchantsById)
    if (conflict) {
      setPrizeModalError(conflict)
      return
    }
    setPrizeModalError(null)
    setPrizeModalEnchantsDraft(next)
  }

  function isEnchantLevelDisabled(enchantId: string, level: number): boolean {
    if (prizeModalEnchantsDraft[enchantId] === level) return false
    const next = { ...prizeModalEnchantsDraft, [enchantId]: level }
    return enchantConflictsWithSet(enchantId, next, enchantsById) != null
  }

  function applySettingsModal() {
    setSettingsModalError(null)
    const stem = modalOutputStem.trim()
    if (!stem) {
      setSettingsModalError('Output stem is required')
      return
    }
    const slotNum = typeof modalSlot === 'number' ? modalSlot : Number(modalSlot)
    if (!Number.isFinite(slotNum)) {
      setSettingsModalError('GUI slot must be a number')
      return
    }
    setOutputStemDraft(stem)
    setAccentDraft(modalAccent.trim() || 'gray')
    setSlotDraft(slotNum)
    setGuiItemDraft(modalGuiItem.trim() || 'chest')
    setLore1Draft(modalLore1)
    setLore2Draft(modalLore2)
    setAnimationDraft(modalAnimation.trim() || 'Opening...')
    setSettingsModalOpen(false)
  }

  async function handleDelete() {
    const id = crateIdRef.current
    if (!id) return
    setIsDeleting(true)
    try {
      const res: CrateLibraryDeleteResult = await window.electronAPI.deleteCrateLibraryEntry(id)
      if (!res.ok) {
        setLoadError(res.error ?? 'Failed to delete crate')
        return
      }
      onBack()
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Button variant="default" onClick={onBack}>
          Back to library
        </Button>
        <Group>
          {crateIdRef.current && (
            <Button
              color="red"
              variant="light"
              leftSection={<IconTrash size={16} />}
              loading={isDeleting}
              onClick={() => void handleDelete()}
            >
              Delete crate
            </Button>
          )}
          <Button variant="default" onClick={() => void handleSave()} loading={isSaving}>
            Save
          </Button>
          <Button onClick={() => void handleSave({ closeAfterSave: true })} loading={isSaving}>
            Save and close
          </Button>
        </Group>
      </Group>

      {loadError && (
        <Alert color="red" title="Error">
          {loadError}
        </Alert>
      )}

      <Group grow align="flex-start" wrap="wrap">
        <TextInput
          label="Crate name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.currentTarget.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <Textarea
          label="Description"
          value={descDraft}
          onChange={(e) => setDescDraft(e.currentTarget.value)}
          minRows={2}
          style={{ flex: 2, minWidth: 280 }}
        />
      </Group>
      <Group gap={6}>
        <Anchor component="button" type="button" size="sm" onClick={openSettingsModal}>
          Crate settings
        </Anchor>
        <Text size="sm" c="dimmed">
          {outputStemDraft.trim() || sanitizeOutputStem(nameDraft)}.yml · slot{' '}
          {typeof slotDraft === 'number' ? slotDraft : slotDraft} · accent {accentDraft}
        </Text>
      </Group>

      <Modal
        opened={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="Crate settings"
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            These options control how the crate appears in-game and where the YAML file is written.
          </Text>
          <TextInput
            label="Output stem (filename without .yml)"
            description="Written as CrazyCrates/crates/&lt;stem&gt;.yml"
            value={modalOutputStem}
            onChange={(e) => setModalOutputStem(e.currentTarget.value)}
          />
          <TextInput
            label="Accent colour (MiniMessage, no brackets)"
            description="e.g. dark_purple, red, yellow"
            value={modalAccent}
            onChange={(e) => setModalAccent(e.currentTarget.value)}
          />
          <NumberInput label="/crates GUI slot" min={0} max={53} value={modalSlot} onChange={setModalSlot} />
          <TextInput label="GUI item material" value={modalGuiItem} onChange={(e) => setModalGuiItem(e.currentTarget.value)} />
          <TextInput label="Animation title" value={modalAnimation} onChange={(e) => setModalAnimation(e.currentTarget.value)} />
          <TextInput label="Lore line 1" value={modalLore1} onChange={(e) => setModalLore1(e.currentTarget.value)} />
          <TextInput label="Lore line 2" value={modalLore2} onChange={(e) => setModalLore2(e.currentTarget.value)} />
          {settingsModalError && (
            <Text size="sm" c="red">
              {settingsModalError}
            </Text>
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setSettingsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applySettingsModal}>Save settings</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={prizeModalOpen}
        onClose={() => setPrizeModalOpen(false)}
        title="Edit prize"
        size="md"
        styles={{
          body: { maxHeight: 'none', overflow: 'visible' },
          content: { overflow: 'visible' },
        }}
      >
        <Stack gap="sm">
          {prizeModalRow && (
            <Text size="sm" c="dimmed">
              {formatPrizeListLabel(prizeModalRow, prizeModalAmountDraft, itemById, prizeModalEnchantsDraft)}
            </Text>
          )}
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Amount
            </Text>
            <Text size="xs" c="dimmed">
              {prizeModalIsVirtualKey
                ? 'Whole number — virtual keys granted per win (cc give virtual …)'
                : 'Use a number (e.g. 64) or range (e.g. 3-6)'}
            </Text>
            <Group gap="sm" align="center" wrap="nowrap">
              <TextInput
                w={96}
                value={prizeModalAmountDraft}
                onChange={(e) => setPrizeModalAmountDraft(e.currentTarget.value)}
              />
              {!prizeModalIsVirtualKey && (
                <Anchor size="sm" onClick={setPrizeModalToStack}>
                  Set as stack
                </Anchor>
              )}
            </Group>
          </Stack>

          {prizeModalIsVirtualKey && (
            <Text size="xs" c="dimmed">
              Virtual crate key — reward is granted via command, not an inventory item stack. Set dollar
              values under Keys → Set values (shared across all crates).
            </Text>
          )}

          {prizeModalRow && isEnchantedBookCatalogId(prizeModalRow.itemId) && (
            <Text size="xs" c="dimmed">
              Enchantments are defined by this enchanted book item — edit amount only.
            </Text>
          )}

          {prizeModalRow && !isEnchantedBookCatalogId(prizeModalRow.itemId) && !prizeModalCanEnchant && (
            <Text size="xs" c="dimmed">
              This item cannot receive enchantments.
            </Text>
          )}

          {prizeModalCanEnchant && (
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                Enchantments
              </Text>
              <Text size="xs" c="dimmed">
                Choose a level to apply; tap the same level again to remove.
              </Text>
              {compatibleEnchants.length === 0 ? (
                <Text size="xs" c="dimmed">
                  No compatible enchantments for this item.
                </Text>
              ) : (
                <Stack gap={2}>
                  {compatibleEnchants.map((e) => {
                    const selectedLevel = prizeModalEnchantsDraft[e.id]
                    return (
                      <Group key={e.id} gap="sm" wrap="nowrap" justify="space-between" align="center">
                        <Text size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                          {e.name}
                        </Text>
                        <Group gap={4} wrap="nowrap" justify="flex-end" style={{ flexShrink: 0 }}>
                          {Array.from({ length: e.maxLevel }, (_, i) => i + 1).map((lvl) => {
                            const selected = selectedLevel === lvl
                            const disabled = isEnchantLevelDisabled(e.id, lvl)
                            return (
                              <Button
                                key={lvl}
                                size="compact-xs"
                                variant={selected ? 'filled' : 'default'}
                                px={6}
                                miw={24}
                                disabled={disabled}
                                aria-label={`${e.name} level ${lvl}`}
                                aria-pressed={selected}
                                onClick={() => selectEnchantLevelInModal(e.id, lvl)}
                              >
                                {lvl}
                              </Button>
                            )
                          })}
                        </Group>
                      </Group>
                    )
                  })}
                </Stack>
              )}
            </Stack>
          )}

          {prizeModalError && (
            <Text size="sm" c="red">
              {prizeModalError}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPrizeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyPrizeModal}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        title="Remove prize"
        opened={deletePrizeEntryId !== null}
        onClose={() => setDeletePrizeEntryId(null)}
      >
        {deletePrizeRow && (
          <Stack gap="md">
            <Text size="sm">
              Remove{' '}
              <Text span fw={600}>
                {formatPrizeListLabel(
                  deletePrizeRow,
                  deletePrizeRow.override?.amount ?? '1',
                  itemById,
                  deletePrizeRow.override?.enchantments
                )}
              </Text>{' '}
              from this crate?
            </Text>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => setDeletePrizeEntryId(null)}>
                Cancel
              </Button>
              <Button color="red" leftSection={<IconTrash size={16} />} onClick={confirmRemovePrize}>
                Remove
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        title="Virtual key values"
        opened={keyValuesModalOpen}
        onClose={() => !keyValuesSaving && setKeyValuesModalOpen(false)}
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Editor-only dollar values per key type. Used for prize Value, sorting, and pool totals on every crate.
            Row value = unit value × keys granted (amount).
          </Text>
          {CRATE_VIRTUAL_KEY_PRESETS.map((preset) => (
            <NumberInput
              key={preset.id}
              label={preset.listLabel}
              min={0}
              decimalScale={2}
              allowNegative={false}
              value={keyValuesDraft[preset.id] === '' ? '' : Number(keyValuesDraft[preset.id])}
              onChange={(v) =>
                setKeyValuesDraft((prev) => ({
                  ...prev,
                  [preset.id]: v === '' || v === undefined ? '' : String(v),
                }))
              }
            />
          ))}
          {keyValuesModalError && (
            <Text size="sm" c="red">
              {keyValuesModalError}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setKeyValuesModalOpen(false)} disabled={keyValuesSaving}>
              Cancel
            </Button>
            <Button onClick={applyKeyValuesModal} loading={keyValuesSaving}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
          gap: 16,
          height: 'calc(100vh - 280px)',
          minHeight: 400,
          width: '100%',
        }}
      >
        <Paper withBorder p="sm" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Text fw={600} size="sm" mb="xs">
            Add items
          </Text>
          <Group mb="xs">
            <Select
              data={categoryOptions}
              value={categoryFilter}
              onChange={setCategoryFilter}
              clearable
              searchable
              label="Category"
              placeholder="All"
              style={{ flex: 1 }}
            />
            <NumberInput label="Min $" value={minPriceFilter} onChange={setMinPriceFilter} min={0} w={90} />
            <NumberInput label="Max $" value={maxPriceFilter} onChange={setMaxPriceFilter} min={0} w={90} />
          </Group>
          <Group mb="xs" gap="xs">
            <Button variant="light" onClick={addRandomItem}>
              Random item
            </Button>
            <Button variant="light" onClick={addAllItems}>
              Add all
            </Button>
          </Group>
          <Group justify="space-between" align="center" mb="xs" wrap="nowrap">
            <UnstyledButton type="button" onClick={() => setKeysSectionOpen((open) => !open)}>
              <Text size="sm" fw={600}>
                Keys {keysSectionOpen ? '▾' : '▸'}
              </Text>
            </UnstyledButton>
            <Anchor size="sm" onClick={openKeyValuesModal}>
              Set values
            </Anchor>
          </Group>
          <Collapse in={keysSectionOpen}>
            <Group gap="xs" mb="xs">
              {CRATE_VIRTUAL_KEY_PRESETS.map((preset) => {
                const added = addedVirtualKeyIds.has(preset.id)
                return (
                  <Button
                    key={preset.id}
                    variant={added ? 'filled' : 'light'}
                    size="compact-sm"
                    onClick={() => addKeyPrize(preset.id)}
                    aria-pressed={added}
                  >
                    {preset.buttonLabel}
                  </Button>
                )
              })}
            </Group>
          </Collapse>
          <TextInput
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            mb="xs"
          />
          <ScrollArea
            style={{ flex: 1, minHeight: 0 }}
            offsetScrollbars
            viewportRef={listViewportRef}
            onScrollPositionChange={({ y }) => setListScrollTop(y)}
          >
            <Box style={{ position: 'relative', height: searchResults.length * LIST_ROW_HEIGHT }}>
              {virtualItems.map((it, localIdx) => {
                const idx = virtualRange.start + localIdx
                const selected = selectedIds.has(it.id)
                const rowClass = `${styles.row} ${selected ? styles.rowSelected : styles.rowUnselected} ${
                  !selected && idx % 2 === 1 ? styles.rowOdd : ''
                }`
                return (
                  <UnstyledButton
                    key={it.id}
                    onClick={() => addItem(it.id)}
                    className={rowClass}
                    style={{ top: idx * LIST_ROW_HEIGHT, height: LIST_ROW_HEIGHT }}
                  >
                    <Group justify="space-between" wrap="nowrap" px={4} h="100%">
                      <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
                        {it.name}
                      </Text>
                      <Text size="xs" c="dimmed" w={70}>
                        {typeof it.unitBuy === 'number' ? `$${it.unitBuy}` : '-'}
                      </Text>
                    </Group>
                  </UnstyledButton>
                )
              })}
            </Box>
          </ScrollArea>
        </Paper>

        <Paper withBorder p="sm" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs" mb="xs">
            <Text fw={600} size="sm">
              Prizes ({selectedEntriesDraft.length})
            </Text>
            {selectedEntriesDraft.length > 0 && (
              <Group gap="md" wrap="wrap" justify="flex-end">
                <Text size="sm" c="dimmed">
                  Total weight:{' '}
                  <Text span fw={600} c="inherit">
                    {prizePoolStats.totalWeight}
                  </Text>
                </Text>
                <Text size="sm" c="dimmed">
                  Total value:{' '}
                  <Text span fw={600} c="grape.4">
                    {prizePoolStats.totalValue != null
                      ? `$${formatMoneyAmount(prizePoolStats.totalValue)}`
                      : '—'}
                  </Text>
                </Text>
                <Text size="sm" c="dimmed">
                  Avg value (by weight):{' '}
                  <Text span fw={600} c="grape.4">
                    {prizePoolStats.averageValueByWeight != null
                      ? `$${formatMoneyAmount(prizePoolStats.averageValueByWeight)}`
                      : '—'}
                  </Text>
                </Text>
                {prizePoolStats.missingValueCount > 0 && (
                  <Text size="xs" c="dimmed">
                    {prizePoolStats.missingValueCount} without catalog value
                  </Text>
                )}
              </Group>
            )}
          </Group>
          <Text size="xs" c="dimmed" mb="xs">
            Add items from the catalog or virtual keys under Keys. Use weight and edit prize per row; defaults apply at
            build time.
          </Text>
          {copyListError && (
            <Text size="xs" c="red" mb="xs">
              {copyListError}
            </Text>
          )}
          <Group gap="xs" mb="sm" wrap="wrap" align="center">
            <Text size="sm" c="dimmed">
              Sort by:
            </Text>
            <Button.Group>
              <Button
                size="compact-sm"
                variant={prizeSortColumn === 'value' ? 'filled' : 'default'}
                onClick={() => togglePrizeSort('value')}
              >
                {prizeSortButtonLabel('value')}
              </Button>
              <Button
                size="compact-sm"
                variant={prizeSortColumn === 'weight' ? 'filled' : 'default'}
                onClick={() => togglePrizeSort('weight')}
              >
                {prizeSortButtonLabel('weight')}
              </Button>
              <Button
                size="compact-sm"
                variant={prizeSortColumn === 'chance' ? 'filled' : 'default'}
                onClick={() => togglePrizeSort('chance')}
              >
                {prizeSortButtonLabel('chance')}
              </Button>
              <Button
                size="compact-sm"
                variant={prizeSortColumn === 'none' ? 'filled' : 'default'}
                onClick={() => togglePrizeSort('none')}
              >
                None
              </Button>
            </Button.Group>
            <Button
              size="compact-sm"
              variant="default"
              disabled={selectedEntriesDraft.length === 0}
              onClick={() => void copyPrizesList()}
            >
              Copy list
            </Button>
          </Group>
          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <Stack gap={6}>
              {sortedSelectedEntries.map((row) => {
                const weight = getEntryWeight(row)
                const weightPercent = formatWeightPercent(weight, totalPrizeWeight)
                const amount = row.override?.amount !== undefined ? row.override.amount : '1'
                const label = formatPrizeListLabel(row, amount, itemById, row.override?.enchantments)
                const valueLabel = formatPrizeValue(row, itemById, virtualKeyValues)
                const categoryLabel = formatPrizeCategoryLabel(row, itemById)
                const enchantTags = isVirtualKeyPrize(row)
                  ? []
                  : sortedEnchantmentEntries(row.override?.enchantments)
                return (
                  <Paper key={row.entryId} withBorder p="xs">
                    <Group wrap="nowrap" gap="sm" justify="space-between" align="flex-start">
                      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={600} lineClamp={1}>
                          {label}
                        </Text>
                        {(categoryLabel != null || valueLabel != null) && (
                          <Text size="xs" c="dimmed">
                            {categoryLabel != null && <>Category: {categoryLabel}</>}
                            {categoryLabel != null && valueLabel != null && ' · '}
                            {valueLabel != null && <>Value: {valueLabel}</>}
                          </Text>
                        )}
                        {enchantTags.length > 0 && (
                          <Group gap={6}>
                            {enchantTags.map(([enchantId, level]) => (
                              <Badge
                                key={enchantId}
                                size="sm"
                                variant="outline"
                                radius="sm"
                                styles={{ label: { textTransform: 'none', fontWeight: 600 } }}
                              >
                                {formatEnchantTagLabel(enchantId, level, enchantsById)}
                              </Badge>
                            ))}
                          </Group>
                        )}
                      </Stack>
                      <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                        <Group gap={4} wrap="nowrap">
                          <ActionIcon
                            size="sm"
                            variant="default"
                            aria-label="Decrease weight"
                            onClick={() => nudgeWeight(row.entryId, -WEIGHT_STEP)}
                          >
                            −
                          </ActionIcon>
                          {editingWeightEntryId === row.entryId ? (
                            <TextInput
                              size="xs"
                              w={44}
                              value={editingWeightDraft}
                              onChange={(e) =>
                                setEditingWeightDraft(e.currentTarget.value.replace(/[^\d]/g, ''))
                              }
                              onBlur={() => commitWeightEdit(row.entryId)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  commitWeightEdit(row.entryId)
                                }
                                if (e.key === 'Escape') cancelWeightEdit()
                              }}
                              styles={{ input: { textAlign: 'center', fontWeight: 600 } }}
                              autoFocus
                              aria-label="Weight"
                            />
                          ) : (
                            <UnstyledButton
                              onClick={() => startEditWeight(row.entryId, weight)}
                              aria-label="Edit weight"
                              style={{ width: 32 }}
                            >
                              <Text size="sm" fw={600} ta="center" style={{ cursor: 'text' }}>
                                {weight}
                              </Text>
                            </UnstyledButton>
                          )}
                          <ActionIcon
                            size="sm"
                            variant="default"
                            aria-label="Increase weight"
                            onClick={() => nudgeWeight(row.entryId, WEIGHT_STEP)}
                          >
                            +
                          </ActionIcon>
                        </Group>
                        <Text size="sm" c="dimmed" w={44} ta="right">
                          {weightPercent}
                        </Text>
                        <Group gap={6} wrap="nowrap" ml={48}>
                          <ActionIcon
                            size="sm"
                            variant="default"
                            aria-label="Edit prize"
                            onClick={() => openPrizeModal(row.entryId)}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="default"
                            color="red"
                            aria-label="Remove prize"
                            onClick={() => openDeletePrizeConfirm(row.entryId)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Group>
                  </Paper>
                )
              })}
              {selectedEntriesDraft.length === 0 && (
                <Text size="sm" c="dimmed">
                  No prizes yet — add items from the catalog.
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Paper>
      </Box>
    </Stack>
  )
}
