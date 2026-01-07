import { useState, useEffect } from 'react'
import type { ServerProfile, BuildResult, BuildReport } from '../types'

interface BuildScreenProps {
  server: ServerProfile
}

export function BuildScreen({ server }: BuildScreenProps) {
  const [aaPath, setAaPath] = useState('')
  const [cePath, setCePath] = useState('')
  const [outDir, setOutDir] = useState(server.build.outputDirectory || '')
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [buildReport, setBuildReport] = useState<BuildReport | null>(null)
  const [pastBuilds, setPastBuilds] = useState<string[]>([])

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
      
      // Load build report if successful
      if (result.success && result.buildId) {
        await loadBuildReport(result.buildId)
      } else {
        setBuildReport(null)
      }
    } catch (error: any) {
      setBuildResult({
        success: false,
        error: error.message || 'Unknown error during build',
      })
    } finally {
      setIsBuilding(false)
    }
  }

  useEffect(() => {
    loadPastBuilds()
  }, [server.id])

  async function loadPastBuilds() {
    try {
      const builds = await window.electronAPI.listBuilds(server.id)
      setPastBuilds(builds)
    } catch (error) {
      console.error('Failed to load past builds:', error)
    }
  }

  async function loadBuildReport(buildId: string) {
    try {
      const report = await window.electronAPI.readBuildReport(server.id, buildId)
      setBuildReport(report)
    } catch (error) {
      console.error('Failed to load build report:', error)
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
                <div style={{ marginTop: '0.5rem' }}>
                  {buildResult.error}
                  {buildResult.buildId && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      Build ID: {buildResult.buildId}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Build Report */}
      {buildReport && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Build Report</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Build ID: <strong>{buildReport.buildId}</strong>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Timestamp: {new Date(buildReport.timestamp).toLocaleString()}
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Region Counts:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Overworld</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {buildReport.regionCounts.overworld}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Nether</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {buildReport.regionCounts.nether}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Hearts</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {buildReport.regionCounts.hearts}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Villages</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {buildReport.regionCounts.villages}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Regions</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {buildReport.regionCounts.regions}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>System</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {buildReport.regionCounts.system}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Generated:</div>
            <div>
              {buildReport.generated.aa && '✓ AdvancedAchievements'}
              {buildReport.generated.aa && buildReport.generated.ce && ' • '}
              {buildReport.generated.ce && '✓ ConditionalEvents'}
            </div>
          </div>

          {buildReport.warnings && buildReport.warnings.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#856404' }}>
                Warnings:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#856404' }}>
                {buildReport.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {buildReport.errors && buildReport.errors.length > 0 && (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#721c24' }}>
                Errors:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#721c24' }}>
                {buildReport.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Past Builds */}
      {pastBuilds.length > 0 && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Past Builds</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pastBuilds.map((buildId) => (
              <button
                key={buildId}
                onClick={() => loadBuildReport(buildId)}
                style={{
                  padding: '0.5rem',
                  textAlign: 'left',
                  backgroundColor: buildReport?.buildId === buildId ? '#e7f3ff' : 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {buildId}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
