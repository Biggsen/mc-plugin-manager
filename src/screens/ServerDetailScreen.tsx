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

  const overworldCount = server.regions.filter((r) => r.world === 'overworld').length
  const netherCount = server.regions.filter((r) => r.world === 'nether').length
  const heartCount = server.regions.filter((r) => r.kind === 'heart').length
  const systemCount = server.regions.filter((r) => r.kind === 'system').length
  const villageCount = server.regions.filter((r) => r.kind === 'village').length
  const regularCount = server.regions.filter((r) => r.kind === 'region').length

  const stats = [
    { label: 'Overworld', value: overworldCount },
    { label: 'Nether', value: netherCount },
    { label: 'Hearts', value: heartCount },
    { label: 'Villages', value: villageCount },
    { label: 'Regions', value: regularCount },
    { label: 'System', value: systemCount },
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

        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
          {stats.map(({ label, value }) => (
            <Paper key={label} p="md" withBorder bg="dark.6">
              <Text size="xs" c="dimmed" mb={2}>
                {label}
              </Text>
              <Text size="xl" fw={700}>
                {value}
              </Text>
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
