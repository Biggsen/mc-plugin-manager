import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import type {
  AAMilestoneCategoryKey,
  AAMilestoneCategorySlots,
  AAMilestoneReward,
  ItemIndexEntry,
} from '../types'
import { MilestoneRewardItemsEditor } from './MilestoneRewardItemsEditor'
import { MilestoneRewardCommandsEditor } from './MilestoneRewardCommandsEditor'
import {
  FIRST_SLOT_HINT,
  MILESTONE_CATEGORY_LABELS,
  MILESTONE_CATEGORY_ORDER,
  MILESTONE_SLOT_LABELS,
  MilestoneSlotKey,
  SLOTS_BY_CATEGORY,
} from './milestoneRewardsEditorConstants'
import { MilestoneValueHighlight } from './MilestoneValueHighlight'
import { formatMilestoneValue, sumMilestoneRewardValue } from './milestoneRewardValue'

interface MilestoneRewardsEditorScreenProps {
  profileId?: string
  onBack: () => void
  onSaved: () => void
}

function rewardIsEmpty(r: AAMilestoneReward | undefined): boolean {
  if (!r) return true
  return r.experience === undefined && r.items === undefined && !r.command?.execute?.length
}

function SlotEditor({
  slotKey,
  catalogScopeKey,
  isActiveCatalog,
  onCatalogActivate,
  reward,
  itemsIndex,
  onChange,
}: {
  slotKey: MilestoneSlotKey
  catalogScopeKey: string
  isActiveCatalog: boolean
  onCatalogActivate: () => void
  reward: AAMilestoneReward | undefined
  itemsIndex: ItemIndexEntry[]
  onChange: (next: AAMilestoneReward | undefined) => void
}) {
  const r = reward ?? {}
  const slotValue = useMemo(
    () => sumMilestoneRewardValue(reward, itemsIndex),
    [reward, itemsIndex]
  )

  function patch(partial: Partial<AAMilestoneReward>) {
    const merged = { ...r, ...partial }
    if (rewardIsEmpty(merged)) onChange(undefined)
    else onChange(merged)
  }

  return (
    <Paper withBorder p="sm">
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text size="sm" fw={600}>
          {MILESTONE_SLOT_LABELS[slotKey]}
        </Text>
        <MilestoneValueHighlight
          label="Value"
          value={slotValue !== null ? formatMilestoneValue(slotValue) : '—'}
        />
      </Group>
      <Stack gap="xs">
        <NumberInput
          label="Experience"
          min={0}
          value={r.experience ?? ''}
          onChange={(v) => {
            const n = typeof v === 'number' ? v : v === '' ? undefined : Number(v)
            patch({ experience: n !== undefined && Number.isFinite(n) ? n : undefined })
          }}
        />
        <MilestoneRewardItemsEditor
          items={r.items}
          itemsIndex={itemsIndex}
          catalogScopeKey={catalogScopeKey}
          isActiveCatalog={isActiveCatalog}
          onCatalogActivate={onCatalogActivate}
          onChange={(items) => patch({ items })}
        />
        <MilestoneRewardCommandsEditor
          command={r.command}
          itemsIndex={itemsIndex}
          onChange={(command) => patch({ command })}
        />
        <Button
          variant="subtle"
          color="red"
          size="xs"
          onClick={() => onChange(undefined)}
          disabled={rewardIsEmpty(r)}
        >
          Clear slot
        </Button>
      </Stack>
    </Paper>
  )
}

export function MilestoneRewardsEditorScreen({
  profileId,
  onBack,
  onSaved,
}: MilestoneRewardsEditorScreenProps) {
  const [nameDraft, setNameDraft] = useState('')
  const [categoriesDraft, setCategoriesDraft] = useState<
    Partial<Record<AAMilestoneCategoryKey, AAMilestoneCategorySlots>>
  >({})
  const [activeCategory, setActiveCategory] = useState<AAMilestoneCategoryKey>(
    MILESTONE_CATEGORY_ORDER[0]
  )
  const [activeCatalogScope, setActiveCatalogScope] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [entryId, setEntryId] = useState<string | null>(profileId ?? null)
  const [itemsIndex, setItemsIndex] = useState<ItemIndexEntry[]>([])
  const [itemsIndexError, setItemsIndexError] = useState<string | null>(null)

  const entryIdRef = useRef<string | null>(profileId ?? null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedSnapshotRef = useRef<string>('')
  const isHydratingRef = useRef(true)

  function buildSavePayload() {
    return {
      name: nameDraft.trim(),
      categories: categoriesDraft,
    }
  }

  function isPayloadSaveable(payload: ReturnType<typeof buildSavePayload>): boolean {
    if (entryIdRef.current) return true
    if (payload.name.length > 0) return true
    return Object.keys(payload.categories).length > 0
  }

  function resolveSaveName(name: string): string {
    return name.trim() || 'Milestone profile'
  }

  function snapshotPayload(payload: {
    name: string
    categories: Partial<Record<AAMilestoneCategoryKey, AAMilestoneCategorySlots>>
  }): string {
    return JSON.stringify(payload)
  }

  useEffect(() => {
    void window.electronAPI
      .scanItemIndex()
      .then((res) => {
        setItemsIndex(res.items)
        setItemsIndexError(null)
      })
      .catch((e: unknown) => {
        setItemsIndexError(e instanceof Error ? e.message : String(e))
      })
  }, [])

  const loadProfile = useCallback(async () => {
    setLoadError(null)
    isHydratingRef.current = true
    try {
      if (profileId) {
        const rows = await window.electronAPI.listMilestoneRewardsLibrary()
        const row = rows.find((p) => p.id === profileId)
        if (!row) throw new Error('Profile not found')
        setNameDraft(row.name)
        setCategoriesDraft(row.categories ?? {})
        entryIdRef.current = row.id
        setEntryId(row.id)
        lastSavedSnapshotRef.current = snapshotPayload({
          name: row.name,
          categories: row.categories ?? {},
        })
      } else {
        setNameDraft('')
        setCategoriesDraft({})
        entryIdRef.current = null
        setEntryId(null)
        lastSavedSnapshotRef.current = snapshotPayload({ name: '', categories: {} })
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      isHydratingRef.current = false
    }
  }, [profileId])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    setActiveCatalogScope(null)
  }, [activeCategory])

  const slotKeys = SLOTS_BY_CATEGORY[activeCategory]

  function setSlotReward(
    category: AAMilestoneCategoryKey,
    slot: MilestoneSlotKey,
    reward: AAMilestoneReward | undefined
  ) {
    setCategoriesDraft((prev) => {
      const cat = { ...(prev[category] ?? {}) }
      if (reward === undefined) {
        delete cat[slot]
      } else {
        cat[slot] = reward
      }
      const next = { ...prev }
      if (Object.keys(cat).length === 0) {
        delete next[category]
      } else {
        next[category] = cat
      }
      return next
    })
  }

  async function handleSave(options?: { closeAfterSave?: boolean }) {
    const closeAfterSave = options?.closeAfterSave === true
    const payload = buildSavePayload()
    if (!isPayloadSaveable(payload)) return

    setSaveError(null)
    setIsSaving(true)
    try {
      const saveName = resolveSaveName(payload.name)
      let id = entryIdRef.current
      if (!id) {
        const created = await window.electronAPI.createMilestoneRewardsProfile({
          name: saveName,
        })
        id = created.id
        entryIdRef.current = id
        setEntryId(id)
      }
      await window.electronAPI.updateMilestoneRewardsProfile({
        id,
        name: saveName,
        categories: payload.categories,
      })
      lastSavedSnapshotRef.current = snapshotPayload(payload)
      if (closeAfterSave) onSaved()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (isHydratingRef.current) return
    const payload = buildSavePayload()
    if (!isPayloadSaveable(payload)) return
    const snapshot = snapshotPayload(payload)
    if (snapshot === lastSavedSnapshotRef.current) return

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      void handleSave()
    }, 500)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [nameDraft, categoriesDraft])

  async function handleDelete() {
    if (!entryId) return
    if (!window.confirm('Delete this milestone rewards profile? Servers using it will fall back to bundled rewards.')) {
      return
    }
    setIsDeleting(true)
    setSaveError(null)
    try {
      await window.electronAPI.deleteMilestoneRewardsProfile(entryId)
      onSaved()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsDeleting(false)
    }
  }

  const firstHint = FIRST_SLOT_HINT[activeCategory]

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Button variant="subtle" onClick={onBack}>
          Back to library
        </Button>
        <Group gap="xs">
          {isSaving && (
            <Text size="sm" c="dimmed">
              Saving…
            </Text>
          )}
          {entryId && (
            <Button variant="light" color="red" loading={isDeleting} onClick={() => void handleDelete()}>
              Delete
            </Button>
          )}
          <Button loading={isSaving} onClick={() => void handleSave({ closeAfterSave: true })}>
            Save and close
          </Button>
        </Group>
      </Group>

      {(loadError || saveError || itemsIndexError) && (
        <Alert color="red" title="Error">
          {loadError ?? saveError ?? itemsIndexError}
        </Alert>
      )}

      <TextInput label="Profile name" value={nameDraft} onChange={(e) => setNameDraft(e.currentTarget.value)} />

      <Group align="flex-start" wrap="nowrap" gap="md" style={{ minHeight: 480 }}>
        <Paper withBorder w={240} p="xs">
          <ScrollArea h={480}>
            <Stack gap={4}>
              {MILESTONE_CATEGORY_ORDER.map((key) => (
                <Button
                  key={key}
                  variant={key === activeCategory ? 'light' : 'subtle'}
                  fullWidth
                  justify="flex-start"
                  onClick={() => setActiveCategory(key)}
                >
                  <Text size="sm" lineClamp={2}>
                    {MILESTONE_CATEGORY_LABELS[key]}
                  </Text>
                </Button>
              ))}
            </Stack>
          </ScrollArea>
        </Paper>

        <Stack flex={1} gap="sm">
          <Text fw={600}>{MILESTONE_CATEGORY_LABELS[activeCategory]}</Text>
          {firstHint && (
            <Text size="xs" c="dimmed">
              {firstHint}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            Messages and display names stay from the bundled template at build time; only rewards are overridden.
          </Text>
          {slotKeys.map((slot) => {
            const catalogScopeKey = `${activeCategory}-${slot}`
            return (
              <SlotEditor
                key={catalogScopeKey}
                slotKey={slot}
                catalogScopeKey={catalogScopeKey}
                isActiveCatalog={activeCatalogScope === catalogScopeKey}
                onCatalogActivate={() => setActiveCatalogScope(catalogScopeKey)}
                itemsIndex={itemsIndex}
                reward={categoriesDraft[activeCategory]?.[slot]}
                onChange={(reward) => setSlotReward(activeCategory, slot, reward)}
              />
            )
          })}
        </Stack>
      </Group>
    </Stack>
  )
}
