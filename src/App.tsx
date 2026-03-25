import { useState } from 'react'
import { AppShell, Button, Group, Text } from '@mantine/core'
import { IconGitCompare, IconPlug } from '@tabler/icons-react'
import { ServerProfilesScreen } from './screens/ServerProfilesScreen'
import { ServerDetailScreen } from './screens/ServerDetailScreen'
import { PluginFolderCompareScreen } from './screens/PluginFolderCompareScreen'
import type { ServerProfile } from './types'

type ShellView = 'servers' | 'comparePlugins'

function App() {
  const [currentServer, setCurrentServer] = useState<ServerProfile | null>(null)
  const [shellView, setShellView] = useState<ShellView>('servers')

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
          {shellView === 'servers' && !currentServer && (
            <Button
              variant="light"
              leftSection={<IconGitCompare size={18} />}
              onClick={() => setShellView('comparePlugins')}
            >
              Compare plugin folders
            </Button>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {shellView === 'comparePlugins' ? (
          <PluginFolderCompareScreen
            onBack={() => {
              setShellView('servers')
            }}
          />
        ) : currentServer ? (
          <ServerDetailScreen
            server={currentServer}
            onBack={() => setCurrentServer(null)}
            onServerProfileChange={setCurrentServer}
          />
        ) : (
          <ServerProfilesScreen onSelectServer={setCurrentServer} />
        )}
      </AppShell.Main>
    </AppShell>
  )
}

export default App
