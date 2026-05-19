import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Box,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import styles from './DropTableEditorScreen.module.css'
import type { ItemIndexEntry } from '../types'
import { MilestoneValueHighlight } from './MilestoneValueHighlight'

const LIST_ROW_HEIGHT = 34
const COLUMN_PANEL_HEIGHT = 220

function formatValue(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '-'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export interface MilestoneItemRow {
  rowId: string
  itemId: string
  materialKey: string
  quantity: number
}

function normalizeItemId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toUpperCase()
}

function parseAaItemLine(line: string): Omit<MilestoneItemRow, 'rowId'> | null {
  const trimmed = line.trim()
  const m = /^(.+?)\s+(\d+(?:\.\d+)?)\s*$/.exec(trimmed)
  if (!m) return null
  const materialKey = m[1].trim().toLowerCase()
  const quantity = Math.max(1, Math.round(Number(m[2])))
  if (!Number.isFinite(quantity)) return null
  return {
    itemId: normalizeItemId(materialKey),
    materialKey,
    quantity,
  }
}

export function parseAaItemsToRows(items: string | string[] | undefined): MilestoneItemRow[] {
  if (!items) return []
  const lines = typeof items === 'string' ? [items] : items
  const rows: MilestoneItemRow[] = []
  for (const line of lines) {
    const parsed = parseAaItemLine(line)
    if (!parsed) continue
    rows.push({
      rowId: `${parsed.itemId}_${rows.length}_${Math.random().toString(36).slice(2, 6)}`,
      ...parsed,
    })
  }
  return rows
}

export function rowsToAaItems(rows: MilestoneItemRow[]): string | string[] | undefined {
  if (rows.length === 0) return undefined
  const lines = rows.map((r) => `${r.materialKey} ${r.quantity}`)
  return lines.length === 1 ? lines[0] : lines
}

function emptyCatalogFilters() {
  return {
    search: '',
    categoryFilter: null as string | null,
    minPriceFilter: '' as number | string,
    maxPriceFilter: '' as number | string,
  }
}

interface MilestoneRewardItemsEditorProps {
  items: string | string[] | undefined
  itemsIndex: ItemIndexEntry[]
  /** Unique per milestone category + slot; resets catalog filters when it changes. */
  catalogScopeKey: string
  isActiveCatalog: boolean
  onCatalogActivate: () => void
  onChange: (items: string | string[] | undefined) => void
}

export function MilestoneRewardItemsEditor({
  items,
  itemsIndex,
  catalogScopeKey,
  isActiveCatalog,
  onCatalogActivate,
  onChange,
}: MilestoneRewardItemsEditorProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [minPriceFilter, setMinPriceFilter] = useState<number | string>('')
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | string>('')
  const [rows, setRows] = useState<MilestoneItemRow[]>(() => parseAaItemsToRows(items))
  const itemsPropRef = useRef(items)

  const itemById = useMemo(() => {
    const m = new Map<string, ItemIndexEntry>()
    for (const it of itemsIndex) m.set(it.id, it)
    return m
  }, [itemsIndex])

  useEffect(() => {
    if (itemsPropRef.current === items) return
    itemsPropRef.current = items
    setRows(parseAaItemsToRows(items))
  }, [items])

  useEffect(() => {
    const cleared = emptyCatalogFilters()
    setSearch(cleared.search)
    setCategoryFilter(cleared.categoryFilter)
    setMinPriceFilter(cleared.minPriceFilter)
    setMaxPriceFilter(cleared.maxPriceFilter)
  }, [catalogScopeKey])

  useEffect(() => {
    if (isActiveCatalog) return
    const cleared = emptyCatalogFilters()
    setSearch(cleared.search)
    setCategoryFilter(cleared.categoryFilter)
    setMinPriceFilter(cleared.minPriceFilter)
    setMaxPriceFilter(cleared.maxPriceFilter)
  }, [isActiveCatalog])

  function activateCatalog() {
    onCatalogActivate()
  }

  function emitRows(next: MilestoneItemRow[]) {
    setRows(next)
    const aa = rowsToAaItems(next)
    itemsPropRef.current = aa
    onChange(aa)
  }

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
    const filtered = itemsIndex.filter((it) => {
      const matchesSearch =
        q.length < 1 ||
        it.id.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        it.rawKey.toLowerCase().includes(q)
      const matchesCategory =
        !categoryFilter || (it.category?.toLowerCase() ?? '') === categoryFilter.toLowerCase()
      const unitBuy = it.unitBuy
      const matchesMin =
        minPrice === undefined ||
        (typeof unitBuy === 'number' && Number.isFinite(unitBuy) && unitBuy >= minPrice)
      const matchesMax =
        maxPrice === undefined ||
        (typeof unitBuy === 'number' && Number.isFinite(unitBuy) && unitBuy <= maxPrice)
      return matchesSearch && matchesCategory && matchesMin && matchesMax
    })
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 200)
  }, [itemsIndex, search, categoryFilter, minPriceFilter, maxPriceFilter])

  function addItem(rawId: string) {
    const id = normalizeItemId(rawId)
    if (!id) return
    const materialKey = id.toLowerCase()
    emitRows([
      ...rows,
      {
        rowId: `${id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemId: id,
        materialKey,
        quantity: 1,
      },
    ])
  }

  function removeRow(rowId: string) {
    emitRows(rows.filter((r) => r.rowId !== rowId))
  }

  function setQuantity(rowId: string, quantity: number) {
    const q = Math.max(1, Math.round(quantity))
    emitRows(rows.map((r) => (r.rowId === rowId ? { ...r, quantity: q } : r)))
  }

  const totalValue = useMemo(() => {
    let sum = 0
    let any = false
    for (const row of rows) {
      const unit = itemById.get(row.itemId)?.unitBuy
      if (typeof unit === 'number' && Number.isFinite(unit)) {
        sum += unit * row.quantity
        any = true
      }
    }
    return any ? sum : null
  }, [rows, itemById])

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Items
      </Text>
      <Group align="stretch" wrap="nowrap" gap="md" grow>
        <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={600}>
            Catalog
          </Text>
          <Group align="flex-end" wrap="nowrap" gap="xs">
            <Select
              data={categoryOptions}
              value={categoryFilter}
              onChange={(v) => {
                activateCatalog()
                setCategoryFilter(v)
              }}
              onFocus={activateCatalog}
              clearable
              searchable
              size="xs"
              label="Category"
              placeholder="All categories"
              style={{ flex: 1, minWidth: 0 }}
            />
            <NumberInput
              label="Min price"
              size="xs"
              value={minPriceFilter}
              onChange={(v) => {
                activateCatalog()
                setMinPriceFilter(v)
              }}
              onFocus={activateCatalog}
              min={0}
              placeholder="Any"
              w={100}
            />
            <NumberInput
              label="Max price"
              size="xs"
              value={maxPriceFilter}
              onChange={(v) => {
                activateCatalog()
                setMaxPriceFilter(v)
              }}
              onFocus={activateCatalog}
              min={0}
              placeholder="Any"
              w={100}
            />
          </Group>
          <TextInput
            placeholder="Search to add…"
            value={search}
            onChange={(e) => {
              activateCatalog()
              setSearch(e.currentTarget.value)
            }}
            onFocus={activateCatalog}
            size="xs"
            label="Search"
          />
          <Paper withBorder p={4} style={{ flex: 1 }}>
            <ScrollArea h={COLUMN_PANEL_HEIGHT} offsetScrollbars>
              <Box style={{ position: 'relative', minHeight: searchResults.length * LIST_ROW_HEIGHT }}>
                {searchResults.map((it, idx) => (
                  <UnstyledButton
                    key={it.id}
                    onClick={() => addItem(it.id)}
                    className={`${styles.row} ${styles.rowUnselected} ${idx % 2 === 1 ? styles.rowOdd : ''}`}
                    style={{
                      position: 'relative',
                      height: LIST_ROW_HEIGHT,
                      width: '100%',
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap" px={4} h="100%">
                      <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
                        {it.name}
                      </Text>
                      <Text size="xs" c="dimmed" w={56} ta="right">
                        {formatValue(it.unitBuy)}
                      </Text>
                    </Group>
                  </UnstyledButton>
                ))}
                {searchResults.length === 0 && (
                  <Text size="xs" c="dimmed" p="xs">
                    No items match.
                  </Text>
                )}
              </Box>
            </ScrollArea>
          </Paper>
        </Stack>

        <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="xs" c="dimmed" fw={600}>
              Added ({rows.length})
            </Text>
            {rows.length > 0 && totalValue !== null && (
              <MilestoneValueHighlight label="Total" value={formatValue(totalValue)} />
            )}
          </Group>
          <Group wrap="nowrap" gap={4} px={4}>
            <Text size="xs" c="dimmed" style={{ flex: 1 }}>
              Item
            </Text>
            <Text size="xs" c="dimmed" w={56}>
              Qty
            </Text>
            <Text size="xs" c="dimmed" w={64} ta="right">
              Value
            </Text>
            <Box w={28} />
          </Group>
          <Paper withBorder p={4} style={{ flex: 1 }}>
            <ScrollArea h={COLUMN_PANEL_HEIGHT} offsetScrollbars>
              <Stack gap={4} p={2}>
                {rows.map((row) => {
                  const meta = itemById.get(row.itemId)
                  const label = meta?.name ?? row.materialKey
                  const unitBuy = meta?.unitBuy
                  const lineValue =
                    typeof unitBuy === 'number' && Number.isFinite(unitBuy)
                      ? unitBuy * row.quantity
                      : undefined
                  return (
                    <Group key={row.rowId} wrap="nowrap" gap={4} align="center">
                      <Text size="sm" lineClamp={1} style={{ flex: 1 }} title={row.itemId}>
                        {label}
                      </Text>
                      <NumberInput
                        size="xs"
                        w={56}
                        min={1}
                        allowDecimal={false}
                        value={row.quantity}
                        onChange={(v) => {
                          const n = typeof v === 'number' ? v : Number(v)
                          if (Number.isFinite(n)) setQuantity(row.rowId, n)
                        }}
                      />
                      <Text size="xs" w={64} ta="right">
                        {formatValue(lineValue)}
                      </Text>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => removeRow(row.rowId)}
                        aria-label="Remove item"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  )
                })}
                {rows.length === 0 && (
                  <Text size="sm" c="dimmed">
                    Click catalog items to add.
                  </Text>
                )}
              </Stack>
            </ScrollArea>
          </Paper>
        </Stack>
      </Group>
    </Stack>
  )
}
