import { useState } from 'react'
import { AppShell, Button, Group, Text } from '@mantine/core'
import { IconGitCompare, IconPlug, IconBooks } from '@tabler/icons-react'
import { ServerProfilesScreen } from './screens/ServerProfilesScreen'
import { ServerDetailScreen } from './screens/ServerDetailScreen'
import { PluginFolderCompareScreen } from './screens/PluginFolderCompareScreen'
import { DropTableLibraryScreen } from './screens/DropTableLibraryScreen'
import { DropTableEditorScreen } from './screens/DropTableEditorScreen'
import type { ServerProfile } from './types'

type ShellView = 'servers' | 'comparePlugins' | 'dropTableLibrary' | 'dropTableEditor'

function App() {
  const [currentServer, setCurrentServer] = useState<ServerProfile | null>(null)
  const [shellView, setShellView] = useState<ShellView>('servers')
  const [editorTableId, setEditorTableId] = useState<string | undefined>(undefined)

  function openDropTableEditor(tableId?: string) {
    setEditorTableId(tableId)
    setShellView('dropTableEditor')
  }

  function backToLibrary() {
    setShellView('dropTableLibrary')
  }

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
          <Group gap="xs">
            {shellView === 'servers' && (
              <Button
                variant="light"
                leftSection={<IconBooks size={18} />}
                onClick={() => setShellView('dropTableLibrary')}
              >
                Drop table library
              </Button>
            )}
            {(shellView === 'dropTableLibrary' || shellView === 'dropTableEditor') && (
              <Button variant="light" onClick={() => setShellView('servers')}>
                Back to servers
              </Button>
            )}
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
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {shellView === 'comparePlugins' ? (
          <PluginFolderCompareScreen
            onBack={() => {
              setShellView('servers')
            }}
          />
        ) : shellView === 'dropTableLibrary' ? (
          <DropTableLibraryScreen
            onCreateTable={() => openDropTableEditor(undefined)}
            onEditTable={(tableId) => openDropTableEditor(tableId)}
          />
        ) : shellView === 'dropTableEditor' ? (
          <DropTableEditorScreen
            tableId={editorTableId}
            onBack={backToLibrary}
            onSaved={() => backToLibrary()}
          />
        ) : currentServer ? (
          <ServerDetailScreen
            server={currentServer}
            onBack={() => setCurrentServer(null)}
            onServerProfileChange={setCurrentServer}
            onOpenDropTableLibrary={() => setShellView('dropTableLibrary')}
          />
        ) : (
          <ServerProfilesScreen onSelectServer={setCurrentServer} />
        )}
      </AppShell.Main>
    </AppShell>
  )
}

export default App
