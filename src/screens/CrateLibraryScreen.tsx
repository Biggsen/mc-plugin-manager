import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core'
import type { CrateLibraryEntry } from '../types'

interface CrateLibraryScreenProps {
  onCreateCrate: () => void
  onEditCrate: (crateId: string) => void
}

export function CrateLibraryScreen({ onCreateCrate, onEditCrate }: CrateLibraryScreenProps) {
  const [crates, setCrates] = useState<CrateLibraryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function loadLibrary() {
    setLoadError(null)
    try {
      const rows = await window.electronAPI.listCrateLibrary()
      setCrates(rows)
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

  const selected = useMemo(() => crates.find((c) => c.id === selectedId) ?? null, [crates, selectedId])

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed" maw={560}>
          Create crates with theme settings and a prize list (like drop tables). Build emits the base template plus
          generated Prizes — no bundled crate files required.
        </Text>
        <Group gap="xs">
          <Button variant="default" onClick={() => void loadLibrary()}>
            Refresh
          </Button>
          <Button onClick={onCreateCrate}>New crate</Button>
          <Button variant="light" disabled={!selected} onClick={() => selected && onEditCrate(selected.id)}>
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
              {crates.map((c) => (
                <Button
                  key={c.id}
                  variant={c.id === selectedId ? 'light' : 'subtle'}
                  fullWidth
                  justify="flex-start"
                  onClick={() => setSelectedId(c.id)}
                >
                  <Stack gap={0} align="flex-start">
                    <Text size="sm" fw={600} lineClamp={1}>
                      {c.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {c.outputStem}.yml · {c.selectedPrizeEntries?.length ?? 0} prizes
                    </Text>
                  </Stack>
                </Button>
              ))}
              {crates.length === 0 && (
                <Text size="sm" c="dimmed" p="xs">
                  No crates yet. Create one to get started.
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Paper>

        <Paper withBorder p="md" flex={1} miw={0}>
          {!selected ? (
            <Text size="sm" c="dimmed">
              Select a crate or create a new one.
            </Text>
          ) : (
            <Stack gap="sm">
              <Text fw={700}>{selected.name}</Text>
              <Text size="sm" c="dimmed">
                {selected.description?.trim() || 'No description'}
              </Text>
              <Text size="sm">
                Output: <strong>crates/{selected.outputStem}.yml</strong>
              </Text>
              <Text size="sm">
                {selected.selectedPrizeEntries?.length ?? 0} prize items · slot {selected.crateSlot ?? 13} · accent{' '}
                {selected.accentTag ?? 'gray'}
              </Text>
            </Stack>
          )}
        </Paper>
      </Group>
    </Stack>
  )
}
