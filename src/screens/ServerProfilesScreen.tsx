import { useState, useEffect } from 'react'
import {
  Title,
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Paper,
  SimpleGrid,
} from '@mantine/core'
import { IconPlus, IconServer } from '@tabler/icons-react'
import type { ServerProfile, ServerSummary } from '../types'

interface ServerProfilesScreenProps {
  onSelectServer: (server: ServerProfile) => void
}

export function ServerProfilesScreen({
  onSelectServer,
}: ServerProfilesScreenProps) {
  const [servers, setServers] = useState<ServerSummary[]>([])
  const [newServerName, setNewServerName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadServers()
  }, [])

  async function loadServers() {
    try {
      const serverList = await window.electronAPI.listServers()
      setServers(serverList)
    } catch (error) {
      console.error('Failed to load servers:', error)
    }
  }

  async function handleCreateServer() {
    if (!newServerName.trim()) {
      return
    }

    setIsCreating(true)
    try {
      const newServer = await window.electronAPI.createServer(newServerName.trim())
      await loadServers()
      setNewServerName('')
      onSelectServer(newServer)
    } catch (error) {
      console.error('Failed to create server:', error)
      alert('Failed to create server. See console for details.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleSelectServer(serverId: string) {
    try {
      const server = await window.electronAPI.getServer(serverId)
      if (server) {
        onSelectServer(server)
      }
    } catch (error) {
      console.error('Failed to load server:', error)
    }
  }

  return (
    <Stack gap="xl">
      <div>
        <Title order={1} mb={4}>
          Server profiles
        </Title>
        <Text size="sm" c="dimmed">
          Import regions, configure onboarding, and build plugin configs for each server.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Paper p="lg" withBorder bg="dark.6">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
            Server profiles
          </Text>
          <Title order={2}>{servers.length}</Title>
        </Paper>
        <Paper p="lg" withBorder bg="dark.6">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
            Status
          </Text>
          <Title order={2} size="h3">
            Ready
          </Title>
        </Paper>
      </SimpleGrid>

      <Group gap="sm">
        <TextInput
          placeholder="Enter server name..."
          value={newServerName}
          onChange={(e) => setNewServerName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCreateServer()
            }
          }}
          flex={1}
          leftSection={<IconServer size={16} />}
        />
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleCreateServer}
          loading={isCreating}
          disabled={!newServerName.trim()}
        >
          New server
        </Button>
      </Group>

      <div>
        <Group justify="space-between" mb="md">
          <Title order={3}>Recent servers</Title>
        </Group>
        {servers.length === 0 ? (
          <Paper p="xl" withBorder>
            <Text size="sm" c="dimmed" ta="center">
              No servers yet. Create one to get started.
            </Text>
          </Paper>
        ) : (
          <Stack gap="xs">
            {servers.map((server) => (
              <Paper
                key={server.id}
                className="server-card"
                p="md"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => handleSelectServer(server.id)}
                bg="dark.6"
              >
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>{server.name}</Text>
                    <Text size="xs" c="dimmed">
                      {server.id}
                    </Text>
                  </div>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </div>
    </Stack>
  )
}
