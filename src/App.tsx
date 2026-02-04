import { useState } from 'react'
import { AppShell, Group, Text } from '@mantine/core'
import { IconPlug } from '@tabler/icons-react'
import { ServerProfilesScreen } from './screens/ServerProfilesScreen'
import { ServerDetailScreen } from './screens/ServerDetailScreen'
import type { ServerProfile } from './types'

function App() {
  const [currentServer, setCurrentServer] = useState<ServerProfile | null>(null)

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <IconPlug size={28} stroke={1.5} />
            <Text fw={600} size="lg">
              MC Plugin Manager
            </Text>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {currentServer ? (
          <ServerDetailScreen
            server={currentServer}
            onBack={() => setCurrentServer(null)}
          />
        ) : (
          <ServerProfilesScreen onSelectServer={setCurrentServer} />
        )}
      </AppShell.Main>
    </AppShell>
  )
}

export default App
