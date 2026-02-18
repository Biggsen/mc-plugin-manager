import { useState } from 'react'
import {
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Alert,
} from '@mantine/core'
import type { ServerProfile } from '../types'

interface LoreBooksScreenProps {
  server: ServerProfile
}

export function LoreBooksScreen({ server }: LoreBooksScreenProps) {
  const [outDir, setOutDir] = useState('')
  const [author, setAuthor] = useState('Admin')
  const [isExporting, setIsExporting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null)

  const regionsWithDescription = server.regions.filter((r) => r.description?.trim())
  const hasRegions = regionsWithDescription.length > 0

  async function handleSelectOutputDir() {
    const path = await window.electronAPI.showOutputDialog()
    if (path) {
      setOutDir(path)
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

  return (
    <Stack gap="xl">
      <Text size="sm" c="dimmed">
        Export region descriptions as in-game lore book YAML files. Each region with a description becomes a{' '}
        <Text component="code" fw={500}>[region].yml</Text> file.
      </Text>

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Regions with descriptions: <Text component="span" fw={700}>{regionsWithDescription.length}</Text>
        </Text>
        {!hasRegions && (
          <Alert color="yellow" title="No descriptions">
            No regions have descriptions. Add descriptions in the Regions tab, or import from a regions-meta file that includes them.
          </Alert>
        )}
      </Stack>

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Output Directory <Text component="span" c="red">*</Text>
        </Text>
        <Group gap="sm">
          <TextInput
            value={outDir}
            placeholder="Select output directory..."
            readOnly
            flex={1}
          />
          <Button variant="default" onClick={handleSelectOutputDir}>
            Browse...
          </Button>
        </Group>
      </Stack>

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Author
        </Text>
        <TextInput
          value={author}
          onChange={(e) => setAuthor(e.currentTarget.value)}
          placeholder="Admin"
        />
        <Text size="xs" c="dimmed">
          Default: Admin. Set the author field for all exported books.
        </Text>
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
