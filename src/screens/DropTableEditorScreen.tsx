import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Group,
  NumberInput,
  UnstyledButton,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import styles from './DropTableEditorScreen.module.css'
import type {
  DropTableLibraryDeleteResult,
  DropTableItemOverride,
  DropTableSelectedEntry,
  ItemIndexEntry,
} from '../types'

function normalizeItemId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toUpperCase()
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

const DEFAULT_ITEM_CHANCE = 0.01 // 1.00%
const CHANCE_STEP = 0.001 // 0.10%

function parseAverageAmount(rawAmount: string | undefined): number | undefined {
  if (!rawAmount) return 1
  const s = rawAmount.trim()
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

const LEVEL_BANDS: Array<{ level: 1 | 2 | 3 | 4 | 5; min: number; max: number }> = [
  { level: 1, min: 1, max: 10 },
  { level: 2, min: 11, max: 20 },
  { level: 3, min: 21, max: 30 },
  { level: 4, min: 31, max: 40 },
  { level: 5, min: 41, max: 50 },
]

function inferLevelBand(minLevel?: number, maxLevel?: number): 1 | 2 | 3 | 4 | 5 | null {
  for (const band of LEVEL_BANDS) {
    if (minLevel === band.min && maxLevel === band.max) return band.level
  }
  return null
}

interface DropTableEditorScreenProps {
  tableId?: string
  onBack: () => void
  onSaved: (tableId: string) => void
}

const LIST_ROW_HEIGHT = 34
const LIST_OVERSCAN_ROWS = 12

export function DropTableEditorScreen({ tableId, onBack, onSaved }: DropTableEditorScreenProps) {
  const [itemsIndex, setItemsIndex] = useState<ItemIndexEntry[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [minPriceFilter, setMinPriceFilter] = useState<number | string>('')
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | string>('')
  const [sortColumn, setSortColumn] = useState<'name' | 'category' | 'unitBuy'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedSortColumn, setSelectedSortColumn] = useState<'itemId' | 'unitBuy' | 'chance' | 'avgValue'>('itemId')
  const [selectedSortDirection, setSelectedSortDirection] = useState<'asc' | 'desc'>('asc')
  const [visibleLevelFilter, setVisibleLevelFilter] = useState<string | null>(null)

  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [selectedEntriesDraft, setSelectedEntriesDraft] = useState<DropTableSelectedEntry[]>([])

  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [listScrollTop, setListScrollTop] = useState(0)
  const [listViewportHeight, setListViewportHeight] = useState(420)

  const selectedItemsDraft = useMemo(
    () => selectedEntriesDraft.map((entry) => entry.itemId),
    [selectedEntriesDraft]
  )

  const tableIdRef = useRef<string | undefined>(tableId)
  const listViewportRef = useRef<HTMLDivElement | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedSnapshotRef = useRef<string>('')
  const isHydratingRef = useRef(true)

  const itemById = useMemo(() => {
    const m = new Map<string, ItemIndexEntry>()
    for (const it of itemsIndex) m.set(it.id, it)
    return m
  }, [itemsIndex])

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>()
    for (const it of itemsIndex) {
      if (it.category?.trim()) categories.add(it.category.trim())
    }
    return [...categories].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c }))
  }, [itemsIndex])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    const minPrice =
      typeof minPriceFilter === 'number'
        ? minPriceFilter
        : minPriceFilter === ''
          ? undefined
          : Number(minPriceFilter)
    const maxPrice =
      typeof maxPriceFilter === 'number'
        ? maxPriceFilter
        : maxPriceFilter === ''
          ? undefined
          : Number(maxPriceFilter)
    const filtered = itemsIndex
      .filter((it) => {
        const matchesSearch =
          q.length < 1 ||
          it.name.toLowerCase().includes(q) ||
          it.id.toLowerCase().includes(q) ||
          it.rawKey.toLowerCase().includes(q)
        const matchesCategory =
          !categoryFilter || (it.category?.toLowerCase() ?? '') === categoryFilter.toLowerCase()
        const unitBuy = it.unitBuy
        const matchesMin =
          minPrice === undefined || (typeof unitBuy === 'number' && Number.isFinite(unitBuy) && unitBuy >= minPrice)
        const matchesMax =
          maxPrice === undefined || (typeof unitBuy === 'number' && Number.isFinite(unitBuy) && unitBuy <= maxPrice)
        return matchesSearch && matchesCategory && matchesMin && matchesMax
      })
    filtered.sort((a, b) => {
      let base = 0
      if (sortColumn === 'name') {
        base = a.name.localeCompare(b.name)
      } else if (sortColumn === 'category') {
        base = (a.category ?? '').localeCompare(b.category ?? '')
      } else {
        const av = a.unitBuy ?? Number.POSITIVE_INFINITY
        const bv = b.unitBuy ?? Number.POSITIVE_INFINITY
        base = av - bv
      }
      return sortDirection === 'asc' ? base : -base
    })
    return filtered
  }, [itemsIndex, search, categoryFilter, minPriceFilter, maxPriceFilter, sortColumn, sortDirection])

  const visibleSelectedEntries = useMemo(() => {
    if (!visibleLevelFilter) return selectedEntriesDraft
    const level = Number(visibleLevelFilter)
    if (!Number.isFinite(level)) return selectedEntriesDraft
    return selectedEntriesDraft.filter((entry) => inferLevelBand(entry.override?.minLevel, entry.override?.maxLevel) === level)
  }, [selectedEntriesDraft, visibleLevelFilter])

  const sortedSelectedEntries = useMemo(() => {
    const next = [...visibleSelectedEntries]
    next.sort((a, b) => {
      let base = 0
      if (selectedSortColumn === 'itemId') {
        base = a.itemId.localeCompare(b.itemId)
      } else if (selectedSortColumn === 'chance') {
        const aOverride = a.override?.chance
        const bOverride = b.override?.chance
        const av =
          typeof aOverride === 'number' && Number.isFinite(aOverride)
            ? aOverride
            : DEFAULT_ITEM_CHANCE
        const bv =
          typeof bOverride === 'number' && Number.isFinite(bOverride)
            ? bOverride
            : DEFAULT_ITEM_CHANCE
        base = av - bv
      } else if (selectedSortColumn === 'avgValue') {
        const avUnitBuy = itemById.get(a.itemId)?.unitBuy
        const bvUnitBuy = itemById.get(b.itemId)?.unitBuy
        const avAmount = parseAverageAmount(a.override?.amount)
        const bvAmount = parseAverageAmount(b.override?.amount)
        const av =
          typeof avUnitBuy === 'number' && Number.isFinite(avUnitBuy) && typeof avAmount === 'number'
            ? avUnitBuy * avAmount
            : Number.NEGATIVE_INFINITY
        const bv =
          typeof bvUnitBuy === 'number' && Number.isFinite(bvUnitBuy) && typeof bvAmount === 'number'
            ? bvUnitBuy * bvAmount
            : Number.NEGATIVE_INFINITY
        base = av - bv
      } else {
        const av = itemById.get(a.itemId)?.unitBuy ?? Number.POSITIVE_INFINITY
        const bv = itemById.get(b.itemId)?.unitBuy ?? Number.POSITIVE_INFINITY
        base = av - bv
      }
      return selectedSortDirection === 'asc' ? base : -base
    })
    return next
  }, [visibleSelectedEntries, selectedSortColumn, selectedSortDirection, itemById])

  const dropTableStats = useMemo(() => {
    const perLevel = LEVEL_BANDS.map((band) => {
      let levelChance = 0
      let itemCount = 0
      for (const row of selectedEntriesDraft) {
        const chance =
          typeof row.override?.chance === 'number' && Number.isFinite(row.override.chance)
            ? row.override.chance
            : DEFAULT_ITEM_CHANCE
        const minLevel = row.override?.minLevel
        const maxLevel = row.override?.maxLevel
        const normalizedMin =
          typeof minLevel === 'number' && Number.isFinite(minLevel) ? minLevel : Number.NEGATIVE_INFINITY
        const normalizedMax =
          typeof maxLevel === 'number' && Number.isFinite(maxLevel) ? maxLevel : Number.POSITIVE_INFINITY
        const overlapsBand = normalizedMin <= band.max && normalizedMax >= band.min
        if (overlapsBand) {
          levelChance += chance
          itemCount += 1
        }
      }
      const levelOverallChance = clamp(levelChance, 0, 1)
      return {
        level: band.level,
        itemCount,
        totalChance: levelChance,
        overallChance: levelOverallChance,
        oneInKills: levelOverallChance > 0 ? 1 / levelOverallChance : undefined,
      }
    })
    return { perLevel }
  }, [selectedEntriesDraft])

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

  function buildSavePayload() {
    const legacyOverrides: Record<string, DropTableItemOverride> = {}
    for (const row of selectedEntriesDraft) {
      if (row.override && Object.keys(row.override).length > 0 && !(row.itemId in legacyOverrides)) {
        legacyOverrides[row.itemId] = row.override
      }
    }
    return {
      name: nameDraft,
      description: descDraft,
      selectedEntries: selectedEntriesDraft,
      selectedItems: selectedItemsDraft,
      itemOverrides: legacyOverrides,
    }
  }

  function snapshotPayload(payload: {
    name: string
    description: string
    selectedEntries: DropTableSelectedEntry[]
    selectedItems: string[]
    itemOverrides: Record<string, DropTableItemOverride>
  }): string {
    return JSON.stringify(payload)
  }

  function toggleSort(column: 'name' | 'category' | 'unitBuy') {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortColumn(column)
    setSortDirection('asc')
  }

  function toggleSelectedSort(column: 'itemId' | 'unitBuy' | 'chance' | 'avgValue') {
    if (selectedSortColumn === column) {
      setSelectedSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSelectedSortColumn(column)
    setSelectedSortDirection('asc')
  }

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const idx = await window.electronAPI.scanItemIndex()
      setItemsIndex(idx.items)

      if (tableId) {
        const lib = await window.electronAPI.listDropTableLibrary()
        const row = lib.find((t) => t.id === tableId)
        if (!row) {
          setLoadError('Drop table not found')
          return
        }
        setNameDraft(row.name)
        setDescDraft(row.description ?? '')
        const selectedEntries =
          Array.isArray(row.selectedEntries) && row.selectedEntries.length > 0
            ? row.selectedEntries
            : row.selectedItems.map((itemId, idx) => ({
                entryId: `${itemId}_${idx + 1}`,
                itemId,
                override: row.itemOverrides?.[itemId] ?? row.itemOverrides?.[itemId.toLowerCase()],
              }))
        setSelectedEntriesDraft(selectedEntries)
        lastSavedSnapshotRef.current = snapshotPayload({
          name: row.name,
          description: row.description ?? '',
          selectedEntries,
          selectedItems: [...row.selectedItems],
          itemOverrides: { ...(row.itemOverrides ?? {}) },
        })
      } else {
        lastSavedSnapshotRef.current = snapshotPayload({
          name: '',
          description: '',
          selectedEntries: [],
          selectedItems: [],
          itemOverrides: {},
        })
      }
      isHydratingRef.current = false
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      isHydratingRef.current = false
    }
  }, [tableId])

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
    const usedBands = new Set<number>()
    for (const row of selectedEntriesDraft) {
      if (row.itemId !== id) continue
      const band = inferLevelBand(row.override?.minLevel, row.override?.maxLevel)
      if (band) usedBands.add(band)
    }
    const nextBand = LEVEL_BANDS.find((band) => !usedBands.has(band.level))
    const override: DropTableItemOverride | undefined = nextBand
      ? { minLevel: nextBand.min, maxLevel: nextBand.max }
      : undefined
    setSelectedEntriesDraft((prev) => [
      ...prev,
      {
        entryId: `${id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        itemId: id,
        override,
      },
    ])
  }

  function toggleItem(rawId: string) {
    addItem(rawId)
  }

  function addRandomItem() {
    const candidates = searchResults
    if (candidates.length === 0) {
      setLoadError('No available items to add from the current list')
      return
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    addItem(pick.id)
  }

  function addAllItems() {
    const toAdd = searchResults.map((it) => it.id)
    if (toAdd.length === 0) {
      setLoadError('No available items to add from the current list')
      return
    }
    for (const id of toAdd) addItem(id)
  }

  function removeItem(entryId: string) {
    setSelectedEntriesDraft((prev) => prev.filter((x) => x.entryId !== entryId))
  }

  function setItemAmount(entryId: string, amount: string) {
    setSelectedEntriesDraft((prev) =>
      prev.map((row) => {
        if (row.entryId !== entryId) return row
        const trimmed = amount.trim()
        const nextOverride: DropTableItemOverride = { ...(row.override ?? {}) }
        if (trimmed.length > 0) nextOverride.amount = trimmed
        else delete nextOverride.amount
        return { ...row, override: Object.keys(nextOverride).length > 0 ? nextOverride : undefined }
      })
    )
  }

  function nudgeItemChance(entryId: string, delta: number) {
    const override = selectedEntriesDraft.find((row) => row.entryId === entryId)?.override
    const baseChance =
      typeof override?.chance === 'number' && Number.isFinite(override.chance)
        ? override.chance
        : DEFAULT_ITEM_CHANCE
    const nextChance = clamp(baseChance + delta, 0, 1)
    setSelectedEntriesDraft((prev) =>
      prev.map((row) =>
        row.entryId === entryId
          ? {
              ...row,
              override: {
                ...(row.override ?? {}),
                chance: Number(nextChance.toFixed(6)),
              },
            }
          : row
      )
    )
  }

  function setItemLevelBand(entryId: string, level: 1 | 2 | 3 | 4 | 5) {
    const band = LEVEL_BANDS.find((b) => b.level === level)
    if (!band) return
    setSelectedEntriesDraft((prev) =>
      prev.map((row) =>
        row.entryId === entryId
          ? {
              ...row,
              override: {
                ...(row.override ?? {}),
                minLevel: band.min,
                maxLevel: band.max,
              },
            }
          : row
      )
    )
  }

  async function handleSave(options?: { closeAfterSave?: boolean }) {
    const closeAfterSave = options?.closeAfterSave === true
    const payload = buildSavePayload()
    setIsSaving(true)
    setLoadError(null)
    try {
      const baseId = tableIdRef.current
      if (baseId) {
        await window.electronAPI.updateDropTable({
          id: baseId,
          ...payload,
        })
        lastSavedSnapshotRef.current = snapshotPayload(payload)
        if (closeAfterSave) onSaved(baseId)
      } else {
        const created = await window.electronAPI.createDropTable({
          name: payload.name,
          description: payload.description,
        })
        await window.electronAPI.updateDropTable({
          id: created.id,
          ...payload,
        })
        tableIdRef.current = created.id
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
  }, [nameDraft, descDraft, selectedEntriesDraft])

  async function handleDelete() {
    const id = tableIdRef.current
    if (!id) return
    setIsDeleting(true)
    setLoadError(null)
    try {
      const res: DropTableLibraryDeleteResult = await window.electronAPI.deleteDropTable(id)
      if (!res.ok) {
        setLoadError(res.error ?? 'Failed to delete table')
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
          {tableIdRef.current && (
            <Button color="red" variant="light" leftSection={<IconTrash size={16} />} loading={isDeleting} onClick={() => void handleDelete()}>
              Delete table
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

      <Group grow>
        <TextInput
          label="LM table name (YAML key)"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.currentTarget.value)}
          placeholder="e.g. stone_tier_1"
        />
        <TextInput
          label="Description"
          value={descDraft}
          onChange={(e) => setDescDraft(e.currentTarget.value)}
          placeholder="Optional"
        />
      </Group>

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
          gap: 16,
          height: 'calc(100vh - 260px)',
          minHeight: 420,
          width: '100%',
        }}
      >
        <Paper
          withBorder
          p="sm"
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}
        >
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
            placeholder="All categories"
            style={{ flex: 1 }}
          />
          <NumberInput
            label="Min price"
            value={minPriceFilter}
            onChange={setMinPriceFilter}
            min={0}
            placeholder="Any"
            w={120}
          />
          <NumberInput
            label="Max price"
            value={maxPriceFilter}
            onChange={setMaxPriceFilter}
            min={0}
            placeholder="Any"
            w={120}
          />
        </Group>
          <Group mb="xs" gap="xs">
            <Button variant="light" onClick={addRandomItem}>
              Add a random item
            </Button>
            <Button variant="light" onClick={addAllItems}>
              Add all
            </Button>
          </Group>
          <TextInput
          placeholder="Search by item name or ID..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <ScrollArea
            style={{ flex: 1, minHeight: 0 }}
            mt="xs"
            offsetScrollbars
            scrollbarSize={10}
            viewportRef={listViewportRef}
            onScrollPositionChange={({ y }) => setListScrollTop(y)}
          >
            <Stack gap={4} pr={10}>
            <Group
              wrap="nowrap"
              px={4}
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                backgroundColor: 'var(--mantine-color-body)',
              }}
            >
              <Button
                size="compact-xs"
                variant="subtle"
                c="dimmed"
                fw={600}
                onClick={() => toggleSort('name')}
                style={{ flex: 1 }}
                styles={{
                  inner: { justifyContent: 'flex-start' },
                  label: { textAlign: 'left', width: '100%' },
                }}
              >
                Name {sortColumn === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </Button>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  c="dimmed"
                  fw={600}
                  onClick={() => toggleSort('category')}
                  w={100}
                  styles={{
                    inner: { justifyContent: 'flex-start' },
                    label: { textAlign: 'left', width: '100%' },
                  }}
                >
                  Category {sortColumn === 'category' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </Button>
                <Button
                size="compact-xs"
                variant="subtle"
                c="dimmed"
                fw={600}
                onClick={() => toggleSort('unitBuy')}
                  w={80}
                styles={{
                  inner: { justifyContent: 'flex-start' },
                  label: { textAlign: 'left', width: '100%' },
                }}
              >
                Price {sortColumn === 'unitBuy' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </Button>
            </Group>
              <Box style={{ position: 'relative', height: searchResults.length * LIST_ROW_HEIGHT }}>
                {virtualItems.map((it, localIdx) => {
                  const idx = virtualRange.start + localIdx
                  const selected = selectedItemsDraft.includes(it.id)
                  const rowClass = `${styles.row} ${selected ? styles.rowSelected : styles.rowUnselected} ${
                    !selected && idx % 2 === 1 ? styles.rowOdd : ''
                  }`
                  return (
                    <UnstyledButton
                      key={it.id}
                      onClick={() => toggleItem(it.id)}
                      className={rowClass}
                      style={{
                        top: idx * LIST_ROW_HEIGHT,
                        height: LIST_ROW_HEIGHT,
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap" px={4} h="100%">
                        <Text size="sm" lineClamp={1} c={selected ? 'white' : undefined} style={{ flex: 1 }}>
                          {it.name}
                        </Text>
                        <Text size="sm" c={selected ? 'white' : 'dimmed'} w={100} ta="left" lineClamp={1}>
                          {it.category ?? '-'}
                        </Text>
                        <Text size="sm" c={selected ? 'white' : 'dimmed'} w={80} ta="right">
                          {typeof it.unitBuy === 'number' ? `$${it.unitBuy}` : '-'}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  )
                })}
              </Box>
              {searchResults.length === 0 && (
                <Text size="xs" c="dimmed">
                  No items match this filter.
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Paper>

        <Paper
          withBorder
          p="sm"
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}
        >
          <Text fw={600} size="sm" mb="xs">
            Selected items ({sortedSelectedEntries.length}
            {visibleLevelFilter ? ` of ${selectedItemsDraft.length}` : ''})
          </Text>
          <Paper withBorder p="xs" mb="xs">
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                Drop Table Stats
              </Text>
              <Text size="xs" c="dimmed">
                Based on total item chance sum (for cap-select: 1 style behavior).
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Per level band:
              </Text>
              {dropTableStats.perLevel.map((band) => (
                <Text key={band.level} size="xs">
                  L{band.level} ({LEVEL_BANDS[band.level - 1].min}-{LEVEL_BANDS[band.level - 1].max}) [{band.itemCount}{' '}
                  {band.itemCount === 1 ? 'item' : 'items'}]:{' '}
                  {(band.totalChance * 100).toFixed(2)}% ({band.oneInKills ? `~1 in ${Math.max(1, Math.round(band.oneInKills))}` : 'no drops'})
                </Text>
              ))}
            </Stack>
          </Paper>
          <Group mb="xs" gap="xs" align="end">
            <Select
              label="Show only level"
              placeholder="None"
              clearable
              value={visibleLevelFilter}
              onChange={setVisibleLevelFilter}
              data={LEVEL_BANDS.map((band) => ({
                value: String(band.level),
                label: `L${band.level} (${band.min}-${band.max})`,
              }))}
              w={220}
            />
            {visibleLevelFilter && (
              <Text size="xs" c="dimmed" mb={6}>
                Preview filter only (saved data unchanged)
              </Text>
            )}
          </Group>
          <Group wrap="nowrap" mb="xs">
            <Button
              size="compact-xs"
              variant="subtle"
              c="dimmed"
              fw={600}
              onClick={() => toggleSelectedSort('itemId')}
              style={{ flex: 1 }}
              styles={{
                inner: { justifyContent: 'flex-start' },
                label: { textAlign: 'left', width: '100%' },
              }}
            >
              Item ID {selectedSortColumn === 'itemId' ? (selectedSortDirection === 'asc' ? '↑' : '↓') : ''}
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              c="dimmed"
              fw={600}
              onClick={() => toggleSelectedSort('unitBuy')}
              w={78}
              styles={{
                inner: { justifyContent: 'flex-start' },
                label: { textAlign: 'left', width: '100%' },
              }}
            >
                Price {selectedSortColumn === 'unitBuy' ? (selectedSortDirection === 'asc' ? '↑' : '↓') : ''}
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              c="dimmed"
              fw={600}
              onClick={() => toggleSelectedSort('chance')}
              w={82}
              styles={{
                inner: { justifyContent: 'flex-start' },
                label: { textAlign: 'left', width: '100%' },
              }}
            >
              Chance {selectedSortColumn === 'chance' ? (selectedSortDirection === 'asc' ? '↑' : '↓') : ''}
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              c="dimmed"
              fw={600}
              onClick={() => toggleSelectedSort('avgValue')}
              w={90}
              styles={{
                inner: { justifyContent: 'flex-start' },
                label: { textAlign: 'left', width: '100%' },
              }}
            >
              Avg Value {selectedSortColumn === 'avgValue' ? (selectedSortDirection === 'asc' ? '↑' : '↓') : ''}
            </Button>
            <Text size="xs" c="dimmed" w={56} ta="left">
              Amount
            </Text>
            <Text size="xs" c="dimmed" w={160} ta="left">
              Levels
            </Text>
            <Box w={24} />
          </Group>
          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <Stack gap={2}>
              {sortedSelectedEntries.map((entry) => {
                const meta = itemById.get(entry.itemId)
                const override = entry.override
                const unitBuy = meta?.unitBuy
                const effectiveChance =
                  typeof override?.chance === 'number' && Number.isFinite(override.chance)
                    ? override.chance
                    : DEFAULT_ITEM_CHANCE
                const avgAmount = parseAverageAmount(override?.amount)
                const avgValue =
                  typeof unitBuy === 'number' && Number.isFinite(unitBuy) && typeof avgAmount === 'number'
                    ? unitBuy * avgAmount
                    : undefined
                const selectedLevelBand = inferLevelBand(override?.minLevel, override?.maxLevel)
                return (
                  <Stack key={entry.entryId} gap={2} py={2}>
                    <Group wrap="nowrap">
                      <Text size="sm" style={{ flex: 1 }} lineClamp={1}>
                        {entry.itemId}
                      </Text>
                      <Text size="sm" c="dimmed" w={78}>
                        {typeof unitBuy === 'number' ? `$${unitBuy}` : '-'}
                      </Text>
                      <Group gap={4} w={82} wrap="nowrap">
                        <Button
                          size="compact-xs"
                          variant="default"
                          px={0}
                          miw={16}
                          onClick={() => nudgeItemChance(entry.entryId, -CHANCE_STEP)}
                        >
                          -
                        </Button>
                        <Text size="sm" c="blue.4" style={{ flex: 1, textAlign: 'center' }}>
                          {typeof effectiveChance === 'number' ? `${(effectiveChance * 100).toFixed(2)}%` : '-'}
                        </Text>
                        <Button
                          size="compact-xs"
                          variant="default"
                          px={0}
                          miw={16}
                          onClick={() => nudgeItemChance(entry.entryId, CHANCE_STEP)}
                        >
                          +
                        </Button>
                      </Group>
                      <Text size="sm" c="grape.4" w={90}>
                        {typeof avgValue === 'number' ? `$${avgValue.toFixed(2)}` : '-'}
                      </Text>
                      <TextInput
                        w={56}
                        size="xs"
                        value={String(override?.amount ?? '')}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setItemAmount(entry.entryId, e.currentTarget.value)
                        }
                        placeholder="1"
                      />
                      <Group gap={4} w={160} wrap="nowrap">
                        {LEVEL_BANDS.map((band) => (
                          <Button
                            key={band.level}
                            size="compact-xs"
                            variant={selectedLevelBand === band.level ? 'filled' : 'default'}
                            px={6}
                            miw={24}
                            onClick={() => setItemLevelBand(entry.entryId, band.level)}
                            title={`Level ${band.level}: ${band.min}-${band.max}`}
                          >
                            {band.level}
                          </Button>
                        ))}
                      </Group>
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="red"
                        px={6}
                        miw={24}
                        onClick={() => removeItem(entry.entryId)}
                        title="Remove this entry"
                      >
                        x
                      </Button>
                    </Group>
                  </Stack>
                )
              })}
              {selectedItemsDraft.length === 0 && (
                <Text size="sm" c="dimmed">
                  No items selected yet.
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Paper>
      </Box>
    </Stack>
  )
}
