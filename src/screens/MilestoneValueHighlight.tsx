import { Group, Text } from '@mantine/core'

export function MilestoneValueHighlight({
  label,
  value,
  size = 'slot',
}: {
  label: string
  value: string
  size?: 'total' | 'slot'
}) {
  const isTotal = size === 'total'
  return (
    <Group gap={6} wrap="nowrap" align="baseline">
      <Text size="xs" c="dimmed" fw={500}>
        {label}
      </Text>
      <Text
        size={isTotal ? 'lg' : 'sm'}
        fw={700}
        c="gray.0"
        style={{ letterSpacing: isTotal ? '0.02em' : undefined }}
      >
        {value}
      </Text>
    </Group>
  )
}
