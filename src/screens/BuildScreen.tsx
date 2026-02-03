import { useState, useEffect } from 'react'
import type { ServerProfile, BuildResult, BuildReport } from '../types'

const BUILD_PLUGINS = [
  { id: 'aa', label: 'AdvancedAchievements', overrideLabel: 'AdvancedAchievements config.yml (optional override)', dialogTitle: 'Select AdvancedAchievements config.yml', generateKey: 'generateAA', pathKey: 'aaPath' },
  { id: 'cw', label: 'CommandWhitelist', overrideLabel: 'CommandWhitelist config.yml (optional override)', dialogTitle: 'Select CommandWhitelist config.yml', generateKey: 'generateCW', pathKey: 'cwPath' },
  { id: 'ce', label: 'ConditionalEvents', overrideLabel: 'ConditionalEvents config.yml (optional override)', dialogTitle: 'Select ConditionalEvents config.yml', generateKey: 'generateCE', pathKey: 'cePath' },
  { id: 'lm', label: 'LevelledMobs', overrideLabel: 'LevelledMobs rules.yml (optional override)', dialogTitle: 'Select LevelledMobs rules.yml', generateKey: 'generateLM', pathKey: 'lmPath' },
  { id: 'mc', label: 'MyCommand', overrideLabel: 'MyCommand commands.yml (optional override)', dialogTitle: 'Select MyCommand commands.yml', generateKey: 'generateMC', pathKey: 'mcPath' },
  { id: 'tab', label: 'TAB', overrideLabel: 'TAB config.yml (optional override)', dialogTitle: 'Select TAB config.yml', generateKey: 'generateTAB', pathKey: 'tabPath' },
] as const

type BuildPluginId = (typeof BUILD_PLUGINS)[number]['id']

function getInitialPluginOptions(): Record<BuildPluginId, { generate: boolean; path: string }> {
  return BUILD_PLUGINS.reduce(
    (acc, p) => {
      acc[p.id] = { generate: false, path: '' }
      return acc
    },
    {} as Record<BuildPluginId, { generate: boolean; path: string }>
  )
}

interface BuildScreenProps {
  server: ServerProfile
}

export function BuildScreen({ server }: BuildScreenProps) {
  const [pluginOptions, setPluginOptions] = useState(getInitialPluginOptions)
  const [outDir, setOutDir] = useState(server.build.outputDirectory || '')
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [buildReport, setBuildReport] = useState<BuildReport | null>(null)
  const [pastBuilds, setPastBuilds] = useState<string[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showOverrides, setShowOverrides] = useState(false)

  async function handleSelectPluginFile(id: BuildPluginId) {
    const plugin = BUILD_PLUGINS.find((p) => p.id === id)
    if (!plugin) return
    const path = await window.electronAPI.showConfigFileDialog(
      plugin.dialogTitle,
      pluginOptions[id].path || undefined
    )
    if (path) {
      setPluginOptions((prev) => ({
        ...prev,
        [id]: { ...prev[id], path },
      }))
    }
  }

  async function handleSelectOutputDir() {
    const path = await window.electronAPI.showOutputDialog()
    if (path) {
      setOutDir(path)
    }
  }

  async function handleBuild() {
    // Validate on submit
    setValidationError(null)
    
    if (!BUILD_PLUGINS.some((p) => pluginOptions[p.id].generate)) {
      setValidationError('Please select at least one plugin to generate')
      return
    }

    if (!outDir || outDir.trim().length === 0) {
      setValidationError('Please select an output directory')
      return
    }

    setIsBuilding(true)
    setBuildResult(null)

    try {
      const payload: Record<string, boolean | string> = { outDir }
      for (const p of BUILD_PLUGINS) {
        payload[p.generateKey] = pluginOptions[p.id].generate
        if (pluginOptions[p.id].generate && pluginOptions[p.id].path) {
          payload[p.pathKey] = pluginOptions[p.id].path
        }
      }
      const result = await window.electronAPI.buildConfigs(
        server.id,
        payload as Parameters<typeof window.electronAPI.buildConfigs>[1]
      )

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

  return (
    <div>
      <h2>Build Configuration Files</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Generate or include config files for the selected plugins. Use bundled defaults or provide custom sources.
      </p>

      {/* Plugin Selection Checkboxes */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold' }}>
          Select Plugins to Generate:
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {BUILD_PLUGINS.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pluginOptions[p.id].generate}
                onChange={(e) =>
                  setPluginOptions((prev) => ({
                    ...prev,
                    [p.id]: { ...prev[p.id], generate: e.target.checked },
                  }))
                }
                style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
          Checked plugins will be generated. Leave paths empty to use bundled defaults, or provide custom config files.
        </div>
      </div>

      {/* Path Overrides - Collapsible */}
      {BUILD_PLUGINS.some((p) => pluginOptions[p.id].generate) && (
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setShowOverrides(!showOverrides)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#007acc',
              cursor: 'pointer',
              fontSize: '0.875rem',
              textDecoration: 'underline',
            }}
          >
            <span>{showOverrides ? '▼' : '▶'}</span>
            <span>Custom config file overrides (optional)</span>
          </button>

          {showOverrides && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
              {BUILD_PLUGINS.filter((p) => pluginOptions[p.id].generate).map((p) => (
                <div key={p.id}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    {p.overrideLabel}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={pluginOptions[p.id].path}
                      onChange={(e) =>
                        setPluginOptions((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], path: e.target.value },
                        }))
                      }
                      placeholder="Leave empty to use bundled default, or select custom file..."
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
                      onClick={() => handleSelectPluginFile(p.id)}
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
                    {pluginOptions[p.id].path ? 'Using custom file' : 'Will use bundled default template'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Output Directory */}
      <div style={{ marginBottom: '2rem' }}>
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

      {/* Validation Error */}
      {validationError && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            borderRadius: '4px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
          }}
        >
          {validationError}
        </div>
      )}

      {/* Build Button */}
      <div>
        <button
          onClick={handleBuild}
          disabled={isBuilding}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            backgroundColor: isBuilding ? '#ccc' : '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isBuilding ? 'not-allowed' : 'pointer',
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
              {(() => {
                const generated = BUILD_PLUGINS.filter((p) => buildReport.generated?.[p.id]).map((p) => '✓ ' + p.label)
                return generated.length > 0 ? generated.join(' • ') : 'None'
              })()}
            </div>
          </div>

          {buildReport.configSources && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Config Sources:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                {BUILD_PLUGINS.map((p) => {
                  const src = buildReport.configSources?.[p.id]
                  if (!src) return null
                  return (
                    <div key={p.id}>
                      <strong>{p.label}:</strong>{' '}
                      {src.isDefault ? (
                        <span style={{ color: '#28a745' }}>Bundled default</span>
                      ) : (
                        <span style={{ color: '#666' }}>{src.path}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {buildReport.computedCounts && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Computed Counts (TAB):</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>Overworld Regions</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {buildReport.computedCounts.overworldRegions}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>Overworld Hearts</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {buildReport.computedCounts.overworldHearts}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>Nether Regions</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {buildReport.computedCounts.netherRegions}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>Nether Hearts</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {buildReport.computedCounts.netherHearts}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>Villages</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {buildReport.computedCounts.villages}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {buildReport.computedCounts.total}
                  </div>
                </div>
              </div>
            </div>
          )}

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
