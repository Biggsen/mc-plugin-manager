import { useState } from 'react'
import { ServerProfilesScreen } from './screens/ServerProfilesScreen'
import { ServerDetailScreen } from './screens/ServerDetailScreen'
import type { ServerProfile } from './types'

function App() {
  const [currentServer, setCurrentServer] = useState<ServerProfile | null>(null)

  return (
    <div className="app">
      {currentServer ? (
        <ServerDetailScreen
          server={currentServer}
          onBack={() => setCurrentServer(null)}
        />
      ) : (
        <ServerProfilesScreen onSelectServer={setCurrentServer} />
      )}
    </div>
  )
}

export default App
