import { useState } from 'react'
import type { ServerProfile, BuildResult } from '../types'

interface BuildScreenProps {
  server: ServerProfile
}

export function BuildScreen({ server }: BuildScreenProps) {
  const [aaPath, setAaPath] = useState('')
  const [cePath, setCePath] = useState('')
  const [outDir, setOutDir] = useState(server.build.outputDirectory || '')
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)

  async function handleSelectAAFile() {
    const path = await window.electronAPI.showConfigFileDialog(
      'Select AdvancedAchievements config.yml',
      aaPath || undefined
    )
    if (path) {
      setAaPath(path)
    }
  }

  async function handleSelectCEFile() {
    const path = await window.electronAPI.showConfigFileDialog(
      'Select ConditionalEvents config.yml',
      cePath || undefined
    )
    if (path) {
      setCePath(path)
    }
  }

  async function handleSelectOutputDir() {
    const path = await window.electronAPI.showOutputDialog()
    if (path) {
      setOutDir(path)
    }
  }

  async function handleBuild() {
    if (!aaPath && !cePath) {
      setBuildResult({
        success: false,
        error: 'Please select at least one config file (AA or CE)',
      })
      return
    }

    if (!outDir) {
      setBuildResult({
        success: false,
        error: 'Please select output directory',
      })
      return
    }

    setIsBuilding(true)
    setBuildResult(null)

    try {
      const result = await window.electronAPI.buildConfigs(server.id, {
        aaPath,
        cePath, // Optional for M3, required for M4
        outDir,
      })

      setBuildResult(result)
    } catch (error: any) {
      setBuildResult({
        success: false,
        error: error.message || 'Unknown error during build',
      })
    } finally {
      setIsBuilding(false)
    }
  }

  const activeRegions = server.regions.filter((r) => r.discover.method !== 'disabled')
  const commandCount = activeRegions.length

  return (
    <div>
      <h2>Build Configuration Files</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Generate AdvancedAchievements and ConditionalEvents config files from your imported regions.
      </p>

      {/* Statistics */}
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          marginBottom: '2rem',
        }}
      >
        <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
          Ready to generate:
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
          {commandCount} achievement command{commandCount !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
          From {server.regions.length} total region{server.regions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* File Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* AA Config */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            AdvancedAchievements config.yml
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={aaPath}
              onChange={(e) => setAaPath(e.target.value)}
              placeholder="Select AdvancedAchievements config file..."
              readOnly
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
              }}
            />
            <button
              onClick={handleSelectAAFile}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Browse...
            </button>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
            Select the existing AdvancedAchievements config.yml file
          </div>
        </div>

        {/* CE Config */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            ConditionalEvents config.yml
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={cePath}
              onChange={(e) => setCePath(e.target.value)}
              placeholder="Select ConditionalEvents config file..."
              readOnly
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
              }}
            />
            <button
              onClick={handleSelectCEFile}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Browse...
            </button>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
            Select the existing ConditionalEvents config.yml file
          </div>
        </div>

        {/* Output Directory */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Output Directory <span style={{ color: '#d9534f' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={outDir}
              onChange={(e) => setOutDir(e.target.value)}
              placeholder="Select output directory..."
              readOnly
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
              }}
            />
            <button
              onClick={handleSelectOutputDir}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Browse...
            </button>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
            Generated files will be written to this directory
          </div>
        </div>
      </div>

      {/* Build Button */}
      <div>
        <button
          onClick={handleBuild}
          disabled={isBuilding || (!aaPath && !cePath) || !outDir}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            backgroundColor: isBuilding || (!aaPath && !cePath) || !outDir ? '#ccc' : '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isBuilding || (!aaPath && !cePath) || !outDir ? 'not-allowed' : 'pointer',
            opacity: isBuilding ? 0.6 : 1,
          }}
        >
          {isBuilding ? 'Building...' : 'Build Configs'}
        </button>
      </div>

      {/* Build Result */}
      {buildResult && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            borderRadius: '4px',
            backgroundColor: buildResult.success ? '#d4edda' : '#f8d7da',
            border: `1px solid ${buildResult.success ? '#c3e6cb' : '#f5c6cb'}`,
            color: buildResult.success ? '#155724' : '#721c24',
          }}
        >
          {buildResult.success ? (
            <div>
              <strong>✓ Build successful!</strong>
              {buildResult.buildId && (
                <div style={{ marginTop: '0.5rem' }}>
                  Build ID: {buildResult.buildId}
                  <br />
                  Output directory: {outDir}
                </div>
              )}
            </div>
          ) : (
            <div>
              <strong>✗ Build failed</strong>
              {buildResult.error && (
                <div style={{ marginTop: '0.5rem' }}>{buildResult.error}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
