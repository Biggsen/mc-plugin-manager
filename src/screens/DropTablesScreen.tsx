import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Group, Paper, Stack, Text } from '@mantine/core'
import type { DropTableLibraryEntry, ServerProfile } from '../types'

interface DropTablesScreenProps {
  server: ServerProfile
  onServerUpdate?: (server: ServerProfile) => void
  onOpenDropTableLibrary?: () => void
}

export function DropTablesScreen({ server, onServerUpdate, onOpenDropTableLibrary }: DropTablesScreenProps) {
  const [library, setLibrary] = useState<DropTableLibraryEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const assigned = useMemo(() => new Set(server.dropTables?.libraryTableIds ?? []), [server.dropTables?.libraryTableIds])

  const refreshLibrary = useCallback(async () => {
    setLoadError(null)
    try {
      const rows = await window.electronAPI.listDropTableLibrary()
      setLibrary(rows)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

  async function toggleTable(tableId: string, checked: boolean) {
    const next = new Set(assigned)
    if (checked) next.add(tableId)
    else next.delete(tableId)
    setSaving(true)
    setLoadError(null)
    try {
      const updated = await window.electronAPI.updateServerDropTables(server.id, {
        libraryTableIds: [...next],
      })
      if (updated && onServerUpdate) onServerUpdate(updated)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed" maw={560}>
          Choose which drop tables from the global library apply to this server. Edit tables only in the library —
          not here.
        </Text>
        {onOpenDropTableLibrary && (
          <Button variant="light" onClick={onOpenDropTableLibrary}>
            Open drop table library
          </Button>
        )}
      </Group>

      {loadError && (
        <Alert color="red" title="Error">
          {loadError}
        </Alert>
      )}

      {library.length === 0 ? (
        <Paper withBorder p="md">
          <Text size="sm">No tables in the library yet. Create one in the library screen.</Text>
        </Paper>
      ) : (
        <Stack gap="xs">
          {library.map((t) => (
            <Paper key={t.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Checkbox
                  checked={assigned.has(t.id)}
                  disabled={saving}
                  onChange={(e) => void toggleTable(t.id, e.currentTarget.checked)}
                  label={
                    <Stack gap={0}>
                      <Text fw={600}>{t.name}</Text>
                      <Text size="xs" c="dimmed">
                        {t.selectedItems.length} items · id {t.id.slice(0, 8)}…
                      </Text>
                    </Stack>
                  }
                />
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
