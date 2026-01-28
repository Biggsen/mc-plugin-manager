import { useState } from 'react'
import type { ServerProfile, ImportResult } from '../types'

interface ImportScreenProps {
  server: ServerProfile
  onServerUpdate: (server: ServerProfile) => void
}

export function ImportScreen({ server, onServerUpdate }: ImportScreenProps) {
  const [isImportingOverworld, setIsImportingOverworld] = useState(false)
  const [isImportingNether, setIsImportingNether] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  async function handleImportOverworldRegionsMeta() {
    setIsImportingOverworld(true)
    setImportResult(null)

    try {
      // Show file dialog
      const filePath = await window.electronAPI.showImportDialog()
      if (!filePath) {
        setIsImportingOverworld(false)
        return
      }

      // Import overworld regions-meta
      const result = await window.electronAPI.importRegionsMeta(server.id, 'overworld', filePath)
      setImportResult(result)

      if (result.success) {
        // Reload server to get updated data
        const updated = await window.electronAPI.getServer(server.id)
        if (updated) {
          onServerUpdate(updated)
        }
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        error: error.message || 'Unknown error during import',
      })
    } finally {
      setIsImportingOverworld(false)
    }
  }

  async function handleImportNetherRegionsMeta() {
    setIsImportingNether(true)
    setImportResult(null)

    try {
      // Show file dialog
      const filePath = await window.electronAPI.showImportDialog()
      if (!filePath) {
        setIsImportingNether(false)
        return
      }

      // Import nether regions-meta
      const result = await window.electronAPI.importRegionsMeta(server.id, 'nether', filePath)
      setImportResult(result)

      if (result.success) {
        // Reload server to get updated data
        const updated = await window.electronAPI.getServer(server.id)
        if (updated) {
          onServerUpdate(updated)
        }
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        error: error.message || 'Unknown error during import',
      })
    } finally {
      setIsImportingNether(false)
    }
  }

  const overworldSource = server.sources.overworld || server.sources.world
  const netherSource = server.sources.nether
  const hasImportedOverworld = !!overworldSource
  const hasImportedNether = !!netherSource

  return (
    <div>
      <h2>Import Region Files</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Import regions-meta.yml from Region Forge to populate your server profile with region data, onboarding, spawn center, and LevelledMobs metadata.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Overworld Regions-meta Import */}
        <div
          style={{
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Overworld Regions Meta</h3>
              {hasImportedOverworld && overworldSource && (
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  Imported: {overworldSource.originalFilename}
                  <br />
                  <span style={{ fontSize: '0.75rem' }}>
                    {new Date(overworldSource.importedAtIso || '').toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleImportOverworldRegionsMeta}
              disabled={isImportingOverworld || isImportingNether}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (isImportingOverworld || isImportingNether) ? 'not-allowed' : 'pointer',
                opacity: (isImportingOverworld || isImportingNether) ? 0.6 : 1,
              }}
            >
              {isImportingOverworld ? 'Importing...' : hasImportedOverworld ? 'Re-import' : 'Import overworld regions-meta'}
            </button>
          </div>
        </div>

        {/* Nether Regions-meta Import */}
        <div
          style={{
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Nether Regions Meta</h3>
              {hasImportedNether && netherSource && (
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  Imported: {netherSource.originalFilename}
                  <br />
                  <span style={{ fontSize: '0.75rem' }}>
                    {new Date(netherSource.importedAtIso || '').toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleImportNetherRegionsMeta}
              disabled={isImportingOverworld || isImportingNether}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (isImportingOverworld || isImportingNether) ? 'not-allowed' : 'pointer',
                opacity: (isImportingOverworld || isImportingNether) ? 0.6 : 1,
              }}
            >
              {isImportingNether ? 'Importing...' : hasImportedNether ? 'Re-import' : 'Import nether regions-meta'}
            </button>
          </div>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            borderRadius: '4px',
            backgroundColor: importResult.success ? '#d4edda' : '#f8d7da',
            border: `1px solid ${importResult.success ? '#c3e6cb' : '#f5c6cb'}`,
            color: importResult.success ? '#155724' : '#721c24',
          }}
        >
          {importResult.success ? (
            <div>
              <strong>✓ Import successful!</strong>
              {importResult.regionCount !== undefined && (
                <div style={{ marginTop: '0.5rem' }}>
                  Imported {importResult.regionCount} region(s).
                </div>
              )}
            </div>
          ) : (
            <div>
              <strong>✗ Import failed</strong>
              {importResult.error && (
                <div style={{ marginTop: '0.5rem' }}>{importResult.error}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
