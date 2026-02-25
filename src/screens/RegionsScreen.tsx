import {
  Accordion,
  Badge,
  Stack,
  Text,
  Group,
  List,
  Paper,
  Tabs,
} from '@mantine/core'
import {
  IconMapPin,
  IconBuildingCommunity,
  IconHeart,
  IconSettings,
  IconLeaf,
  IconList,
} from '@tabler/icons-react'
import type { ServerProfile, RegionRecord } from '../types'

type RegionGroupKey =
  | 'regions'
  | 'villages'
  | 'hearts'
  | 'nether_regions'
  | 'nether_hearts'
  | 'end_regions'
  | 'end_hearts'
  | 'system'

const REGION_GROUPS: { key: RegionGroupKey; label: string; icon: React.ReactNode }[] = [
  { key: 'regions', label: 'Regions', icon: <IconMapPin size={18} /> },
  { key: 'villages', label: 'Villages', icon: <IconBuildingCommunity size={18} /> },
  { key: 'hearts', label: 'Hearts', icon: <IconHeart size={18} /> },
  { key: 'nether_regions', label: 'Nether Regions', icon: <IconMapPin size={18} /> },
  { key: 'nether_hearts', label: 'Nether Hearts', icon: <IconHeart size={18} /> },
  { key: 'end_regions', label: 'End Regions', icon: <IconMapPin size={18} /> },
  { key: 'end_hearts', label: 'End Hearts', icon: <IconHeart size={18} /> },
  { key: 'system', label: 'System', icon: <IconSettings size={18} /> },
]

function getRegionGroup(region: RegionRecord): RegionGroupKey | null {
  if (region.kind === 'system') return 'system'
  if (region.world === 'nether') {
    return region.kind === 'heart' ? 'nether_hearts' : 'nether_regions'
  }
  if (region.world === 'end') {
    return region.kind === 'heart' ? 'end_hearts' : 'end_regions'
  }
  if (region.world === 'overworld') {
    if (region.kind === 'village') return 'villages'
    if (region.kind === 'heart') return 'hearts'
    if (region.kind === 'region') return 'regions'
  }
  return null
}

function formatRegionId(id: string): string {
  return id
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
}

function kindIcon(kind: RegionRecord['kind']) {
  switch (kind) {
    case 'system':
      return <IconSettings size={16} />
    case 'village':
      return <IconBuildingCommunity size={16} />
    case 'heart':
      return <IconHeart size={16} />
    default:
      return <IconMapPin size={16} />
  }
}

function kindColor(kind: RegionRecord['kind']): string {
  switch (kind) {
    case 'system':
      return 'gray'
    case 'village':
      return 'teal'
    case 'heart':
      return 'red'
    default:
      return 'blue'
  }
}

function RegionPanel({ region }: { region: RegionRecord }) {
  return (
    <Stack gap="md">
      <div>
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
          Discovery
        </Text>
        <Group gap="xl">
          <Text size="sm">
            Method: <strong>{region.discover.method}</strong>
          </Text>
          <Text size="sm">
            Recipe: <strong>{region.discover.recipeId}</strong>
          </Text>
          {region.discover.commandIdOverride && (
            <Text size="sm">
              Command ID override: <strong>{region.discover.commandIdOverride}</strong>
            </Text>
          )}
        </Group>
      </div>

      {region.description && (
        <div>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
            Description
          </Text>
          <Text size="sm" className="pre-wrap">{region.description}</Text>
        </div>
      )}

      {region.category && (
        <div>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
            Category
          </Text>
          <Text size="sm">{region.category}</Text>
        </div>
      )}

      {region.items && region.items.length > 0 && (
        <div>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
            Items
          </Text>
          <List size="sm" spacing="xs">
            {region.items.map((item, i) => (
              <List.Item key={i}>
                <Text component="code" size="sm">
                  {item.id}
                </Text>
                {item.name !== item.id && ` — ${item.name}`}
              </List.Item>
            ))}
          </List>
        </div>
      )}

      {region.theme && region.theme.length > 0 && (
        <div>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
            Theme
          </Text>
          <Group gap="md">
            {region.theme.map((t, i) => (
              <Badge key={i} size="sm" variant="outline">
                {t.a} + {t.b}
              </Badge>
            ))}
          </Group>
        </div>
      )}

      {region.biomes && region.biomes.length > 0 && (
        <div>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
            Biomes
          </Text>
          <Group gap="sm">
            {region.biomes.map((b, i) => (
              <Group key={i} gap={4}>
                <IconLeaf size={14} />
                <Text size="sm">
                  {b.biome}: {b.percentage}%
                </Text>
              </Group>
            ))}
          </Group>
        </div>
      )}
    </Stack>
  )
}

interface RegionsScreenProps {
  server: ServerProfile
}

export function RegionsScreen({ server }: RegionsScreenProps) {
  const regions = server.regions

  if (regions.length === 0) {
    return (
      <Paper p="xl" withBorder>
        <Text c="dimmed">No regions imported yet. Import regions-meta to populate this list.</Text>
      </Paper>
    )
  }

  const grouped = regions.reduce<Record<RegionGroupKey, RegionRecord[]>>(
    (acc, region) => {
      const group = getRegionGroup(region)
      if (group) {
        if (!acc[group]) acc[group] = []
        acc[group].push(region)
      }
      return acc
    },
    {} as Record<RegionGroupKey, RegionRecord[]>
  )

  function getSortLabel(region: RegionRecord): string {
    return (region.discover.displayNameOverride ?? formatRegionId(region.id)).toLowerCase()
  }

  for (const key of Object.keys(grouped) as RegionGroupKey[]) {
    grouped[key]?.sort((a, b) => getSortLabel(a).localeCompare(getSortLabel(b)))
  }

  const activeGroups = REGION_GROUPS.filter((g) => grouped[g.key]?.length)

  function renderRegionList(regionList: RegionRecord[]) {
    return (
      <Accordion variant="separated" radius="md" multiple defaultValue={[]}>
        {regionList.map((region) => {
          const value = `${region.world}:${region.id}`
          const label = region.discover.displayNameOverride ?? formatRegionId(region.id)

          return (
            <Accordion.Item key={value} value={value}>
              <Accordion.Control
                icon={kindIcon(region.kind)}
                aria-label={`${label} (${region.kind}, ${region.world})`}
              >
                <Group gap="sm">
                  <Text fw={500}>{label}</Text>
                  <Badge size="sm" variant="light" color={kindColor(region.kind)}>
                    {region.kind}
                  </Badge>
                  <Badge size="sm" variant="outline" color="dark">
                    {region.world}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <RegionPanel region={region} />
              </Accordion.Panel>
            </Accordion.Item>
          )
        })}
      </Accordion>
    )
  }

  return (
    <Tabs defaultValue="all">
      <Tabs.List>
        <Tabs.Tab value="all" leftSection={<IconList size={16} />}>
          <Group gap="xs">
            All
            <Badge size="sm" variant="light" color="gray">
              {regions.length}
            </Badge>
          </Group>
        </Tabs.Tab>
        {activeGroups.map((group) => (
          <Tabs.Tab key={group.key} value={group.key} leftSection={group.icon}>
            <Group gap="xs">
              {group.label}
              <Badge size="sm" variant="light" color="gray">
                {grouped[group.key].length}
              </Badge>
            </Group>
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value="all" pt="md">
        <Stack gap="xl">
          {activeGroups.map((group) => (
            <Stack key={group.key} gap="sm">
              <Group gap="sm">
                {group.icon}
                <Text fw={600} size="lg">{group.label}</Text>
                <Badge size="sm" variant="light" color="gray">
                  {grouped[group.key].length}
                </Badge>
              </Group>
              {renderRegionList(grouped[group.key])}
            </Stack>
          ))}
        </Stack>
      </Tabs.Panel>

      {activeGroups.map((group) => (
        <Tabs.Panel key={group.key} value={group.key} pt="md">
          {renderRegionList(grouped[group.key])}
        </Tabs.Panel>
      ))}
    </Tabs>
  )
}
