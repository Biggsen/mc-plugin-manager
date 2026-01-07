import { useState, useEffect } from 'react'
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
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>MC Plugin Manager</h1>
      <h2>Server Profiles</h2>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Enter server name..."
            value={newServerName}
            onChange={(e) => setNewServerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateServer()
              }
            }}
            style={{
              flex: 1,
              padding: '0.5rem',
              fontSize: '1rem',
            }}
          />
          <button
            onClick={handleCreateServer}
            disabled={isCreating || !newServerName.trim()}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              cursor: isCreating || !newServerName.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {isCreating ? 'Creating...' : 'Create Server'}
          </button>
        </div>
      </div>

      <div>
        <h3>Existing Servers</h3>
        {servers.length === 0 ? (
          <p style={{ color: '#666' }}>No servers yet. Create one to get started!</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {servers.map((server) => (
              <li
                key={server.id}
                style={{
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#f9f9f9',
                }}
                onClick={() => handleSelectServer(server.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9f9f9'
                }}
              >
                <strong>{server.name}</strong>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>ID: {server.id}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
