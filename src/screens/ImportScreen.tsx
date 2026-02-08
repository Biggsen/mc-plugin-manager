import { useState } from 'react'
import { Title, Text, Button, Group, Stack, Paper, Alert } from '@mantine/core'
import type { ServerProfile, ImportResult } from '../types'

interface ImportScreenProps {
  server: ServerProfile
  onServerUpdate: (server: ServerProfile) => void
}

export function ImportScreen({ server, onServerUpdate }: ImportScreenProps) {
  const [isImportingOverworld, setIsImportingOverworld] = useState(false)
  const [isImportingNether, setIsImportingNether] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  async function handleImportOverworldRegionsMeta() {
    setIsImportingOverworld(true)
    setImportResult(null)

    try {
      // Show file dialog
      const filePath = await window.electronAPI.showImportDialog()
      if (!filePath) {
        setIsImportingOverworld(false)
        return
      }

      // Import overworld regions-meta
      const result = await window.electronAPI.importRegionsMeta(server.id, 'overworld', filePath)
      setImportResult(result)

      if (result.success) {
        // Reload server to get updated data
        const updated = await window.electronAPI.getServer(server.id)
        if (updated) {
          onServerUpdate(updated)
        }
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        error: error.message || 'Unknown error during import',
      })
    } finally {
      setIsImportingOverworld(false)
    }
  }

  async function handleImportNetherRegionsMeta() {
    setIsImportingNether(true)
    setImportResult(null)

    try {
      // Show file dialog
      const filePath = await window.electronAPI.showImportDialog()
      if (!filePath) {
        setIsImportingNether(false)
        return
      }

      // Import nether regions-meta
      const result = await window.electronAPI.importRegionsMeta(server.id, 'nether', filePath)
      setImportResult(result)

      if (result.success) {
        // Reload server to get updated data
        const updated = await window.electronAPI.getServer(server.id)
        if (updated) {
          onServerUpdate(updated)
        }
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        error: error.message || 'Unknown error during import',
      })
    } finally {
      setIsImportingNether(false)
    }
  }

  const overworldSource = server.sources.overworld || server.sources.world
  const netherSource = server.sources.nether
  const hasImportedOverworld = !!overworldSource
  const hasImportedNether = !!netherSource

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Import regions-meta.yml from Region Forge to populate your server profile with region data, onboarding, spawn center, and LevelledMobs metadata.
      </Text>

      <Stack gap="md">
        <Paper p="lg" withBorder>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={4}>
              <Title order={3}>Overworld Regions Meta</Title>
              {hasImportedOverworld && overworldSource && (
                <Text size="sm" c="dimmed">
                  Imported: {overworldSource.originalFilename}
                  <br />
                  <Text component="span" size="xs">
                    {new Date(overworldSource.importedAtIso || '').toLocaleString()}
                  </Text>
                </Text>
              )}
            </Stack>
            <Button
              onClick={handleImportOverworldRegionsMeta}
              loading={isImportingOverworld}
              disabled={isImportingNether}
            >
              {hasImportedOverworld ? 'Re-import' : 'Import overworld regions-meta'}
            </Button>
          </Group>
        </Paper>

        <Paper p="lg" withBorder>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={4}>
              <Title order={3}>Nether Regions Meta</Title>
              {hasImportedNether && netherSource && (
                <Text size="sm" c="dimmed">
                  Imported: {netherSource.originalFilename}
                  <br />
                  <Text component="span" size="xs">
                    {new Date(netherSource.importedAtIso || '').toLocaleString()}
                  </Text>
                </Text>
              )}
            </Stack>
            <Button
              onClick={handleImportNetherRegionsMeta}
              loading={isImportingNether}
              disabled={isImportingOverworld}
            >
              {hasImportedNether ? 'Re-import' : 'Import nether regions-meta'}
            </Button>
          </Group>
        </Paper>
      </Stack>

      {importResult && (
        <Alert
          color={importResult.success ? 'green' : 'red'}
          title={importResult.success ? '✓ Import successful!' : '✗ Import failed'}
        >
          {importResult.success ? (
            importResult.regionCount !== undefined && (
              <Text size="sm">Imported {importResult.regionCount} region(s).</Text>
            )
          ) : (
            importResult.error && <Text size="sm">{importResult.error}</Text>
          )}
        </Alert>
      )}
    </Stack>
  )
}
