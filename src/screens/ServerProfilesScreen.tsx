import { useState, useEffect, useMemo } from 'react'
import {
  Title,
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Paper,
  SimpleGrid,
  Modal,
  ActionIcon,
  Center,
  Select,
} from '@mantine/core'
import {
  IconPlus,
  IconSearch,
  IconServer,
  IconTrash,
  IconMap2,
  IconBuildingCommunity,
  IconHeart,
  IconHeartFilled,
  IconFlame,
  IconBuilding,
  IconStack,
} from '@tabler/icons-react'
import type { ServerProfile, ServerSummaryWithStats } from '../types'
import classes from './ServerProfilesScreen.module.css'

const SERVER_SORT_STORAGE_KEY = 'mcpm.serverListSort.v1'

const SERVER_SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'lastUpdated-desc', label: 'Last updated (newest first)' },
  { value: 'lastUpdated-asc', label: 'Last updated (oldest first)' },
  { value: 'regions-desc', label: 'Regions (most)' },
  { value: 'regions-asc', label: 'Regions (fewest)' },
  { value: 'villages-desc', label: 'Villages (most)' },
  { value: 'villages-asc', label: 'Villages (fewest)' },
  { value: 'hearts-desc', label: 'Hearts (most)' },
  { value: 'hearts-asc', label: 'Hearts (fewest)' },
  { value: 'netherRegions-desc', label: 'Nether regions (most)' },
  { value: 'netherRegions-asc', label: 'Nether regions (fewest)' },
  { value: 'netherHearts-desc', label: 'Nether hearts (most)' },
  { value: 'netherHearts-asc', label: 'Nether hearts (fewest)' },
  { value: 'structures-desc', label: 'Structures (most)' },
  { value: 'structures-asc', label: 'Structures (fewest)' },
  { value: 'totalRegions-desc', label: 'Total regions (most)' },
  { value: 'totalRegions-asc', label: 'Total regions (fewest)' },
] as const

type ServerSortValue = (typeof SERVER_SORT_OPTIONS)[number]['value']

function isServerSortValue(s: string): s is ServerSortValue {
  return SERVER_SORT_OPTIONS.some((o) => o.value === s)
}

function readStoredServerSort(): ServerSortValue {
  try {
    const raw = window.localStorage.getItem(SERVER_SORT_STORAGE_KEY)
    if (raw && isServerSortValue(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'name-asc'
}

function totalRegionsStat(s: ServerSummaryWithStats): number {
  const r = s.regionCount ?? 0
  const v = s.villageCount ?? 0
  const h = s.heartCount ?? 0
  const nr = s.netherRegionCount ?? 0
  const nh = s.netherHeartCount ?? 0
  return r + v + h + nr + nh
}

function lastImportMs(s: ServerSummaryWithStats): number | null {
  if (!s.lastImportIso) return null
  const t = new Date(s.lastImportIso).getTime()
  return Number.isFinite(t) ? t : null
}

function compareServersForSort(
  a: ServerSummaryWithStats,
  b: ServerSummaryWithStats,
  sort: ServerSortValue
): number {
  switch (sort) {
    case 'name-asc':
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    case 'name-desc':
      return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
    case 'lastUpdated-desc': {
      const ta = lastImportMs(a)
      const tb = lastImportMs(b)
      if (ta === null && tb === null) return 0
      if (ta === null) return 1
      if (tb === null) return -1
      return tb - ta
    }
    case 'lastUpdated-asc': {
      const ta = lastImportMs(a)
      const tb = lastImportMs(b)
      if (ta === null && tb === null) return 0
      if (ta === null) return -1
      if (tb === null) return 1
      return ta - tb
    }
    case 'regions-desc':
      return (b.regionCount ?? 0) - (a.regionCount ?? 0)
    case 'regions-asc':
      return (a.regionCount ?? 0) - (b.regionCount ?? 0)
    case 'villages-desc':
      return (b.villageCount ?? 0) - (a.villageCount ?? 0)
    case 'villages-asc':
      return (a.villageCount ?? 0) - (b.villageCount ?? 0)
    case 'hearts-desc':
      return (b.heartCount ?? 0) - (a.heartCount ?? 0)
    case 'hearts-asc':
      return (a.heartCount ?? 0) - (b.heartCount ?? 0)
    case 'netherRegions-desc':
      return (b.netherRegionCount ?? 0) - (a.netherRegionCount ?? 0)
    case 'netherRegions-asc':
      return (a.netherRegionCount ?? 0) - (b.netherRegionCount ?? 0)
    case 'netherHearts-desc':
      return (b.netherHeartCount ?? 0) - (a.netherHeartCount ?? 0)
    case 'netherHearts-asc':
      return (a.netherHeartCount ?? 0) - (b.netherHeartCount ?? 0)
    case 'structures-desc':
      return (b.structureCount ?? 0) - (a.structureCount ?? 0)
    case 'structures-asc':
      return (a.structureCount ?? 0) - (b.structureCount ?? 0)
    case 'totalRegions-desc':
      return totalRegionsStat(b) - totalRegionsStat(a)
    case 'totalRegions-asc':
      return totalRegionsStat(a) - totalRegionsStat(b)
    default:
      return 0
  }
}

interface ServerProfilesScreenProps {
  onSelectServer: (server: ServerProfile) => void
}

export function ServerProfilesScreen({
  onSelectServer,
}: ServerProfilesScreenProps) {
  const [servers, setServers] = useState<ServerSummaryWithStats[]>([])
  const [newServerName, setNewServerName] = useState('')
  const [newConfigName, setNewConfigName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<ServerSortValue>(readStoredServerSort)
  const [isCreating, setIsCreating] = useState(false)
  const [addServerModalOpen, setAddServerModalOpen] = useState(false)
  const [serverToDelete, setServerToDelete] = useState<ServerSummaryWithStats | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadServers()
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SERVER_SORT_STORAGE_KEY, sortBy)
    } catch {
      /* ignore */
    }
  }, [sortBy])

  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return servers
    const q = searchQuery.trim().toLowerCase()
    return servers.filter((s) => s.name.toLowerCase().includes(q))
  }, [servers, searchQuery])

  const sortedFilteredServers = useMemo(() => {
    const list = [...filteredServers]
    list.sort((a, b) => compareServersForSort(a, b, sortBy))
    return list
  }, [filteredServers, sortBy])

  const summary = useMemo(() => {
    const n = filteredServers.length
    const regions = filteredServers.reduce((a, s) => a + (s.regionCount ?? 0), 0)
    const villages = filteredServers.reduce((a, s) => a + (s.villageCount ?? 0), 0)
    const hearts = filteredServers.reduce((a, s) => a + (s.heartCount ?? 0), 0)
    const netherRegions = filteredServers.reduce((a, s) => a + (s.netherRegionCount ?? 0), 0)
    const netherHearts = filteredServers.reduce((a, s) => a + (s.netherHeartCount ?? 0), 0)
    const structures = filteredServers.reduce((a, s) => a + (s.structureCount ?? 0), 0)
    const totalWorldData = regions + villages + hearts + netherRegions + netherHearts
    return { n, regions, villages, hearts, netherRegions, netherHearts, structures, totalWorldData }
  }, [filteredServers])

  function normalizeServer(s: Partial<ServerSummaryWithStats> & { id: string; name: string }): ServerSummaryWithStats {
    return {
      id: s.id,
      name: s.name,
      regionCount: typeof s.regionCount === 'number' ? s.regionCount : 0,
      villageCount: typeof s.villageCount === 'number' ? s.villageCount : 0,
      heartCount: typeof s.heartCount === 'number' ? s.heartCount : 0,
      netherRegionCount: typeof s.netherRegionCount === 'number' ? s.netherRegionCount : 0,
      netherHeartCount: typeof s.netherHeartCount === 'number' ? s.netherHeartCount : 0,
      structureCount: typeof s.structureCount === 'number' ? s.structureCount : 0,
      lastImportIso: s.lastImportIso ?? null,
    }
  }

  async function loadServers() {
    try {
      const serverList = await window.electronAPI.listServers()
      setServers(serverList.map(normalizeServer))
    } catch (error) {
      console.error('Failed to load servers:', error)
    }
  }

  async function handleCreateServer() {
    if (!newServerName.trim()) return
    setIsCreating(true)
    try {
      const cn = newConfigName.trim()
      const newServer = await window.electronAPI.createServer(
        newServerName.trim(),
        cn.length > 0 ? cn : undefined
      )
      await loadServers()
      setNewServerName('')
      setNewConfigName('')
      setAddServerModalOpen(false)
      onSelectServer(newServer)
    } catch (error) {
      console.error('Failed to create server:', error)
      alert('Failed to create server. See console for details.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleOpenServer(serverId: string) {
    try {
      const server = await window.electronAPI.getServer(serverId)
      if (server) onSelectServer(server)
    } catch (error) {
      console.error('Failed to load server:', error)
    }
  }

  function openDeleteConfirm(server: ServerSummaryWithStats) {
    setServerToDelete(server)
  }

  async function confirmDeleteServer() {
    if (!serverToDelete) return
    setIsDeleting(true)
    try {
      const result = await window.electronAPI.deleteServer(serverToDelete.id)
      if (result.success) {
        setServerToDelete(null)
        await loadServers()
      } else {
        alert(result.error ?? 'Failed to delete server')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1} mb={4}>
            MC Plugin Manager
          </Title>
          <Text size="sm" c="dimmed">
            Import regions, configure onboarding, and build plugin configs for each server.
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setAddServerModalOpen(true)}
        >
          Add Server
        </Button>
      </Group>

      <Modal
        title="Add Server"
        opened={addServerModalOpen}
        onClose={() => {
          setAddServerModalOpen(false)
          setNewServerName('')
          setNewConfigName('')
        }}
      >
        <Stack gap="md">
          <TextInput
            placeholder="Enter server name..."
            value={newServerName}
            onChange={(e) => setNewServerName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateServer()
            }}
            leftSection={<IconServer size={16} />}
            label="Profile name"
            description="Shown on the home screen and in this app"
          />
          <TextInput
            placeholder="e.g. charidh (optional)"
            value={newConfigName}
            onChange={(e) => setNewConfigName(e.currentTarget.value)}
            label="Name in generated configs"
            description="If set, used for {SERVER_NAME} and TAB instead of the profile name"
          />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => {
                setAddServerModalOpen(false)
                setNewServerName('')
              }}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleCreateServer}
              loading={isCreating}
              disabled={!newServerName.trim()}
            >
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        title="Delete server"
        opened={serverToDelete !== null}
        onClose={() => !isDeleting && setServerToDelete(null)}
      >
        {serverToDelete && (
          <Stack gap="md">
            <Text size="sm">
              Delete server &quot;{serverToDelete.name}&quot;? This cannot be undone.
            </Text>
            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                onClick={() => setServerToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={confirmDeleteServer}
                loading={isDeleting}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Group align="flex-end" gap="md" wrap="wrap">
        <TextInput
          placeholder="Search servers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          style={{ flex: 1, minWidth: 200, maxWidth: 400 }}
          aria-label="Search servers"
        />
        <Select
          label="Sort by"
          data={[...SERVER_SORT_OPTIONS]}
          value={sortBy}
          onChange={(v) => {
            if (v) setSortBy(v as ServerSortValue)
          }}
          w={280}
          searchable
          nothingFoundMessage="No matching sort"
        />
      </Group>

      {filteredServers.length > 0 && (
        <Text size="sm" c="dimmed">
          {summary.n} server{summary.n !== 1 ? 's' : ''} • {summary.regions} regions • {summary.villages} villages •{' '}
          {summary.hearts} hearts • {summary.netherRegions} nether regions • {summary.netherHearts} nether hearts •{' '}
          {summary.structures} structures • {summary.totalWorldData} total
        </Text>
      )}

      {filteredServers.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text size="sm" c="dimmed" ta="center">
            {servers.length === 0
              ? 'No servers yet. Create one to get started.'
              : 'No servers match your search.'}
          </Text>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {sortedFilteredServers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onOpen={() => handleOpenServer(server.id)}
              onDelete={() => openDeleteConfirm(server)}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

const STAT_ICONS = [
  { key: 'regions', label: (n: number) => `${n} regions`, Icon: IconMap2 },
  { key: 'villages', label: (n: number) => `${n} villages`, Icon: IconBuildingCommunity },
  { key: 'hearts', label: (n: number) => `${n} hearts`, Icon: IconHeart },
  { key: 'nether', label: (n: number) => `${n} nether regions`, Icon: IconFlame },
  { key: 'netherHearts', label: (n: number) => `${n} nether hearts`, Icon: IconHeartFilled },
  { key: 'structures', label: (n: number) => `${n} structures`, Icon: IconBuilding },
  { key: 'total', label: (n: number) => `${n} total regions`, Icon: IconStack },
] as const

function ServerCard({
  server,
  onOpen,
  onDelete,
}: {
  server: ServerSummaryWithStats
  onOpen: () => void
  onDelete: () => void
}) {
  const regionCount = server.regionCount ?? 0
  const villageCount = server.villageCount ?? 0
  const heartCount = server.heartCount ?? 0
  const netherRegionCount = server.netherRegionCount ?? 0
  const netherHeartCount = server.netherHeartCount ?? 0
  const structureCount = server.structureCount ?? 0
  const lastImportLabel = server.lastImportIso
    ? new Date(server.lastImportIso).toLocaleDateString(undefined, {
        dateStyle: 'medium',
      })
    : 'Never'

  const coreCounts = [regionCount, villageCount, heartCount, netherRegionCount, netherHeartCount]
  const totalRegions = coreCounts.reduce((a, b) => a + b, 0)
  const rowCounts = [...coreCounts, structureCount]
  const stats = [
    ...STAT_ICONS.slice(0, 6).map((s, i) => ({
      key: s.key,
      label: s.label(rowCounts[i]!),
      Icon: s.Icon,
    })),
    {
      key: STAT_ICONS[6].key,
      label: STAT_ICONS[6].label(totalRegions),
      Icon: STAT_ICONS[6].Icon,
    },
  ]

  return (
    <Paper
      className={classes.serverCard}
      p="lg"
      withBorder
      bg="dark.6"
      style={{ cursor: 'pointer', minHeight: 220, display: 'flex', flexDirection: 'column' }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`Open ${server.name}`}
    >
      <Stack gap="sm" style={{ flex: 1 }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Title order={3} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
            {server.name}
          </Title>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            aria-label={`Delete ${server.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>

        <div className={classes.statsSection} style={{ marginTop: 'auto' }}>
          <Text size="xs" c="dimmed" className={classes.statsLabel}>
            World data
          </Text>
          <Group gap={8} mb={-8}>
            {stats.map(({ key, label, Icon }) => (
              <Center key={key}>
                <Icon size={16} className={classes.statIcon} stroke={1.5} />
                <Text size="xs">{label}</Text>
              </Center>
            ))}
          </Group>
        </div>

        <Text size="xs" c="dimmed" mt="auto">
          Last import: {lastImportLabel}
        </Text>
      </Stack>
    </Paper>
  )
}
