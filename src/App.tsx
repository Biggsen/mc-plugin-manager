import { useState, useEffect } from 'react'
import { ServerProfilesScreen } from './screens/ServerProfilesScreen'
import type { ServerProfile } from './types'

function App() {
  const [currentServer, setCurrentServer] = useState<ServerProfile | null>(null)

  return (
    <div className="app">
      {currentServer ? (
        <div>
          <button onClick={() => setCurrentServer(null)}>← Back to Servers</button>
          <h1>Server: {currentServer.name}</h1>
          <p>Server management UI coming soon...</p>
        </div>
      ) : (
        <ServerProfilesScreen onSelectServer={setCurrentServer} />
      )}
    </div>
  )
}

export default App
