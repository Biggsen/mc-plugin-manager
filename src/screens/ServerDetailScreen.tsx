import { useState, useEffect } from 'react'
import {
  Button,
  Group,
  Stack,
  SimpleGrid,
  Text,
  Paper,
  NavLink,
  Box,
  Title,
  SegmentedControl,
} from '@mantine/core'
import { IconArrowLeft, IconFileImport, IconUser, IconHammer } from '@tabler/icons-react'
import type { ServerProfile } from '../types'
import { ImportScreen } from './ImportScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { BuildScreen } from './BuildScreen'

type SectionValue = 'import' | 'onboarding' | 'build'

interface ServerDetailScreenProps {
  server: ServerProfile
  onBack: () => void
}

export function ServerDetailScreen({ server: initialServer, onBack }: ServerDetailScreenProps) {
  const [server, setServer] = useState<ServerProfile>(initialServer)
  const [activeSection, setActiveSection] = useState<SectionValue>('import')

  useEffect(() => {
    loadServer()
  }, [initialServer.id])

  async function loadServer() {
    try {
      const updated = await window.electronAPI.getServer(server.id)
      if (updated) {
        setServer(updated)
      }
    } catch (error) {
      console.error('Failed to load server:', error)
    }
  }

  function handleServerUpdate(updated: ServerProfile) {
    setServer(updated)
  }

  const overworldRegions = server.regions.filter((r) => r.world === 'overworld' && r.kind === 'region').length
  const overworldVillages = server.regions.filter((r) => r.world === 'overworld' && r.kind === 'village').length
  const overworldHearts = server.regions.filter((r) => r.world === 'overworld' && r.kind === 'heart').length
  const netherRegions = server.regions.filter((r) => r.world === 'nether' && r.kind === 'region').length
  const netherHearts = server.regions.filter((r) => r.world === 'nether' && r.kind === 'heart').length
  const totalRegions = server.regions.filter((r) => r.kind !== 'system').length
  const spawnConfigured = server.spawnCenter != null || (server.onboarding?.teleport != null) ? 1 : 0

  const statSections = [
    {
      title: 'Overworld',
      stats: [
        { label: 'Regions', value: overworldRegions },
        { label: 'Villages', value: overworldVillages },
        { label: 'Hearts', value: overworldHearts },
      ],
    },
    {
      title: 'Nether',
      stats: [
        { label: 'Regions', value: netherRegions },
        { label: 'Hearts', value: netherHearts },
      ],
    },
    {
      title: 'Totals',
      stats: [{ label: 'Region total', value: totalRegions }],
    },
    {
      title: 'Spawn',
      stats: [{ label: 'Configured', value: spawnConfigured }],
    },
  ]

  const navItems: { value: SectionValue; label: string; icon: React.ReactNode }[] = [
    { value: 'import', label: 'Import Regions', icon: <IconFileImport size={18} /> },
    { value: 'onboarding', label: 'Onboarding', icon: <IconUser size={18} /> },
    { value: 'build', label: 'Build', icon: <IconHammer size={18} /> },
  ]

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={onBack}
          size="sm"
        >
          Back to Servers
        </Button>
        <SegmentedControl
          value={activeSection}
          onChange={(v) => setActiveSection(v as SectionValue)}
          data={navItems.map((i) => ({ value: i.value, label: i.label }))}
          hiddenFrom="sm"
        />
      </Group>

    <Group align="flex-start" gap="xl" wrap="nowrap" style={{ minHeight: '100%' }}>
      <Box
        w={260}
        style={{ flexShrink: 0 }}
        visibleFrom="sm"
        component="nav"
      >
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" px="sm">
            Operations
          </Text>
          {navItems.map((item) => (
            <NavLink
              key={item.value}
              active={activeSection === item.value}
              leftSection={item.icon}
              label={item.label}
              onClick={() => setActiveSection(item.value)}
            />
          ))}
        </Stack>
      </Box>

      <Stack gap="xl" style={{ flex: 1, minWidth: 0 }} p="md" pt={0} px={0}>
        <div>
          <Title order={1} mb={4}>
            {server.name}
          </Title>
          <Text size="sm" c="dimmed">
            Import regions, configure onboarding, and build configs.
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          {statSections.map(({ title, stats }) => (
            <Paper key={title} p="md" withBorder bg="dark.6">
              <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb="sm">
                {title}
              </Text>
              <Stack gap="xs">
                {stats.map(({ label, value }) => (
                  <Group key={label} justify="space-between" wrap="nowrap">
                    <Text size="sm" c="dimmed">
                      {label}
                    </Text>
                    <Text size="md" fw={600}>
                      {value}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>

        {activeSection === 'import' && (
          <ImportScreen server={server} onServerUpdate={handleServerUpdate} />
        )}
        {activeSection === 'onboarding' && (
          <OnboardingScreen server={server} onServerUpdate={handleServerUpdate} />
        )}
        {activeSection === 'build' && <BuildScreen server={server} />}
      </Stack>
    </Group>
    </Stack>
  )
}
