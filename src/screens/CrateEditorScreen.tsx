import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
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
import type { CrateLibraryDeleteResult, CratePrizeEntry, CratePrizeOverride, ItemIndexEntry } from '../types'

const DEFAULT_WEIGHT = 50
const WEIGHT_STEP = 5
const DEFAULT_STACK_SIZE = 64
const LIST_ROW_HEIGHT = 34
const LIST_OVERSCAN_ROWS = 12

function normalizeItemId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toUpperCase()
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function prizeAmountDisplay(amount: string): string {
  return amount.trim() || '1'
}

function catalogStackSize(item: ItemIndexEntry | undefined): number {
  const raw = item?.stack
  if (raw === undefined) return DEFAULT_STACK_SIZE
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STACK_SIZE
}

/** e.g. "64x paper" when amount is not 1; otherwise just the catalog name. */
function formatPrizeItemLabel(amount: string, itemName: string): string {
  const display = prizeAmountDisplay(amount)
  if (display === '1') return itemName
  return `${display}x ${itemName}`
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

  const [amountModalOpen, setAmountModalOpen] = useState(false)
  const [amountModalEntryId, setAmountModalEntryId] = useState<string | null>(null)
  const [amountModalDraft, setAmountModalDraft] = useState('1')
  const [amountModalError, setAmountModalError] = useState<string | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [listScrollTop, setListScrollTop] = useState(0)
  const [listViewportHeight, setListViewportHeight] = useState(420)

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
      const idx = await window.electronAPI.scanItemIndex()
      setItemsIndex(idx.items)

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
        setSelectedEntriesDraft(row.selectedPrizeEntries ?? [])
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
          selectedPrizeEntries: row.selectedPrizeEntries ?? [],
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

  function removeEntry(entryId: string) {
    setSelectedEntriesDraft((prev) => prev.filter((x) => x.entryId !== entryId))
  }

  function setEntryAmount(entryId: string, amount: string) {
    setSelectedEntriesDraft((prev) =>
      prev.map((row) => {
        if (row.entryId !== entryId) return row
        const nextOverride: CratePrizeOverride = { ...(row.override ?? {}) }
        nextOverride.amount = amount
        return { ...row, override: nextOverride }
      })
    )
  }

  function nudgeWeight(entryId: string, delta: number) {
    setSelectedEntriesDraft((prev) =>
      prev.map((row) => {
        if (row.entryId !== entryId) return row
        const base =
          typeof row.override?.weight === 'number' && Number.isFinite(row.override.weight)
            ? row.override.weight
            : DEFAULT_WEIGHT
        const next = clamp(base + delta, 1, 10_000)
        return {
          ...row,
          override: { ...(row.override ?? {}), weight: next },
        }
      })
    )
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

  function openAmountModal(entryId: string) {
    const row = selectedEntriesDraft.find((r) => r.entryId === entryId)
    if (!row) return
    setAmountModalEntryId(entryId)
    setAmountModalDraft(row.override?.amount !== undefined ? row.override.amount : '1')
    setAmountModalError(null)
    setAmountModalOpen(true)
  }

  function applyAmountModal() {
    if (!amountModalEntryId) return
    setAmountModalError(null)
    const trimmed = amountModalDraft.trim()
    if (!trimmed) {
      setAmountModalError('Amount is required')
      return
    }
    setEntryAmount(amountModalEntryId, trimmed)
    setAmountModalOpen(false)
    setAmountModalEntryId(null)
  }

  function setAmountModalToStack() {
    if (!amountModalEntryId) return
    const row = selectedEntriesDraft.find((r) => r.entryId === amountModalEntryId)
    if (!row) return
    const stack = catalogStackSize(itemById.get(row.itemId))
    setAmountModalDraft(String(stack))
    setAmountModalError(null)
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
        opened={amountModalOpen}
        onClose={() => setAmountModalOpen(false)}
        title="Edit amount"
        size="sm"
      >
        <Stack gap="sm">
          {amountModalEntryId && (
            <Text size="sm" c="dimmed">
              {formatPrizeItemLabel(
                amountModalDraft,
                itemById.get(selectedEntriesDraft.find((r) => r.entryId === amountModalEntryId)?.itemId ?? '')?.name ??
                  selectedEntriesDraft.find((r) => r.entryId === amountModalEntryId)?.itemId ??
                  ''
              )}
            </Text>
          )}
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Amount
            </Text>
            <Text size="xs" c="dimmed">
              Use a number (e.g. 64) or range (e.g. 3-6)
            </Text>
            <Group gap="sm" align="center" wrap="nowrap">
              <TextInput
                w={96}
                value={amountModalDraft}
                onChange={(e) => setAmountModalDraft(e.currentTarget.value)}
              />
              <Anchor size="sm" onClick={setAmountModalToStack}>
                Set as stack
              </Anchor>
            </Group>
          </Stack>
          {amountModalError && (
            <Text size="sm" c="red">
              {amountModalError}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAmountModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyAmountModal}>Save</Button>
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
          <Text fw={600} size="sm" mb="xs">
            Prizes ({selectedEntriesDraft.length})
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            Click items on the left to add. Use weight and edit amount per row; defaults are used for everything else at build
            time.
          </Text>
          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <Stack gap={6}>
              {selectedEntriesDraft.map((row) => {
                const weight = row.override?.weight ?? DEFAULT_WEIGHT
                const amount = row.override?.amount !== undefined ? row.override.amount : '1'
                const catalogName = itemById.get(row.itemId)?.name ?? row.itemId
                const label = formatPrizeItemLabel(amount, catalogName)
                return (
                  <Paper key={row.entryId} withBorder p="xs">
                    <Group wrap="nowrap" gap="sm" justify="space-between">
                      <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                        {label}
                      </Text>
                      <Group gap={6} wrap="nowrap">
                        <Group gap={4} wrap="nowrap">
                          <ActionIcon
                            size="sm"
                            variant="default"
                            aria-label="Decrease weight"
                            onClick={() => nudgeWeight(row.entryId, -WEIGHT_STEP)}
                          >
                            −
                          </ActionIcon>
                          <Text size="sm" fw={600} w={32} ta="center">
                            {weight}
                          </Text>
                          <ActionIcon
                            size="sm"
                            variant="default"
                            aria-label="Increase weight"
                            onClick={() => nudgeWeight(row.entryId, WEIGHT_STEP)}
                          >
                            +
                          </ActionIcon>
                        </Group>
                        <ActionIcon
                          size="sm"
                          variant="default"
                          aria-label="Edit amount"
                          onClick={() => openAmountModal(row.entryId)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="default"
                          color="red"
                          aria-label="Remove prize"
                          onClick={() => removeEntry(row.entryId)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
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
