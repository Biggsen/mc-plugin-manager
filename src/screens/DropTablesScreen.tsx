import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Alert, Badge, Button, Checkbox, Group, Paper, SimpleGrid, Stack, Text, TextInput, NumberInput } from '@mantine/core'
import type { DropTableCatalogSummary, DropTablesConfig, ServerProfile } from '../types'

interface DropTablesScreenProps {
  server: ServerProfile
  onServerUpdate?: (server: ServerProfile) => void
}

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

export function DropTablesScreen({ server, onServerUpdate }: DropTablesScreenProps) {
  const [catalogs, setCatalogs] = useState<DropTableCatalogSummary[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [autosaveError, setAutosaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<DropTablesConfig>(
    server.dropTables ?? {
      tables: {},
    }
  )
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedSignatureRef = useRef<string>(JSON.stringify(server.dropTables ?? { tables: {} }))

  const tableByName = useMemo(() => draft.tables ?? {}, [draft.tables])
  const draftSignature = useMemo(() => JSON.stringify(draft), [draft])

  async function handleScanCatalogs() {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanDropTableCatalogs()
      setCatalogs(result.catalogs)
      setWarnings(result.warnings)
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    void handleScanCatalogs()
  }, [server.id])

  function updateTableSelection(tableName: string, itemId: string, selected: boolean) {
    setDraft((prev) => {
      const current = prev.tables?.[tableName] ?? { selectedItems: [], itemOverrides: {} }
      const normalized = normalizeItemId(itemId)
      const selectedSet = new Set(current.selectedItems.map(normalizeItemId))
      if (selected) {
        selectedSet.add(normalized)
      } else {
        selectedSet.delete(normalized)
      }
      return {
        ...prev,
        tables: {
          ...prev.tables,
          [tableName]: {
            ...current,
            selectedItems: Array.from(selectedSet).sort((a, b) => a.localeCompare(b)),
          },
        },
      }
    })
  }

  function getOverrideKey(tableName: string, itemId: string): string {
    return `${tableName}::${normalizeItemId(itemId)}`
  }

  function setItemChance(tableName: string, itemId: string, chance: number | string) {
    setDraft((prev) => {
      const current = prev.tables?.[tableName] ?? { selectedItems: [], itemOverrides: {} }
      const key = normalizeItemId(itemId)
      const existing = current.itemOverrides?.[key] ?? {}
      const nextChance = typeof chance === 'number' ? chance : Number(chance)
      const nextEntry = {
        ...existing,
        ...(Number.isFinite(nextChance) ? { chance: nextChance } : {}),
      }
      if (!Number.isFinite(nextChance) && 'chance' in nextEntry) {
        delete (nextEntry as Record<string, unknown>).chance
      }
      const nextOverrides = {
        ...(current.itemOverrides ?? {}),
        [key]: nextEntry,
      }
      return {
        ...prev,
        tables: {
          ...prev.tables,
          [tableName]: {
            ...current,
            itemOverrides: nextOverrides,
          },
        },
      }
    })
  }

  function setItemAmount(tableName: string, itemId: string, amount: string) {
    setDraft((prev) => {
      const current = prev.tables?.[tableName] ?? { selectedItems: [], itemOverrides: {} }
      const key = normalizeItemId(itemId)
      const existing = current.itemOverrides?.[key] ?? {}
      const trimmed = amount.trim()
      const nextOverrides = {
        ...(current.itemOverrides ?? {}),
        [key]: {
          ...existing,
          ...(trimmed.length > 0 && trimmed !== '1' ? { amount: trimmed } : {}),
        },
      }
      return {
        ...prev,
        tables: {
          ...prev.tables,
          [tableName]: {
            ...current,
            itemOverrides: nextOverrides,
          },
        },
      }
    })
  }

  async function handleSave() {
    setIsSaving(true)
    setAutosaveError(null)
    try {
      const updated = await window.electronAPI.updateDropTablesConfig(server.id, {
        config: draft,
      })
      lastSavedSignatureRef.current = draftSignature
      setLastSavedAt(new Date().toISOString())
      if (updated && onServerUpdate) {
        onServerUpdate(updated)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setAutosaveError(message || 'Failed to save drop tables')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (draftSignature === lastSavedSignatureRef.current) return
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    autosaveTimerRef.current = setTimeout(() => {
      void handleSave()
    }, 600)
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [draftSignature])

  return (
    <Stack gap="lg">
      <Group justify="flex-end">
        <Button onClick={handleScanCatalogs} loading={isScanning}>
          Refresh Catalogs
        </Button>
      </Group>

      {warnings.length > 0 && (
        <Alert color="yellow" title="Catalog warnings">
          <Stack gap={2}>
            {warnings.map((warning, index) => (
              <Text size="sm" key={`${warning}-${index}`}>
                {warning}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      {autosaveError && (
        <Alert color="red" title="Autosave error">
          {autosaveError}
        </Alert>
      )}

      {catalogs.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {catalogs.map((catalog) => {
            const table = tableByName[catalog.tableName] ?? { selectedItems: [], itemOverrides: {} }
            const selectedSet = new Set(table.selectedItems.map(normalizeItemId))
            const selectedCount = catalog.itemIds.filter((itemId) => selectedSet.has(itemId)).length
            return (
              <Paper key={catalog.tableName} withBorder p="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fw={600}>{catalog.tableName}</Text>
                    <Group gap="xs">
                      <Badge color="green">{selectedCount} selected</Badge>
                      <Badge variant="light">{catalog.itemCount} items</Badge>
                    </Group>
                  </Group>
                  <Stack gap="xs" mah={320} style={{ overflowY: 'auto' }}>
                    {catalog.itemIds.map((itemId) => {
                      const isSelected = selectedSet.has(itemId)
                      const override = table.itemOverrides?.[itemId]
                      const unitBuy = catalog.itemValues?.[itemId]
                      const computedChance =
                        typeof unitBuy === 'number' && unitBuy > 0
                          ? Number(computeChanceFromUnitBuy(unitBuy).toFixed(6))
                          : undefined
                      const overrideKey = getOverrideKey(catalog.tableName, itemId)
                      const isOverrideOpen = Boolean(openOverrides[overrideKey])
                      return (
                        <Paper key={itemId} withBorder p="xs">
                          <Stack gap="xs">
                            <Group justify="space-between" align="center">
                              <Checkbox
                                checked={isSelected}
                                label={
                                  <Group gap={8}>
                                    <Text size="sm">{itemId}</Text>
                                    {typeof catalog.itemValues?.[itemId] === 'number' && (
                                      <Badge color="green" variant="light">
                                        ${catalog.itemValues[itemId]}
                                      </Badge>
                                    )}
                                  </Group>
                                }
                                onChange={(e) => {
                                  const checked = e.currentTarget.checked
                                  updateTableSelection(catalog.tableName, itemId, checked)
                                  if (!checked) {
                                    setOpenOverrides((prev) => ({
                                      ...prev,
                                      [overrideKey]: false,
                                    }))
                                  }
                                }}
                              />
                              <Button
                                size="xs"
                                variant="subtle"
                                disabled={!isSelected}
                                onClick={() =>
                                  setOpenOverrides((prev) => ({
                                    ...prev,
                                    [overrideKey]: !prev[overrideKey],
                                  }))
                                }
                              >
                                {isOverrideOpen ? 'Hide' : 'Edit'}
                              </Button>
                            </Group>
                            {isSelected && isOverrideOpen && (
                              <Group grow>
                                <NumberInput
                                  label="Chance override"
                                  decimalScale={3}
                                  step={0.01}
                                  min={0}
                                  max={1}
                                  value={override?.chance ?? ''}
                                  onChange={(value) => setItemChance(catalog.tableName, itemId, value)}
                                  placeholder={
                                    computedChance !== undefined
                                      ? `Auto (${computedChance})`
                                      : 'Inherited default'
                                  }
                                />
                                <TextInput
                                  label="Amount override"
                                  value={String(override?.amount ?? '')}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    setItemAmount(catalog.tableName, itemId, e.currentTarget.value)
                                  }
                                  placeholder="Inherited (1)"
                                />
                              </Group>
                            )}
                          </Stack>
                        </Paper>
                      )
                    })}
                  </Stack>
                </Stack>
              </Paper>
            )
          })}
        </SimpleGrid>
      )}

      <Group justify="flex-end">
        <Text size="xs" c="dimmed">
          {isSaving
            ? 'Saving changes...'
            : lastSavedAt
              ? `Saved automatically at ${new Date(lastSavedAt).toLocaleTimeString()}`
              : 'Autosave enabled'}
        </Text>
        <Button variant="default" onClick={handleSave} loading={isSaving}>
          Save now
        </Button>
      </Group>
    </Stack>
  )
}
