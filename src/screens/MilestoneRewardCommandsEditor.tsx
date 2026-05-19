import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionIcon, Group, Paper, Select, Stack, Text, Textarea } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { ceRewardUnitBuy } from '@shared/ceRewardValue'
import type { AAMilestoneReward, CeRewardCatalogEntry, ItemIndexEntry } from '../types'
import { formatMilestoneValue } from './milestoneRewardValue'
import {
  ceCallExecuteLine,
  extractCeCallToken,
  labelFromCeCallToken,
  rewardDisplayFromCeExecuteLine,
} from '@shared/ceRewardTokens'

function parseCommandState(
  execute: string[] | undefined,
  catalogByToken: Map<string, CeRewardCatalogEntry>
): { tokens: string[]; otherLines: string[] } {
  const tokens: string[] = []
  const otherLines: string[] = []
  for (const line of execute ?? []) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const token = extractCeCallToken(trimmed)
    if (token && (catalogByToken.has(token) || token.startsWith('get_book_') || token.startsWith('get_potion_'))) {
      if (!tokens.includes(token)) tokens.push(token)
    } else {
      otherLines.push(trimmed)
    }
  }
  return { tokens, otherLines }
}

function parseOtherCommandLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/** Stable key for comparing saved command vs last emit (avoids reference-equality hydration bugs). */
export function commandSnapshot(command: AAMilestoneReward['command'] | undefined): string {
  return JSON.stringify({
    execute: command?.execute ?? [],
    display: command?.display ?? '',
  })
}

function buildCommandPayload(
  tokens: string[],
  otherLines: string[],
  catalogByToken: Map<string, CeRewardCatalogEntry>
): AAMilestoneReward['command'] | undefined {
  const execute = [
    ...tokens.map((t) => catalogByToken.get(t)?.executeLine ?? ceCallExecuteLine(t)),
    ...otherLines.map((l) => l.trim()).filter(Boolean),
  ]
  if (execute.length === 0) return undefined
  const displayParts: string[] = []
  for (const line of execute) {
    const d = rewardDisplayFromCeExecuteLine(line)
    if (d) displayParts.push(d)
  }
  const display = displayParts.length > 0 ? displayParts.join(' and ') : undefined
  return { execute, display }
}

interface MilestoneRewardCommandsEditorProps {
  command: AAMilestoneReward['command']
  itemsIndex: ItemIndexEntry[]
  onChange: (command: AAMilestoneReward['command'] | undefined) => void
}

export function MilestoneRewardCommandsEditor({
  command,
  itemsIndex,
  onChange,
}: MilestoneRewardCommandsEditorProps) {
  const [catalog, setCatalog] = useState<CeRewardCatalogEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedTokens, setSelectedTokens] = useState<string[]>([])
  const [otherCommandsText, setOtherCommandsText] = useState('')
  const lastEmittedSnapshotRef = useRef<string>('')
  const catalogHydratedRef = useRef(false)

  const catalogByToken = useMemo(() => {
    const m = new Map<string, CeRewardCatalogEntry>()
    for (const e of catalog) m.set(e.token, e)
    return m
  }, [catalog])

  const unitBuyById = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of itemsIndex) {
      if (typeof it.unitBuy === 'number' && Number.isFinite(it.unitBuy)) {
        m.set(it.id, it.unitBuy)
      }
    }
    return (id: string) => m.get(id)
  }, [itemsIndex])

  const enchantOptions = useMemo(
    () =>
      catalog
        .filter((e) => e.kind === 'enchantment')
        .map((e) => ({ value: e.token, label: e.label })),
    [catalog]
  )

  const potionOptions = useMemo(
    () =>
      catalog
        .filter((e) => e.kind === 'potion')
        .map((e) => ({ value: e.token, label: e.label })),
    [catalog]
  )

  useEffect(() => {
    void window.electronAPI
      .listCeRewardCatalog()
      .then(setCatalog)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  function hydrateFromCommand(cmd: AAMilestoneReward['command'] | undefined) {
    const parsed = parseCommandState(cmd?.execute, catalogByToken)
    setSelectedTokens(parsed.tokens)
    setOtherCommandsText(parsed.otherLines.join('\n'))
  }

  useEffect(() => {
    if (catalog.length === 0) return
    const snap = commandSnapshot(command)
    const isEchoFromEmit = snap === lastEmittedSnapshotRef.current
    const needsInitialCatalogHydration = !catalogHydratedRef.current
    if (isEchoFromEmit && !needsInitialCatalogHydration) return

    catalogHydratedRef.current = true
    lastEmittedSnapshotRef.current = snap
    hydrateFromCommand(command)
  }, [command, catalog, catalogByToken])

  function emit(tokens: string[], otherText: string) {
    const next = buildCommandPayload(tokens, parseOtherCommandLines(otherText), catalogByToken)
    lastEmittedSnapshotRef.current = commandSnapshot(next)
    onChange(next)
  }

  function addToken(token: string | null) {
    if (!token || selectedTokens.includes(token)) return
    const next = [...selectedTokens, token]
    setSelectedTokens(next)
    emit(next, otherCommandsText)
  }

  function removeToken(token: string) {
    const next = selectedTokens.filter((t) => t !== token)
    setSelectedTokens(next)
    emit(next, otherCommandsText)
  }

  function labelForToken(token: string): string {
    return catalogByToken.get(token)?.label ?? labelFromCeCallToken(token) ?? token
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Commands
      </Text>
      {loadError && (
        <Text size="xs" c="red">
          {loadError}
        </Text>
      )}
      <Group grow align="flex-end" wrap="nowrap">
        <Select
          label="Enchantments"
          placeholder="Add enchantment book…"
          data={enchantOptions}
          value={null}
          searchable
          clearable
          size="xs"
          onChange={addToken}
        />
        <Select
          label="Potions"
          placeholder="Add potion…"
          data={potionOptions}
          value={null}
          searchable
          clearable
          size="xs"
          onChange={addToken}
        />
      </Group>

      <Paper withBorder p="xs">
        <Stack gap={4}>
          {selectedTokens.length === 0 && otherCommandsText.trim() === '' && (
            <Text size="sm" c="dimmed">
              No commands added. Use the dropdowns for CE enchant books and potions.
            </Text>
          )}
          {selectedTokens.map((token) => {
            const lineValue = ceRewardUnitBuy(token, unitBuyById)
            return (
            <Group key={token} justify="space-between" wrap="nowrap">
              <Text size="sm" style={{ flex: 1 }} lineClamp={1}>
                {labelForToken(token)}
              </Text>
              {lineValue !== undefined && (
                <Text size="xs" c="dimmed" w={56} ta="right">
                  {formatMilestoneValue(lineValue)}
                </Text>
              )}
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={() => removeToken(token)}
                aria-label={`Remove ${labelForToken(token)}`}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
            )
          })}
        </Stack>
      </Paper>

      <Textarea
        label="Other commands (one per line; use PLAYER)"
        description="Claimblocks, LuckPerms, or other CE calls not in the lists above"
        minRows={3}
        autosize
        size="xs"
        value={otherCommandsText}
        onChange={(e) => {
          const text = e.currentTarget.value
          setOtherCommandsText(text)
          emit(selectedTokens, text)
        }}
      />
    </Stack>
  )
}
