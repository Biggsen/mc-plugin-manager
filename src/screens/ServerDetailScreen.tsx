import { useState, useEffect } from 'react'
import type { ServerProfile } from '../types'
import { ImportScreen } from './ImportScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { BuildScreen } from './BuildScreen'

interface ServerDetailScreenProps {
  server: ServerProfile
  onBack: () => void
}

export function ServerDetailScreen({ server: initialServer, onBack }: ServerDetailScreenProps) {
  const [server, setServer] = useState<ServerProfile>(initialServer)
  const [activeTab, setActiveTab] = useState<'import' | 'onboarding' | 'build'>('import')

  useEffect(() => {
    // Refresh server data when it changes
    loadServer()
  }, [initialServer.id])

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

  const overworldCount = server.regions.filter((r) => r.world === 'overworld').length
  const netherCount = server.regions.filter((r) => r.world === 'nether').length
  const heartCount = server.regions.filter((r) => r.kind === 'heart').length
  const systemCount = server.regions.filter((r) => r.kind === 'system').length
  const villageCount = server.regions.filter((r) => r.kind === 'village').length
  const regularCount = server.regions.filter((r) => r.kind === 'region').length

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={onBack}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          ← Back to Servers
        </button>
        <h1 style={{ margin: 0 }}>Server: {server.name}</h1>
      </div>

      {/* Statistics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
        }}
      >
        <div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Overworld</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{overworldCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Nether</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{netherCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Hearts</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{heartCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Villages</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{villageCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Regions</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{regularCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>System</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{systemCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #ddd', marginBottom: '1rem' }}>
        <button
          onClick={() => setActiveTab('import')}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            border: 'none',
            borderBottom: activeTab === 'import' ? '2px solid #007acc' : '2px solid transparent',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'import' ? 'bold' : 'normal',
          }}
        >
          Import Regions
        </button>
        <button
          onClick={() => setActiveTab('onboarding')}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            border: 'none',
            borderBottom: activeTab === 'onboarding' ? '2px solid #007acc' : '2px solid transparent',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'onboarding' ? 'bold' : 'normal',
          }}
        >
          Onboarding
        </button>
        <button
          onClick={() => setActiveTab('build')}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            border: 'none',
            borderBottom: activeTab === 'build' ? '2px solid #007acc' : '2px solid transparent',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'build' ? 'bold' : 'normal',
          }}
        >
          Build
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'import' && (
        <ImportScreen server={server} onServerUpdate={handleServerUpdate} />
      )}
      {activeTab === 'onboarding' && (
        <OnboardingScreen server={server} onServerUpdate={handleServerUpdate} />
      )}
      {activeTab === 'build' && <BuildScreen server={server} />}
    </div>
  )
}
