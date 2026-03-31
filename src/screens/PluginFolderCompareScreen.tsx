import { Fragment, useEffect, useState } from 'react'
import {
  Title,
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Paper,
  Alert,
  Badge,
  ScrollArea,
  Table,
  Box,
  Select,
  Modal,
} from '@mantine/core'
import { IconFolder, IconGitCompare, IconTrash, IconDeviceFloppy, IconRefresh } from '@tabler/icons-react'
import type {
  ComparePreset,
  PluginFolderCompareFileResult,
  PluginFolderCompareResult,
} from '../types'

interface PluginFolderCompareScreenProps {
  onBack: () => void
}

function statusLabel(status: PluginFolderCompareFileResult['status']): string {
  switch (status) {
    case 'identical':
      return 'Identical'
    case 'different':
      return 'Different'
    case 'missing_left':
      return 'Missing (left)'
    case 'missing_right':
      return 'Missing (right)'
    case 'missing_both':
      return 'Missing (both)'
    case 'read_error':
      return 'Error'
    default:
      return status
  }
}

function statusColor(status: PluginFolderCompareFileResult['status']): string {
  switch (status) {
    case 'identical':
      return 'green'
    case 'different':
      return 'yellow'
    case 'missing_left':
    case 'missing_right':
      return 'blue'
    case 'missing_both':
      return 'gray'
    case 'read_error':
      return 'red'
    default:
      return 'gray'
  }
}

type SplitDiffRow =
  | {
      kind: 'hunk'
      text: string
    }
  | {
      kind: 'code'
      leftLine: number | null
      leftText: string
      leftType: 'context' | 'remove' | 'empty'
      rightLine: number | null
      rightText: string
      rightType: 'context' | 'add' | 'empty'
    }

function parseUnifiedPatchToSplitRows(patch: string): SplitDiffRow[] {
  const rows: SplitDiffRow[] = []
  const lines = patch.split(/\r?\n/)
  let inHunk = false
  let leftLine = 0
  let rightLine = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('@@')) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (m) {
        leftLine = Number(m[1])
        rightLine = Number(m[2])
      }
      inHunk = true
      rows.push({ kind: 'hunk', text: line })
      continue
    }

    if (!inHunk) continue
    if (!line || line.startsWith('Index:') || line.startsWith('diff ') || line.startsWith('---') || line.startsWith('+++')) {
      continue
    }
    if (line.startsWith('\\')) continue

    if (line.startsWith(' ')) {
      const text = line.slice(1)
      rows.push({
        kind: 'code',
        leftLine,
        leftText: text,
        leftType: 'context',
        rightLine,
        rightText: text,
        rightType: 'context',
      })
      leftLine++
      rightLine++
      continue
    }

    if (line.startsWith('-')) {
      rows.push({
        kind: 'code',
        leftLine,
        leftText: line.slice(1),
        leftType: 'remove',
        rightLine: null,
        rightText: '',
        rightType: 'empty',
      })
      leftLine++
      continue
    }

    if (line.startsWith('+')) {
      rows.push({
        kind: 'code',
        leftLine: null,
        leftText: '',
        leftType: 'empty',
        rightLine,
        rightText: line.slice(1),
        rightType: 'add',
      })
      rightLine++
    }
  }

  return rows
}

/** Renders split (side-by-side) diff from a unified patch payload. */
function SplitDiffView({ patch }: { patch: string }) {
  const rows = parseUnifiedPatchToSplitRows(patch)
  return (
    <Box
      p="md"
      style={{
        backgroundColor: '#1e1e2e',
        borderRadius: 8,
        border: '1px solid #313244',
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      {rows.map((row, i) => {
        const key = `diff-${i}`
        if (row.kind === 'hunk') {
          return (
            <Box
              key={key}
              py={2}
              px={8}
              style={{
                backgroundColor: 'rgba(137, 180, 250, 0.22)',
                color: '#89b4fa',
                borderLeft: '3px solid #89b4fa',
              }}
            >
              {row.text}
            </Box>
          )
        }
        const leftBg =
          row.leftType === 'remove'
            ? 'rgba(243, 139, 168, 0.18)'
            : row.leftType === 'context'
              ? 'transparent'
              : 'rgba(108, 112, 134, 0.10)'
        const rightBg =
          row.rightType === 'add'
            ? 'rgba(166, 227, 161, 0.16)'
            : row.rightType === 'context'
              ? 'transparent'
              : 'rgba(108, 112, 134, 0.10)'

        return (
          <Box key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <Box
              py={2}
              px={8}
              style={{
                backgroundColor: leftBg,
                borderRight: '1px solid #313244',
                color: row.leftType === 'remove' ? '#f5c2e0' : '#cdd6f4',
                display: 'grid',
                gridTemplateColumns: '56px minmax(0, 1fr)',
                gap: 8,
              }}
            >
              <Text size="xs" c="dimmed" ff="monospace">
                {row.leftLine ?? ''}
              </Text>
              <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap' }}>
                {row.leftText || ' '}
              </Text>
            </Box>
            <Box
              py={2}
              px={8}
              style={{
                backgroundColor: rightBg,
                color: row.rightType === 'add' ? '#c8f5c9' : '#cdd6f4',
                display: 'grid',
                gridTemplateColumns: '56px minmax(0, 1fr)',
                gap: 8,
              }}
            >
              <Text size="xs" c="dimmed" ff="monospace">
                {row.rightLine ?? ''}
              </Text>
              <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap' }}>
                {row.rightText || ' '}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

export function PluginFolderCompareScreen({ onBack }: PluginFolderCompareScreenProps) {
  const [leftPath, setLeftPath] = useState('')
  const [rightPath, setRightPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PluginFolderCompareResult | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [presets, setPresets] = useState<ComparePreset[]>([])
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [presetName, setPresetName] = useState('')
  const [presetBusy, setPresetBusy] = useState(false)
  const [presetMessage, setPresetMessage] = useState<string | null>(null)
  const [deletePreset, setDeletePreset] = useState<ComparePreset | null>(null)

  async function loadPresets() {
    try {
      const list = await window.electronAPI.listComparePresets()
      setPresets(list)
    } catch (e) {
      console.error(e)
    } finally {
      setPresetsLoading(false)
    }
  }

  useEffect(() => {
    loadPresets()
  }, [])

  async function pickLeft() {
    const p = await window.electronAPI.showFolderDialog(
      'Select plugins folder (left / first tree)',
      leftPath || undefined
    )
    if (p) setLeftPath(p)
  }

  async function pickRight() {
    const p = await window.electronAPI.showFolderDialog(
      'Select plugins folder (right / second tree)',
      rightPath || undefined
    )
    if (p) setRightPath(p)
  }

  async function runCompare() {
    setError(null)
    setResult(null)
    setExpandedId(null)
    setLoading(true)
    try {
      const res = await window.electronAPI.comparePluginFolders(leftPath.trim(), rightPath.trim())
      if (!res.ok) {
        setError(res.error)
        return
      }
      setResult(res.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function applyPresetSelection(id: string | null) {
    setSelectedPresetId(id)
    if (!id) return
    const p = presets.find((x) => x.id === id)
    if (p) {
      setLeftPath(p.leftPath)
      setRightPath(p.rightPath)
      setPresetName(p.name)
    }
  }

  async function handleSaveNewPreset() {
    setPresetMessage(null)
    setPresetBusy(true)
    try {
      const res = await window.electronAPI.saveComparePreset({
        name: presetName,
        leftPath,
        rightPath,
      })
      if (!res.ok) {
        setPresetMessage(res.error)
        return
      }
      await loadPresets()
      setSelectedPresetId(res.preset.id)
      setPresetMessage(`Saved "${res.preset.name}"`)
    } catch (e) {
      setPresetMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setPresetBusy(false)
    }
  }

  async function handleUpdatePreset() {
    if (!selectedPresetId) return
    setPresetMessage(null)
    setPresetBusy(true)
    try {
      const res = await window.electronAPI.updateComparePreset({
        id: selectedPresetId,
        name: presetName,
        leftPath,
        rightPath,
      })
      if (!res.ok) {
        setPresetMessage(res.error)
        return
      }
      await loadPresets()
      setPresetMessage(`Updated "${res.preset.name}"`)
    } catch (e) {
      setPresetMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setPresetBusy(false)
    }
  }

  async function confirmDeletePreset() {
    if (!deletePreset) return
    setPresetBusy(true)
    setPresetMessage(null)
    try {
      const res = await window.electronAPI.deleteComparePreset(deletePreset.id)
      if (!res.ok) {
        setPresetMessage(res.error)
        return
      }
      if (selectedPresetId === deletePreset.id) {
        setSelectedPresetId(null)
      }
      setDeletePreset(null)
      await loadPresets()
      setPresetMessage('Preset removed')
    } catch (e) {
      setPresetMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setPresetBusy(false)
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1} mb={4}>
            Compare plugin folders
          </Title>
          <Text size="sm" c="dimmed">
            Compare only files Plugin Manager generates (propagated plugin paths). Point each side at a
            plugins root (the folder that contains AdvancedAchievements, TAB, etc.).
          </Text>
        </div>
        <Button variant="default" onClick={onBack}>
          Back to servers
        </Button>
      </Group>

      <Modal
        opened={deletePreset !== null}
        onClose={() => !presetBusy && setDeletePreset(null)}
        title="Delete saved preset"
      >
        <Stack gap="md">
          <Text size="sm">
            Remove &quot;{deletePreset?.name}&quot;? This only deletes the saved path pair, not any files on disk.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeletePreset(null)} disabled={presetBusy}>
              Cancel
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} onClick={confirmDeletePreset} loading={presetBusy}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb={4}>
              Saved presets
            </Text>
            <Text size="xs" c="dimmed" mb={6}>
              Load a saved left/right pair or save the current paths for next time.
            </Text>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <Select
                style={{ flex: 1 }}
                placeholder="Choose a saved pair…"
                clearable
                disabled={presetsLoading}
                data={presets.map((p) => ({ value: p.id, label: p.name }))}
                value={selectedPresetId}
                onChange={(v) => applyPresetSelection(v)}
              />
              <Button
                variant="default"
                color="red"
                leftSection={<IconTrash size={16} />}
                disabled={!selectedPresetId || presetBusy}
                onClick={() => {
                  const p = presets.find((x) => x.id === selectedPresetId)
                  if (p) setDeletePreset(p)
                }}
              >
                Delete
              </Button>
            </Group>
          </div>

          <div>
            <Text size="sm" fw={500} mb={4}>
              Preset name
            </Text>
            <Group gap="xs" align="flex-end" wrap="wrap">
              <TextInput
                style={{ flex: '1 1 200px' }}
                placeholder="e.g. Live vs staging plugins"
                value={presetName}
                onChange={(e) => setPresetName(e.currentTarget.value)}
              />
              <Button
                variant="light"
                leftSection={<IconDeviceFloppy size={16} />}
                loading={presetBusy}
                disabled={!leftPath.trim() || !rightPath.trim() || !presetName.trim()}
                onClick={handleSaveNewPreset}
              >
                Save as new
              </Button>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                loading={presetBusy}
                disabled={!selectedPresetId || !leftPath.trim() || !rightPath.trim() || !presetName.trim()}
                onClick={handleUpdatePreset}
              >
                Update selected
              </Button>
            </Group>
          </div>

          {presetMessage && (
            <Text
              size="sm"
              c={
                presetMessage.startsWith('Saved') ||
                presetMessage.startsWith('Updated') ||
                presetMessage === 'Preset removed'
                  ? 'teal'
                  : 'red'
              }
            >
              {presetMessage}
            </Text>
          )}

          <div>
            <Text size="sm" fw={500} mb={4}>
              Left folder
            </Text>
            <Text size="xs" c="dimmed" mb={6}>
              First plugins tree
            </Text>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                placeholder="Path…"
                value={leftPath}
                onChange={(e) => setLeftPath(e.currentTarget.value)}
              />
              <Button variant="default" leftSection={<IconFolder size={16} />} onClick={pickLeft}>
                Browse
              </Button>
            </Group>
          </div>
          <div>
            <Text size="sm" fw={500} mb={4}>
              Right folder
            </Text>
            <Text size="xs" c="dimmed" mb={6}>
              Second plugins tree
            </Text>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                placeholder="Path…"
                value={rightPath}
                onChange={(e) => setRightPath(e.currentTarget.value)}
              />
              <Button variant="default" leftSection={<IconFolder size={16} />} onClick={pickRight}>
                Browse
              </Button>
            </Group>
          </div>
          <Group>
            <Button
              leftSection={<IconGitCompare size={16} />}
              onClick={runCompare}
              loading={loading}
              disabled={!leftPath.trim() || !rightPath.trim()}
            >
              Compare
            </Button>
          </Group>
        </Stack>
      </Paper>

      {error && (
        <Alert color="red" title="Compare failed">
          {error}
        </Alert>
      )}

      {result?.bookGuiWarning && (
        <Alert color="yellow" title="BookGUI">
          {result.bookGuiWarning}
        </Alert>
      )}

      {result && (
        <Stack gap="sm">
          <Group gap="xs">
            <Badge color="green" variant="light">
              Identical: {result.summary.identical}
            </Badge>
            <Badge color="yellow" variant="light">
              Different: {result.summary.different}
            </Badge>
            <Badge color="blue" variant="light">
              Only left: {result.summary.missingRight}
            </Badge>
            <Badge color="blue" variant="light">
              Only right: {result.summary.missingLeft}
            </Badge>
            <Badge color="gray" variant="light">
              Neither: {result.summary.missingBoth}
            </Badge>
            {result.summary.readErrors > 0 && (
              <Badge color="red" variant="light">
                Errors: {result.summary.readErrors}
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            Left: {result.leftRoot} — Right: {result.rightRoot}
          </Text>

          <ScrollArea.Autosize mah={560}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Plugin / file</Table.Th>
                  <Table.Th>Relative path</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.files.map((row) => (
                  <Fragment key={row.id}>
                    <Table.Tr
                      style={{ cursor: row.unifiedDiff ? 'pointer' : undefined }}
                      onClick={() => {
                        if (row.unifiedDiff) {
                          setExpandedId((id) => (id === row.id ? null : row.id))
                        }
                      }}
                    >
                      <Table.Td>{row.label}</Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {row.relativePath}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Badge color={statusColor(row.status)} variant="light">
                            {statusLabel(row.status)}
                          </Badge>
                          {row.error && (
                            <Text size="xs" c="red">
                              {row.error}
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                    {expandedId === row.id && row.unifiedDiff && (
                      <Table.Tr>
                        <Table.Td colSpan={3} style={{ verticalAlign: 'top', background: 'var(--mantine-color-body)' }}>
                          <ScrollArea.Autosize mah={420} type="auto">
                            <SplitDiffView patch={row.unifiedDiff} />
                          </ScrollArea.Autosize>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Fragment>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
          {result.files.some((f) => f.unifiedDiff) && (
            <Text size="xs" c="dimmed">
              Click a row with status &quot;Different&quot; to show a split diff.
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  )
}
