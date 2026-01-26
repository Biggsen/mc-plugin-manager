import { useState } from 'react'
import type { ServerProfile, ImportResult } from '../types'

interface ImportScreenProps {
  server: ServerProfile
  onServerUpdate: (server: ServerProfile) => void
}

export function ImportScreen({ server, onServerUpdate }: ImportScreenProps) {
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  async function handleImportRegionsMeta() {
    setIsImporting(true)
    setImportResult(null)

    try {
      // Show file dialog
      const filePath = await window.electronAPI.showImportDialog()
      if (!filePath) {
        setIsImporting(false)
        return
      }

      // Import regions-meta (world will be inferred from file)
      // We pass 'overworld' as a default, but the parser will use the file's world field
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
      setIsImporting(false)
    }
  }

  // Find imported regions-meta source (check overworld, nether, end, or world)
  const importedSource = server.sources.overworld || server.sources.nether || server.sources.end || server.sources.world
  const hasImported = !!importedSource

  return (
    <div>
      <h2>Import Region Files</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Import regions-meta.yml from Region Forge to populate your server profile with region data, onboarding, spawn center, and LevelledMobs metadata.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Regions-meta Import */}
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
              <h3 style={{ margin: 0 }}>Regions Meta</h3>
              {hasImported && importedSource && (
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  Imported: {importedSource.originalFilename}
                  <br />
                  <span style={{ fontSize: '0.75rem' }}>
                    {new Date(importedSource.importedAtIso || '').toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleImportRegionsMeta}
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
              {isImporting ? 'Importing...' : hasImported ? 'Re-import' : 'Import regions-meta'}
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
