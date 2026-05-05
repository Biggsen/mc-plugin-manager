import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core'
import type { DropTableLibraryEntry } from '../types'

interface DropTableLibraryScreenProps {
  onCreateTable: () => void
  onEditTable: (tableId: string) => void
}

export function DropTableLibraryScreen({ onCreateTable, onEditTable }: DropTableLibraryScreenProps) {
  const [tables, setTables] = useState<DropTableLibraryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function loadLibrary() {
    setLoadError(null)
    try {
      const rows = await window.electronAPI.listDropTableLibrary()
      setTables(rows)
      if (rows.length === 0) {
        setSelectedId(null)
      } else if (!rows.some((r) => r.id === selectedId)) {
        setSelectedId(rows[0].id)
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void loadLibrary()
  }, [])

  const selected = useMemo(() => tables.find((t) => t.id === selectedId) ?? null, [tables, selectedId])

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Read-only library view. Use New or Edit to modify drop tables on the dedicated editor page.
        </Text>
        <Group gap="xs">
          <Button variant="default" onClick={() => void loadLibrary()}>
            Refresh
          </Button>
          <Button onClick={onCreateTable}>New table</Button>
          <Button
            variant="light"
            disabled={!selected}
            onClick={() => selected && onEditTable(selected.id)}
          >
            Edit selected
          </Button>
        </Group>
      </Group>

      {loadError && (
        <Alert color="red" title="Error">
          {loadError}
        </Alert>
      )}

      <Group align="flex-start" wrap="nowrap" gap="md" style={{ minHeight: 420 }}>
        <Paper withBorder w={280} p="xs">
          <ScrollArea h={420}>
            <Stack gap={4}>
              {tables.map((t) => (
                <Button
                  key={t.id}
                  variant={t.id === selectedId ? 'light' : 'subtle'}
                  fullWidth
                  justify="flex-start"
                  onClick={() => setSelectedId(t.id)}
                >
                  <Stack gap={0} align="flex-start">
                    <Text size="sm" fw={600} lineClamp={1}>
                      {t.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t.selectedItems.length} items
                    </Text>
                  </Stack>
                </Button>
              ))}
              {tables.length === 0 && (
                <Text size="sm" c="dimmed" p="xs">
                  No drop tables in the library.
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Paper>

        <Paper withBorder p="md" flex={1} miw={0}>
          {!selected ? (
            <Text size="sm" c="dimmed">
              Select a drop table to view its contents.
            </Text>
          ) : (
            <Stack gap="sm">
              <Text fw={700}>{selected.name}</Text>
              <Text size="sm" c="dimmed">
                {selected.description?.trim() || 'No description'}
              </Text>
              <Text size="sm" c="dimmed">
                Price filter: min{' '}
                {typeof selected.filterMinPrice === 'number' ? `$${selected.filterMinPrice}` : 'Any'} / max{' '}
                {typeof selected.filterMaxPrice === 'number' ? `$${selected.filterMaxPrice}` : 'Any'}
              </Text>
              <Text size="sm">Contains {selected.selectedItems.length} items</Text>

              <Paper withBorder p="xs">
                <ScrollArea h={280}>
                  <Stack gap={2}>
                    {selected.selectedItems.map((itemId) => (
                      <Text key={itemId} size="sm">
                        {itemId}
                      </Text>
                    ))}
                    {selected.selectedItems.length === 0 && (
                      <Text size="sm" c="dimmed">
                        No items in this table.
                      </Text>
                    )}
                  </Stack>
                </ScrollArea>
              </Paper>
            </Stack>
          )}
        </Paper>
      </Group>
    </Stack>
  )
}
