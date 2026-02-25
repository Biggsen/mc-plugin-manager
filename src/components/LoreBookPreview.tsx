import { useCallback, useMemo, useState } from 'react'
import { Stack, Text, Box, Button, Group, Textarea, SegmentedControl } from '@mantine/core'

const ANCHOR_LENGTH = 24

interface LoreBookPreviewProps {
  content: string
  anchors: string[]
  onAnchorsChange: (anchors: string[]) => void
  onDescriptionChange: (description: string) => void
  regionId?: string
  regionTitle?: string
}

function formatRegionTitle(id: string): string {
  return id
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
}

export function LoreBookPreview({
  content: rawContent,
  anchors,
  onAnchorsChange,
  onDescriptionChange,
  regionId,
  regionTitle,
}: LoreBookPreviewProps) {
  const [mode, setMode] = useState<'edit' | 'pageBreak'>('edit')
  const content = rawContent.trim()
  const expanded = content

  const segments = useMemo(() => {
    if (anchors.length === 0) return [{ text: expanded, isBreak: false, anchorIndex: -1 }]
    const result: { text: string; isBreak: boolean; anchorIndex: number }[] = []
    let remaining = expanded
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i]
      const searchIdx = remaining.indexOf(anchor)
      if (searchIdx === -1) continue
      const cut = searchIdx + anchor.length
      result.push({ text: remaining.slice(0, cut).trim(), isBreak: false, anchorIndex: -1 })
      result.push({ text: '', isBreak: true, anchorIndex: i })
      remaining = remaining.slice(cut).trimStart()
    }
    if (remaining.length > 0) result.push({ text: remaining, isBreak: false, anchorIndex: -1 })
    return result
  }, [expanded, anchors])

  const tokens = useMemo(() => {
    const result: { text: string; offsetEnd: number }[] = []
    let pos = 0
    const re = /(\s+|\S+)/g
    let m
    while ((m = re.exec(expanded)) !== null) {
      result.push({ text: m[0], offsetEnd: pos + m[0].length })
      pos += m[0].length
    }
    return result
  }, [expanded])

  const addBreakAtOffset = useCallback(
    (offsetEnd: number) => {
      const textBefore = expanded.slice(0, offsetEnd)
      const normalized = textBefore.replace(/\n\n\n/g, '\n\n').trim()
      if (normalized.length < 4) return
      const len = Math.min(ANCHOR_LENGTH, normalized.length)
      const phrase = normalized.slice(-len)
      if (anchors.includes(phrase)) return
      onAnchorsChange([...anchors, phrase])
    },
    [expanded, anchors, onAnchorsChange]
  )

  const removeBreak = useCallback(
    (anchorIndex: number) => {
      onAnchorsChange(anchors.filter((_, i) => i !== anchorIndex))
    },
    [anchors, onAnchorsChange]
  )

  const bookStyle = {
    fontFamily: "'Minecraft Book', 'Press Start 2P', monospace",
    fontSize: 31,
    lineHeight: 0.8,
    backgroundColor: '#f4e4bc',
    border: '3px solid #8B4513',
    borderRadius: 4,
    padding: 20,
    maxWidth: 360,
    minHeight: 360,
    color: '#1a1a1a',
    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1), 2px 2px 8px rgba(0,0,0,0.3)',
  }

  return (
    <Stack gap="md">
      <SegmentedControl
        value={mode}
        onChange={(v) => setMode(v as 'edit' | 'pageBreak')}
        fullWidth
        data={[
          { value: 'edit', label: 'Edit content' },
          { value: 'pageBreak', label: 'Select page end' },
        ]}
      />

      {mode === 'edit' ? (
        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            Edit text and line breaks
          </Text>
          <Textarea
            value={content}
            onChange={(e) => onDescriptionChange(e.currentTarget.value)}
            minRows={12}
            maxRows={20}
            autosize
            styles={{
              input: {
                fontFamily: "'Minecraft Book', 'Press Start 2P', monospace",
                fontSize: 24,
                lineHeight: 1,
              },
            }}
          />
        </Box>
      ) : (
        <Box style={bookStyle}>
          <Text size="xs" c="dimmed" ta="right" mb="xs" className="lore-book-inherit">
            {regionTitle || (regionId ? formatRegionTitle(regionId) : '')}
          </Text>
          <Text size="xs" c="yellow.7" mb="xs" className="lore-book-inherit">
            Click a word to insert a page break after it
          </Text>
          <Stack className="pageBack lore-book-inherit lore-book-overflow-hidden" gap={0}>
            {segments.map((seg, i) =>
              seg.isBreak ? (
                <Box key={`break-${i}`} py="xs" mt="xs" mb="xs" className="lore-book-break">
                  <Group justify="center" gap="xs">
                    <Text size="xs" c="dark.4" className="lore-book-inherit">
                      Page break
                    </Text>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={() => removeBreak(seg.anchorIndex)}
                    >
                      Remove
                    </Button>
                  </Group>
                </Box>
              ) : (
                <ClickableTextBlock
                  key={i}
                  text={seg.text}
                  expanded={expanded}
                  tokens={tokens}
                  onAddBreak={addBreakAtOffset}
                  bookStyle={bookStyle}
                />
              )
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  )
}

function ClickableTextBlock({
  text,
  expanded,
  tokens,
  onAddBreak,
  bookStyle,
}: {
  text: string
  expanded: string
  tokens: { text: string; offsetEnd: number }[]
  onAddBreak: (offsetEnd: number) => void
  bookStyle: React.CSSProperties
}) {
  const startIdx = expanded.indexOf(text)
  if (startIdx === -1) {
    return (
      <Text style={bookStyle} className="pre-wrap">
        {text}
      </Text>
    )
  }
  const endIdx = startIdx + text.length
  const relevantTokens = tokens.filter((t) => t.offsetEnd > startIdx && t.offsetEnd <= endIdx)

  return (
    <Box component="span" className="pageBack lore-book-text">
      {relevantTokens.map((t, i) => (
        <span
          key={i}
          className="lore-book-word"
          onClick={() => onAddBreak(t.offsetEnd)}
          title="Click to insert page break after this word"
        >
          {t.text}
        </span>
      ))}
    </Box>
  )
}
