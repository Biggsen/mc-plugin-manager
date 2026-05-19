import { Divider, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import {
  formatExperience,
  formatSlotValue,
  formatSummaryList,
  type MilestoneCategorySummary,
} from './milestoneRewardSummary'
import { formatMilestoneValue } from './milestoneRewardValue'
import { MilestoneValueHighlight } from './MilestoneValueHighlight'

interface MilestoneCategorySummaryCardsProps {
  summaries: MilestoneCategorySummary[]
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={600}>
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  )
}

export function MilestoneCategorySummaryCards({ summaries }: MilestoneCategorySummaryCardsProps) {
  if (summaries.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No milestone rewards configured in this profile yet.
      </Text>
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
      {summaries.map((category) => (
          <Paper key={category.categoryKey} withBorder p="md" radius="md">
            <Group justify="space-between" mb="sm" wrap="nowrap">
              <Text fw={600} size="sm">
                {category.categoryLabel}
              </Text>
              <MilestoneValueHighlight
                label="Total"
                value={category.totalValue !== null ? formatMilestoneValue(category.totalValue) : '—'}
                size="total"
              />
            </Group>

            <Stack gap="md">
              {category.slots.map((slot, idx) => (
                <Stack key={slot.slotKey} gap="xs">
                  {idx > 0 && <Divider />}
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" fw={500}>
                      {slot.slotLabel}
                    </Text>
                    <MilestoneValueHighlight label="Value" value={formatSlotValue(slot.value)} />
                  </Group>
                  <SimpleGrid cols={2} spacing="xs" verticalSpacing="xs">
                    <SummaryField label="XP" value={formatExperience(slot.experience)} />
                    <SummaryField label="Items" value={formatSummaryList(slot.items)} />
                    <SummaryField label="Enchantments" value={formatSummaryList(slot.enchantments)} />
                    <SummaryField label="Potions" value={formatSummaryList(slot.potions)} />
                  </SimpleGrid>
                  {slot.otherCommands.length > 0 && (
                    <SummaryField label="Other commands" value={formatSummaryList(slot.otherCommands)} />
                  )}
                </Stack>
              ))}
            </Stack>
          </Paper>
      ))}
    </SimpleGrid>
  )
}
