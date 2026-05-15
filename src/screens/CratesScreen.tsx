import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Group, Paper, Stack, Text } from '@mantine/core'
import type { CrateLibraryEntry, ServerProfile } from '../types'

interface CratesScreenProps {
  server: ServerProfile
  onServerUpdate?: (server: ServerProfile) => void
  onOpenCrateLibrary?: () => void
}

export function CratesScreen({ server, onServerUpdate, onOpenCrateLibrary }: CratesScreenProps) {
  const [library, setLibrary] = useState<CrateLibraryEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const assigned = useMemo(
    () => new Set(server.crazyCrates?.libraryCrateIds ?? []),
    [server.crazyCrates?.libraryCrateIds]
  )

  const refreshLibrary = useCallback(async () => {
    setLoadError(null)
    try {
      const rows = await window.electronAPI.listCrateLibrary()
      setLibrary(rows)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

  async function toggleCrate(crateId: string, checked: boolean) {
    const next = new Set(assigned)
    if (checked) next.add(crateId)
    else next.delete(crateId)
    setSaving(true)
    setLoadError(null)
    try {
      const updated = await window.electronAPI.updateServerCrazyCrates(server.id, {
        libraryCrateIds: [...next],
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
          Choose which crates from the global library to emit for this server. Leave none checked to use the
          default bundled trio (Heart, Region, Village). Edit crate definitions only in the library — not here.
        </Text>
        {onOpenCrateLibrary && (
          <Button variant="light" onClick={onOpenCrateLibrary}>
            Open crate library
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
          <Text size="sm">
            No crates in the library yet. Create entries in the crate library, then assign them here. With an
            empty library, builds still emit the three default bundled crate files when CrazyCrates is enabled.
          </Text>
        </Paper>
      ) : (
        <Stack gap="xs">
          {library.map((c) => (
            <Paper key={c.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Checkbox
                  checked={assigned.has(c.id)}
                  disabled={saving}
                  onChange={(e) => void toggleCrate(c.id, e.currentTarget.checked)}
                  label={
                    <Stack gap={0}>
                      <Text fw={600}>{c.name}</Text>
                      <Text size="xs" c="dimmed">
                        → crates/{c.outputStem}.yml · {(c.selectedPrizeEntries?.length ?? 0)} prizes · id {c.id.slice(0, 8)}…
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
