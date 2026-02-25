import { useState, useEffect } from 'react'
import {
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Alert,
  Select,
  Paper,
  Divider,
} from '@mantine/core'
import type { ServerProfile, RegionRecord } from '../types'
import { LoreBookPreview } from '../components/LoreBookPreview'

function formatRegionLabel(region: RegionRecord): string {
  return region.discover.displayNameOverride
    ?? region.id.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')
}

interface LoreBooksScreenProps {
  server: ServerProfile
  onServerUpdate?: (server: ServerProfile) => void
}

export function LoreBooksScreen({ server, onServerUpdate }: LoreBooksScreenProps) {
  const [outDir, setOutDir] = useState(server.build?.loreBooksOutputDirectory || '')
  const [author, setAuthor] = useState('Admin')
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [localAnchors, setLocalAnchors] = useState<string[]>([])
  const [localDescription, setLocalDescription] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null)

  useEffect(() => {
    setOutDir(server.build?.loreBooksOutputDirectory || '')
  }, [server.id, server.build?.loreBooksOutputDirectory])

  const regionsWithDescription = server.regions.filter((r) =>
    (r.loreBookDescription ?? r.description)?.trim()
  )
  const hasRegions = regionsWithDescription.length > 0
  const selectedRegion = selectedRegionId
    ? regionsWithDescription.find((r) => r.id === selectedRegionId)
    : null

  useEffect(() => {
    if (selectedRegion) {
      setLocalAnchors(selectedRegion.loreBookAnchors ?? [])
      setLocalDescription((selectedRegion.loreBookDescription ?? selectedRegion.description)?.trim() ?? '')
    } else {
      setLocalAnchors([])
      setLocalDescription('')
    }
  }, [selectedRegion?.id, selectedRegion?.loreBookAnchors, selectedRegion?.loreBookDescription, selectedRegion?.description])

  async function handleSelectOutputDir() {
    const path = await window.electronAPI.showOutputDialog()
    if (path) setOutDir(path)
  }

  async function handleSave() {
    if (!selectedRegionId || !server.id) return
    setIsSaving(true)
    try {
      const updates: { anchors?: string[]; description?: string } = {}
      if (JSON.stringify(localAnchors) !== JSON.stringify(selectedRegion?.loreBookAnchors ?? [])) {
        updates.anchors = localAnchors
      }
      const baseDesc = (selectedRegion?.loreBookDescription ?? selectedRegion?.description)?.trim() ?? ''
      if (localDescription !== baseDesc) updates.description = localDescription
      if (Object.keys(updates).length === 0) return
      const updated = await window.electronAPI.updateRegionLoreBook(
        server.id,
        selectedRegionId,
        updates
      )
      if (updated && onServerUpdate) onServerUpdate(updated)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExport() {
    setResult(null)
    if (!outDir || outDir.trim().length === 0) {
      setResult({ success: false, error: 'Please select an output directory' })
      return
    }
    setIsExporting(true)
    try {
      const res = await window.electronAPI.exportLoreBooks(server.id, {
        outDir,
        author: author.trim() || 'Admin',
      })
      setResult(res)
    } catch (error: unknown) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const hasChanges =
    selectedRegion &&
    (JSON.stringify(localAnchors) !== JSON.stringify(selectedRegion.loreBookAnchors ?? []) ||
      localDescription !== ((selectedRegion.loreBookDescription ?? selectedRegion.description)?.trim() ?? ''))

  return (
    <Stack gap="xl">
      <Text size="sm" c="dimmed">
        Edit page breaks per region, then export. Page breaks use anchors that survive re-imports when the text still matches.
      </Text>

      <Paper p="md" withBorder>
        <Text size="sm" fw={600} mb="sm">
          Edit Page Breaks
        </Text>
        <Group align="flex-start" gap="xl" wrap="wrap">
          <Stack gap="xs" miw={200}>
            <Text size="xs" fw={600} c="dimmed">
              Select region
            </Text>
            <Select
              placeholder="Pick a region..."
              data={regionsWithDescription.map((r) => ({
                value: r.id,
                label: formatRegionLabel(r),
              }))}
              value={selectedRegionId}
              onChange={(v) => setSelectedRegionId(v)}
              clearable
            />
            {selectedRegion && (
              <>
                <Button
                  size="sm"
                  variant="light"
                  onClick={handleSave}
                  loading={isSaving}
                  disabled={!hasChanges}
                >
                  Save changes
                </Button>
                {hasChanges && (
                  <Text size="xs" c="yellow.7">
                    Unsaved changes
                  </Text>
                )}
              </>
            )}
          </Stack>
          {selectedRegion && (selectedRegion.loreBookDescription ?? selectedRegion.description)?.trim() && (
            <LoreBookPreview
              content={localDescription}
              anchors={localAnchors}
              onAnchorsChange={setLocalAnchors}
              onDescriptionChange={setLocalDescription}
              regionId={selectedRegion.id}
              regionTitle={selectedRegion.discover.displayNameOverride}
            />
          )}
        </Group>
        {!hasRegions && (
          <Alert color="yellow" title="No descriptions" mt="md">
            No regions have descriptions. Add descriptions in the Regions tab, or import from a regions-meta file.
          </Alert>
        )}
      </Paper>

      <Divider />

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Export Lore Books
        </Text>
        <Text size="xs" c="dimmed">
          Regions with descriptions: <Text component="span" fw={700}>{regionsWithDescription.length}</Text>
          {regionsWithDescription.some((r) => r.loreBookAnchors?.length) && (
            <> · {regionsWithDescription.filter((r) => r.loreBookAnchors?.length).length} with custom page breaks</>
          )}
        </Text>
      </Stack>

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Output Directory <Text component="span" c="red">*</Text>
        </Text>
        <Group gap="sm">
          <TextInput value={outDir} placeholder="Select output directory..." readOnly flex={1} />
          <Button variant="default" onClick={handleSelectOutputDir}>
            Browse...
          </Button>
        </Group>
      </Stack>

      <Stack gap="xs">
        <Text size="sm" fw={600}>Author</Text>
        <TextInput
          value={author}
          onChange={(e) => setAuthor(e.currentTarget.value)}
          placeholder="Admin"
        />
      </Stack>

      <Button
        onClick={handleExport}
        loading={isExporting}
        disabled={!hasRegions}
      >
        Export Lore Books
      </Button>

      {result && (
        <Alert
          color={result.success ? 'green' : 'red'}
          title={result.success ? '✓ Export successful!' : '✗ Export failed'}
        >
          {result.success ? (
            <Text size="sm">
              Exported {result.count} lore book{result.count === 1 ? '' : 's'} to {outDir}
            </Text>
          ) : (
            result.error && <Text size="sm">{result.error}</Text>
          )}
        </Alert>
      )}
    </Stack>
  )
}
