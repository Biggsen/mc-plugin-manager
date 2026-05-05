import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  Alert,
  Badge,
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
  ItemIndexEntry,
} from '../types'

function normalizeItemId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toUpperCase()
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function computeChanceFromUnitBuy(unitBuy: number): number {
  const chance = 0.45 / Math.pow(unitBuy, 0.85)
  return clamp(chance, 0.0005, 0.15)
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
  const [selectedSortColumn, setSelectedSortColumn] = useState<'itemId' | 'unitBuy'>('itemId')
  const [selectedSortDirection, setSelectedSortDirection] = useState<'asc' | 'desc'>('asc')

  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [selectedItemsDraft, setSelectedItemsDraft] = useState<string[]>([])
  const [overridesDraft, setOverridesDraft] = useState<Record<string, DropTableItemOverride>>({})
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({})

  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [listScrollTop, setListScrollTop] = useState(0)
  const [listViewportHeight, setListViewportHeight] = useState(420)

  const tableIdRef = useRef<string | undefined>(tableId)
  const listViewportRef = useRef<HTMLDivElement | null>(null)

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
        const matchesSearch = q.length < 1 || it.name.toLowerCase().includes(q)
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

  const sortedSelectedItems = useMemo(() => {
    const next = [...selectedItemsDraft]
    next.sort((a, b) => {
      let base = 0
      if (selectedSortColumn === 'itemId') {
        base = a.localeCompare(b)
      } else {
        const av = itemById.get(a)?.unitBuy ?? Number.POSITIVE_INFINITY
        const bv = itemById.get(b)?.unitBuy ?? Number.POSITIVE_INFINITY
        base = av - bv
      }
      return selectedSortDirection === 'asc' ? base : -base
    })
    return next
  }, [selectedItemsDraft, selectedSortColumn, selectedSortDirection, itemById])

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

  function toggleSort(column: 'name' | 'category' | 'unitBuy') {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortColumn(column)
    setSortDirection('asc')
  }

  function toggleSelectedSort(column: 'itemId' | 'unitBuy') {
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
        setMinPriceFilter(typeof row.filterMinPrice === 'number' ? row.filterMinPrice : '')
        setMaxPriceFilter(typeof row.filterMaxPrice === 'number' ? row.filterMaxPrice : '')
        setSelectedItemsDraft([...row.selectedItems])
        setOverridesDraft({ ...(row.itemOverrides ?? {}) })
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
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
    if (selectedItemsDraft.includes(id)) return
    setSelectedItemsDraft((prev) => [...prev, id].sort((a, b) => a.localeCompare(b)))
  }

  function toggleItem(rawId: string) {
    const id = normalizeItemId(rawId)
    if (!id || !itemById.has(id)) return
    if (selectedItemsDraft.includes(id)) {
      removeItem(id)
      return
    }
    addItem(id)
  }

  function addRandomItem() {
    const candidates = searchResults.filter((it) => !selectedItemsDraft.includes(it.id))
    if (candidates.length === 0) {
      setLoadError('No available items to add from the current list')
      return
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    addItem(pick.id)
  }

  function addAllItems() {
    const toAdd = searchResults
      .map((it) => it.id)
      .filter((id) => !selectedItemsDraft.includes(id))
    if (toAdd.length === 0) {
      setLoadError('No available items to add from the current list')
      return
    }
    setSelectedItemsDraft((prev) => [...new Set([...prev, ...toAdd])].sort((a, b) => a.localeCompare(b)))
  }

  function removeItem(id: string) {
    setSelectedItemsDraft((prev) => prev.filter((x) => x !== id))
    setOverridesDraft((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setOpenOverrides((prev) => ({ ...prev, [id]: false }))
  }

  function setItemChance(itemId: string, chance: number | string) {
    const key = normalizeItemId(itemId)
    setOverridesDraft((prev) => {
      const existing = prev[key] ?? {}
      const nextChance = typeof chance === 'number' ? chance : Number(chance)
      const nextEntry: DropTableItemOverride = { ...existing }
      if (Number.isFinite(nextChance)) nextEntry.chance = nextChance
      else delete nextEntry.chance
      const next = { ...prev, [key]: nextEntry }
      if (Object.keys(nextEntry).length === 0) delete next[key]
      return next
    })
  }

  function setItemAmount(itemId: string, amount: string) {
    const key = normalizeItemId(itemId)
    setOverridesDraft((prev) => {
      const existing = prev[key] ?? {}
      const trimmed = amount.trim()
      const nextEntry: DropTableItemOverride = { ...existing }
      if (trimmed.length > 0 && trimmed !== '1') nextEntry.amount = trimmed
      else delete nextEntry.amount
      const next = { ...prev, [key]: nextEntry }
      if (Object.keys(nextEntry).length === 0) delete next[key]
      return next
    })
  }

  async function handleSave() {
    setIsSaving(true)
    setLoadError(null)
    try {
      const baseId = tableIdRef.current
      if (baseId) {
        await window.electronAPI.updateDropTable({
          id: baseId,
          name: nameDraft,
          description: descDraft,
          filterMinPrice:
            typeof minPriceFilter === 'number'
              ? minPriceFilter
              : minPriceFilter === ''
                ? undefined
                : Number(minPriceFilter),
          filterMaxPrice:
            typeof maxPriceFilter === 'number'
              ? maxPriceFilter
              : maxPriceFilter === ''
                ? undefined
                : Number(maxPriceFilter),
          selectedItems: selectedItemsDraft,
          itemOverrides: overridesDraft,
        })
        onSaved(baseId)
      } else {
        const created = await window.electronAPI.createDropTable({
          name: nameDraft,
          description: descDraft,
        })
        await window.electronAPI.updateDropTable({
          id: created.id,
          name: nameDraft,
          description: descDraft,
          filterMinPrice:
            typeof minPriceFilter === 'number'
              ? minPriceFilter
              : minPriceFilter === ''
                ? undefined
                : Number(minPriceFilter),
          filterMaxPrice:
            typeof maxPriceFilter === 'number'
              ? maxPriceFilter
              : maxPriceFilter === ''
                ? undefined
                : Number(maxPriceFilter),
          selectedItems: selectedItemsDraft,
          itemOverrides: overridesDraft,
        })
        tableIdRef.current = created.id
        onSaved(created.id)
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSaving(false)
    }
  }

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
          <Button onClick={() => void handleSave()} loading={isSaving}>
            Save table
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

      <Group
        grow
        align="stretch"
        wrap="nowrap"
        style={{ height: 'calc(100vh - 260px)', minHeight: 420 }}
      >
        <Paper
          withBorder
          p="sm"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
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
          placeholder="Search by item name..."
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
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <Text fw={600} size="sm" mb="xs">
            Selected items ({selectedItemsDraft.length})
          </Text>
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
              w={90}
              styles={{
                inner: { justifyContent: 'flex-start' },
                label: { textAlign: 'left', width: '100%' },
              }}
            >
                Price {selectedSortColumn === 'unitBuy' ? (selectedSortDirection === 'asc' ? '↑' : '↓') : ''}
            </Button>
          </Group>
          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <Stack gap={2}>
              {sortedSelectedItems.map((itemId) => {
                const meta = itemById.get(itemId)
                const override = overridesDraft[itemId]
                const unitBuy = meta?.unitBuy
                const computedChance =
                  typeof unitBuy === 'number' && unitBuy > 0
                    ? Number(computeChanceFromUnitBuy(unitBuy).toFixed(6))
                    : undefined
                const isOpen = Boolean(openOverrides[itemId])
                return (
                  <Stack key={itemId} gap={2} py={2}>
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap={6}>
                        <Text size="sm">{itemId}</Text>
                        {typeof unitBuy === 'number' && (
                          <Badge size="xs" variant="light">
                            ${unitBuy}
                          </Badge>
                        )}
                      </Group>
                      <Group gap={4}>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => setOpenOverrides((o) => ({ ...o, [itemId]: !o[itemId] }))}
                        >
                          {isOpen ? 'Hide' : 'Overrides'}
                        </Button>
                      </Group>
                    </Group>
                    {isOpen && (
                      <Group gap="xs" ml="md" mt={-2} mb={6} wrap="nowrap" align="flex-start">
                        <NumberInput
                          label="Chance override"
                          decimalScale={4}
                          step={0.01}
                          min={0}
                          max={1}
                          w={180}
                          styles={{ label: { marginBottom: 2, fontSize: '12px' } }}
                          value={override?.chance ?? ''}
                          onChange={(v) => setItemChance(itemId, v)}
                          placeholder={computedChance !== undefined ? `Auto (${computedChance})` : 'Inherited'}
                        />
                        <TextInput
                          label="Amount override"
                          w={180}
                          styles={{ label: { marginBottom: 2, fontSize: '12px' } }}
                          value={String(override?.amount ?? '')}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setItemAmount(itemId, e.currentTarget.value)
                          }
                          placeholder="Inherited (1)"
                        />
                      </Group>
                    )}
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
      </Group>
    </Stack>
  )
}
