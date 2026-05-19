import { useState } from 'react'
import { AppShell, Button, Group, Text } from '@mantine/core'
import { IconGitCompare, IconPlug, IconBooks, IconPackage, IconTrophy } from '@tabler/icons-react'
import { ServerProfilesScreen } from './screens/ServerProfilesScreen'
import { ServerDetailScreen } from './screens/ServerDetailScreen'
import { PluginFolderCompareScreen } from './screens/PluginFolderCompareScreen'
import { DropTableLibraryScreen } from './screens/DropTableLibraryScreen'
import { DropTableEditorScreen } from './screens/DropTableEditorScreen'
import { CrateLibraryScreen } from './screens/CrateLibraryScreen'
import { CrateEditorScreen } from './screens/CrateEditorScreen'
import { MilestoneRewardsLibraryScreen } from './screens/MilestoneRewardsLibraryScreen'
import { MilestoneRewardsEditorScreen } from './screens/MilestoneRewardsEditorScreen'
import type { ServerProfile } from './types'

type ShellView =
  | 'servers'
  | 'comparePlugins'
  | 'dropTableLibrary'
  | 'dropTableEditor'
  | 'crateLibrary'
  | 'crateEditor'
  | 'milestoneRewardsLibrary'
  | 'milestoneRewardsEditor'

function App() {
  const [currentServer, setCurrentServer] = useState<ServerProfile | null>(null)
  const [shellView, setShellView] = useState<ShellView>('servers')
  const [editorTableId, setEditorTableId] = useState<string | undefined>(undefined)
  const [editorCrateId, setEditorCrateId] = useState<string | undefined>(undefined)
  const [editorMilestoneProfileId, setEditorMilestoneProfileId] = useState<string | undefined>(undefined)
  const [milestoneLibrarySelectedId, setMilestoneLibrarySelectedId] = useState<string | null>(null)

  function openDropTableEditor(tableId?: string) {
    setEditorTableId(tableId)
    setShellView('dropTableEditor')
  }

  function openCrateEditor(crateId?: string) {
    setEditorCrateId(crateId)
    setShellView('crateEditor')
  }

  function backToDropTableLibrary() {
    setShellView('dropTableLibrary')
  }

  function backToCrateLibrary() {
    setShellView('crateLibrary')
  }

  function openMilestoneRewardsEditor(profileId?: string) {
    setEditorMilestoneProfileId(profileId)
    if (profileId) setMilestoneLibrarySelectedId(profileId)
    setShellView('milestoneRewardsEditor')
  }

  function backToMilestoneRewardsLibrary() {
    setShellView('milestoneRewardsLibrary')
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
              <>
                <Button
                  variant="light"
                  leftSection={<IconBooks size={18} />}
                  onClick={() => setShellView('dropTableLibrary')}
                >
                  Drop table library
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconPackage size={18} />}
                  onClick={() => setShellView('crateLibrary')}
                >
                  Crate library
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconTrophy size={18} />}
                  onClick={() => setShellView('milestoneRewardsLibrary')}
                >
                  Milestone rewards
                </Button>
              </>
            )}
            {(shellView === 'dropTableLibrary' ||
              shellView === 'dropTableEditor' ||
              shellView === 'crateLibrary' ||
              shellView === 'crateEditor' ||
              shellView === 'milestoneRewardsLibrary' ||
              shellView === 'milestoneRewardsEditor') && (
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
        ) : shellView === 'crateLibrary' ? (
          <CrateLibraryScreen
            onCreateCrate={() => openCrateEditor(undefined)}
            onEditCrate={(id) => openCrateEditor(id)}
          />
        ) : shellView === 'crateEditor' ? (
          <CrateEditorScreen
            crateId={editorCrateId}
            onBack={backToCrateLibrary}
            onSaved={() => backToCrateLibrary()}
          />
        ) : shellView === 'dropTableEditor' ? (
          <DropTableEditorScreen
            tableId={editorTableId}
            onBack={backToDropTableLibrary}
            onSaved={() => backToDropTableLibrary()}
          />
        ) : shellView === 'milestoneRewardsLibrary' ? (
          <MilestoneRewardsLibraryScreen
            selectedProfileId={milestoneLibrarySelectedId}
            onSelectProfileId={setMilestoneLibrarySelectedId}
            onCreateProfile={() => openMilestoneRewardsEditor(undefined)}
            onEditProfile={(id) => openMilestoneRewardsEditor(id)}
          />
        ) : shellView === 'milestoneRewardsEditor' ? (
          <MilestoneRewardsEditorScreen
            profileId={editorMilestoneProfileId}
            onBack={backToMilestoneRewardsLibrary}
            onSaved={() => backToMilestoneRewardsLibrary()}
          />
        ) : currentServer ? (
          <ServerDetailScreen
            server={currentServer}
            onBack={() => setCurrentServer(null)}
            onServerProfileChange={setCurrentServer}
            onOpenDropTableLibrary={() => setShellView('dropTableLibrary')}
            onOpenCrateLibrary={() => setShellView('crateLibrary')}
            onOpenMilestoneRewardsLibrary={() => setShellView('milestoneRewardsLibrary')}
          />
        ) : (
          <ServerProfilesScreen onSelectServer={setCurrentServer} />
        )}
      </AppShell.Main>
    </AppShell>
  )
}

export default App
