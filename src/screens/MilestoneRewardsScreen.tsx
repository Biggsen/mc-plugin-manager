import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Group, Paper, Radio, Stack, Text } from '@mantine/core'
import type { MilestoneRewardsLibraryEntry, ServerProfile } from '../types'

interface MilestoneRewardsScreenProps {
  server: ServerProfile
  onServerUpdate?: (server: ServerProfile) => void
  onOpenMilestoneRewardsLibrary?: () => void
}

export function MilestoneRewardsScreen({
  server,
  onServerUpdate,
  onOpenMilestoneRewardsLibrary,
}: MilestoneRewardsScreenProps) {
  const [library, setLibrary] = useState<MilestoneRewardsLibraryEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedId = server.milestoneRewards?.libraryProfileId ?? null

  const refreshLibrary = useCallback(async () => {
    setLoadError(null)
    try {
      const rows = await window.electronAPI.listMilestoneRewardsLibrary()
      setLibrary(rows)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

  async function selectProfile(profileId: string | null) {
    setSaving(true)
    setLoadError(null)
    try {
      const updated = await window.electronAPI.updateServerMilestoneRewards(server.id, {
        libraryProfileId: profileId,
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
          Choose one milestone rewards preset for this server. When set, named milestone tiers (first, half, all,
          and structure quarter/half/¾/full) use rewards from the library at AA build time. Leave unset to use
          bundled template rewards only.
        </Text>
        {onOpenMilestoneRewardsLibrary && (
          <Button variant="light" onClick={onOpenMilestoneRewardsLibrary}>
            Open milestone rewards library
          </Button>
        )}
      </Group>

      {loadError && (
        <Alert color="red" title="Error">
          {loadError}
        </Alert>
      )}

      <Paper withBorder p="md">
        <Radio.Group
          value={selectedId ?? ''}
          onChange={(v) => void selectProfile(v === '' ? null : v)}
        >
          <Stack gap="sm">
            <Radio value="" label="Bundled template only (no library preset)" disabled={saving} />
            {library.map((p) => (
              <Radio
                key={p.id}
                value={p.id}
                disabled={saving}
                label={
                  <Stack gap={0}>
                    <Text fw={600}>{p.name}</Text>
                    <Text size="xs" c="dimmed">
                      {Object.keys(p.categories ?? {}).length} categories configured
                    </Text>
                  </Stack>
                }
              />
            ))}
          </Stack>
        </Radio.Group>
      </Paper>

      {library.length === 0 && (
        <Text size="sm" c="dimmed">
          No library profiles loaded yet.
        </Text>
      )}
    </Stack>
  )
}
