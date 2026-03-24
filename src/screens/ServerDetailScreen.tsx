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
import { IconArrowLeft, IconFileImport, IconUser, IconHammer, IconMap2, IconBook } from '@tabler/icons-react'
import type { ServerProfile } from '../types'
import { computeRegionDisplayStats } from '../utils/regionStats'
import { formatStructureTypeLabel } from '../utils/stringFormatters'
import { ImportScreen } from './ImportScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { BuildScreen } from './BuildScreen'
import { RegionsScreen } from './RegionsScreen'
import { LoreBooksScreen } from './LoreBooksScreen'

type SectionValue = 'import' | 'regions' | 'onboarding' | 'build' | 'loreBooks'

type ImportStatRow = { key: string; label: string; value: number; nested?: boolean }

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

  // Reload profile when opening Build so fields (e.g. DiscordSRV) match disk after tab unmount.
  useEffect(() => {
    if (activeSection !== 'build') return
    let cancelled = false
    ;(async () => {
      try {
        const updated = await window.electronAPI.getServer(server.id)
        if (!cancelled && updated) setServer(updated)
      } catch (error) {
        console.error('Failed to load server:', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSection, server.id])

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

  const stats = computeRegionDisplayStats(server.regions)
  const {
    overworldRegions,
    overworldVillages,
    overworldHearts,
    overworldStructures,
    structureTypesOverworld,
    netherRegions,
    netherHearts,
    netherStructures,
    structureTypesNether,
    totalRegions,
    totalStructures,
    structureTypesAll,
  } = stats
  const spawnConfigured = server.spawnCenter != null || (server.onboarding?.teleport != null) ? 1 : 0

  function structureBreakdownRows(
    prefix: string,
    breakdown: { structureType: string; count: number }[]
  ): ImportStatRow[] {
    return breakdown.map(({ structureType, count }) => ({
      key: `${prefix}-st-${structureType}`,
      label: formatStructureTypeLabel(structureType),
      value: count,
      nested: true,
    }))
  }

  const statSections: { title: string; stats: ImportStatRow[] }[] = [
    {
      title: 'Overworld',
      stats: [
        { key: 'ow-reg', label: 'Regions', value: overworldRegions },
        { key: 'ow-vil', label: 'Villages', value: overworldVillages },
        { key: 'ow-hrt', label: 'Hearts', value: overworldHearts },
        { key: 'ow-st-sum', label: 'Structures', value: overworldStructures },
        ...structureBreakdownRows('ow', structureTypesOverworld),
      ],
    },
    {
      title: 'Nether',
      stats: [
        { key: 'ne-reg', label: 'Regions', value: netherRegions },
        { key: 'ne-hrt', label: 'Hearts', value: netherHearts },
        { key: 'ne-st-sum', label: 'Structures', value: netherStructures },
        ...structureBreakdownRows('ne', structureTypesNether),
      ],
    },
    {
      title: 'Totals',
      stats: [
        { key: 'tot-reg', label: 'Region total', value: totalRegions },
        { key: 'tot-st-sum', label: 'Structures', value: totalStructures },
        ...structureBreakdownRows('tot', structureTypesAll),
      ],
    },
    {
      title: 'Spawn',
      stats: [{ key: 'sp-cfg', label: 'Configured', value: spawnConfigured }],
    },
  ]

  const navItems: { value: SectionValue; label: string; icon: React.ReactNode }[] = [
    { value: 'import', label: 'Import Regions', icon: <IconFileImport size={18} /> },
    { value: 'regions', label: 'Regions', icon: <IconMap2 size={18} /> },
    { value: 'onboarding', label: 'Onboarding', icon: <IconUser size={18} /> },
    { value: 'build', label: 'Build', icon: <IconHammer size={18} /> },
    { value: 'loreBooks', label: 'Lore Books', icon: <IconBook size={18} /> },
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

    <Group align="flex-start" gap="xl" wrap="nowrap" mih="100%">
      <Box
        w={260}
        className="server-detail-nav"
        visibleFrom="sm"
        component="nav"
      >
        <Stack gap="md">
          <Title order={3} lineClamp={1} title={server.name}>
            {server.name}
          </Title>
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

      <Stack gap="xl" flex={1} miw={0} p="md" pt={0} px={0}>
        <div>
          <Title order={1} mb={4}>
            {activeSection === 'import' && 'Import stats'}
            {activeSection === 'regions' && 'Regions'}
            {activeSection === 'onboarding' && 'Onboarding Config'}
            {activeSection === 'build' && 'Build Config'}
            {activeSection === 'loreBooks' && 'Export Lore Books'}
          </Title>
        </div>

        {activeSection === 'import' && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
              {statSections.map(({ title, stats }) => (
                <Paper key={title} p="md" withBorder bg="dark.6">
                  <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb="sm">
                    {title}
                  </Text>
                  <Stack gap="xs">
                    {stats.map(({ key, label, value, nested }) => (
                      <Group key={key} justify="space-between" wrap="nowrap" pl={nested ? 'sm' : 0}>
                        <Text size={nested ? 'xs' : 'sm'} c="dimmed">
                          {nested ? `· ${label}` : label}
                        </Text>
                        <Text size={nested ? 'sm' : 'md'} fw={nested ? 500 : 600}>
                          {value}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
            <ImportScreen server={server} onServerUpdate={handleServerUpdate} />
          </>
        )}
        {activeSection === 'regions' && (
          <RegionsScreen server={server} />
        )}
        {activeSection === 'onboarding' && (
          <OnboardingScreen server={server} onServerUpdate={handleServerUpdate} />
        )}
        {activeSection === 'build' && (
          <BuildScreen server={server} onServerUpdate={handleServerUpdate} />
        )}
        {activeSection === 'loreBooks' && (
          <LoreBooksScreen server={server} onServerUpdate={handleServerUpdate} />
        )}
      </Stack>
    </Group>
    </Stack>
  )
}
