import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Group, Paper, Stack, Text } from '@mantine/core'
import type { ItemIndexEntry, MilestoneRewardsLibraryEntry } from '../types'
import { MilestoneCategorySummaryCards } from './MilestoneCategorySummaryCards'
import { MILESTONE_CATEGORY_LABELS } from './milestoneRewardsEditorConstants'
import { summarizeMilestoneProfile } from './milestoneRewardSummary'

interface MilestoneRewardsLibraryScreenProps {
  selectedProfileId: string | null
  onSelectProfileId: (profileId: string | null) => void
  onCreateProfile: () => void
  onEditProfile: (profileId: string) => void
}

export function MilestoneRewardsLibraryScreen({
  selectedProfileId,
  onSelectProfileId,
  onCreateProfile,
  onEditProfile,
}: MilestoneRewardsLibraryScreenProps) {
  const [profiles, setProfiles] = useState<MilestoneRewardsLibraryEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [itemsIndex, setItemsIndex] = useState<ItemIndexEntry[]>([])
  const [itemsIndexError, setItemsIndexError] = useState<string | null>(null)

  async function loadLibrary() {
    setLoadError(null)
    try {
      const rows = await window.electronAPI.listMilestoneRewardsLibrary()
      setProfiles(rows)
      if (rows.length === 0) {
        onSelectProfileId(null)
      } else if (selectedProfileId && rows.some((r) => r.id === selectedProfileId)) {
        // keep current selection
      } else {
        onSelectProfileId(rows[0].id)
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void loadLibrary()
  }, [])

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

  const selected = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  )

  const categorySummaries = useMemo(() => {
    if (!selected) return []
    return summarizeMilestoneProfile(selected.categories, MILESTONE_CATEGORY_LABELS, itemsIndex)
  }, [selected, itemsIndex])

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed" maw={560}>
          Global presets for AdvancedAchievements named milestone rewards (first discovery, half, all, and
          structure quarter/half/¾/full). Assign one preset per server; tier counts stay dynamic at build time.
        </Text>
        <Group gap="xs">
          <Button variant="default" onClick={() => void loadLibrary()}>
            Refresh
          </Button>
          <Button onClick={onCreateProfile}>New profile</Button>
          <Button
            variant="light"
            disabled={!selected}
            onClick={() => selected && onEditProfile(selected.id)}
          >
            Edit selected
          </Button>
        </Group>
      </Group>

      {(loadError || itemsIndexError) && (
        <Alert color="red" title="Error">
          {loadError ?? itemsIndexError}
        </Alert>
      )}

      <Group align="flex-start" wrap="nowrap" gap="md">
        <Paper withBorder w={280} p="xs">
          <Stack gap={4}>
            {profiles.map((p) => {
              const catCount = Object.keys(p.categories ?? {}).length
              return (
                <Button
                  key={p.id}
                  variant={p.id === selectedProfileId ? 'light' : 'subtle'}
                  fullWidth
                  justify="flex-start"
                  onClick={() => onSelectProfileId(p.id)}
                >
                  <Stack gap={0} align="flex-start">
                    <Text size="sm" fw={600} lineClamp={1}>
                      {p.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {catCount} categories · {p.id.slice(0, 8)}…
                    </Text>
                  </Stack>
                </Button>
              )
            })}
          </Stack>
        </Paper>

        <Paper withBorder p="md" flex={1} style={{ minWidth: 0 }}>
          {selected ? (
            <Stack gap="sm">
              <Group justify="space-between" wrap="nowrap">
                <Text fw={600}>{selected.name}</Text>
                <Text size="xs" c="dimmed">
                  {categorySummaries.length} milestone {categorySummaries.length === 1 ? 'section' : 'sections'}
                </Text>
              </Group>
              <MilestoneCategorySummaryCards summaries={categorySummaries} />
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No profiles yet. Create one or wait for the default bundled profile on first load.
            </Text>
          )}
        </Paper>
      </Group>
    </Stack>
  )
}
