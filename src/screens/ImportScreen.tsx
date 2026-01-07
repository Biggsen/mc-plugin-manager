import { useState } from 'react'
import type { ServerProfile, ImportResult } from '../types'

interface ImportScreenProps {
  server: ServerProfile
  onServerUpdate: (server: ServerProfile) => void
}

export function ImportScreen({ server, onServerUpdate }: ImportScreenProps) {
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  async function handleImport(world: 'overworld' | 'nether') {
    setIsImporting(true)
    setImportResult(null)

    try {
      // Show file dialog
      const filePath = await window.electronAPI.showImportDialog()
      if (!filePath) {
        setIsImporting(false)
        return
      }

      // Import regions
      const result = await window.electronAPI.importRegions(server.id, world, filePath)
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
      setIsImporting(false)
    }
  }

  const hasOverworld = !!server.sources.overworld
  const hasNether = !!server.sources.nether

  return (
    <div>
      <h2>Import Region Files</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Import Region Forge export files to populate your server profile with region data.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Overworld Import */}
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
              <h3 style={{ margin: 0 }}>Overworld Regions</h3>
              {hasOverworld && (
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  Imported: {server.sources.overworld?.originalFilename}
                  <br />
                  <span style={{ fontSize: '0.75rem' }}>
                    {new Date(server.sources.overworld?.importedAtIso || '').toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => handleImport('overworld')}
              disabled={isImporting}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isImporting ? 'not-allowed' : 'pointer',
                opacity: isImporting ? 0.6 : 1,
              }}
            >
              {isImporting ? 'Importing...' : hasOverworld ? 'Re-import' : 'Import Overworld'}
            </button>
          </div>
        </div>

        {/* Nether Import */}
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
              <h3 style={{ margin: 0 }}>Nether Regions</h3>
              {hasNether && (
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  Imported: {server.sources.nether?.originalFilename}
                  <br />
                  <span style={{ fontSize: '0.75rem' }}>
                    {new Date(server.sources.nether?.importedAtIso || '').toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => handleImport('nether')}
              disabled={isImporting}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isImporting ? 'not-allowed' : 'pointer',
                opacity: isImporting ? 0.6 : 1,
              }}
            >
              {isImporting ? 'Importing...' : hasNether ? 'Re-import' : 'Import Nether'}
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
