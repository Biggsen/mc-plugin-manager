import { useState, useEffect } from 'react'
import type { ServerProfile, BuildResult, BuildReport } from '../types'

interface BuildScreenProps {
  server: ServerProfile
}

export function BuildScreen({ server }: BuildScreenProps) {
  const [generateAA, setGenerateAA] = useState(false)
  const [generateCE, setGenerateCE] = useState(false)
  const [generateTAB, setGenerateTAB] = useState(false)
  const [generateLM, setGenerateLM] = useState(false)
  const [generateMC, setGenerateMC] = useState(false)
  const [generateCW, setGenerateCW] = useState(false)
  const [aaPath, setAaPath] = useState('')
  const [cePath, setCePath] = useState('')
  const [tabPath, setTabPath] = useState('')
  const [lmPath, setLmPath] = useState('')
  const [mcPath, setMcPath] = useState('')
  const [cwPath, setCwPath] = useState('')
  const [outDir, setOutDir] = useState(server.build.outputDirectory || '')
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [buildReport, setBuildReport] = useState<BuildReport | null>(null)
  const [pastBuilds, setPastBuilds] = useState<string[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showOverrides, setShowOverrides] = useState(false)

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

  async function handleSelectTABFile() {
    const path = await window.electronAPI.showConfigFileDialog(
      'Select TAB config.yml',
      tabPath || undefined
    )
    if (path) {
      setTabPath(path)
    }
  }

  async function handleSelectLMFile() {
    const path = await window.electronAPI.showConfigFileDialog(
      'Select LevelledMobs rules.yml',
      lmPath || undefined
    )
    if (path) {
      setLmPath(path)
    }
  }

  async function handleSelectMCFile() {
    const path = await window.electronAPI.showConfigFileDialog(
      'Select MyCommand commands.yml',
      mcPath || undefined
    )
    if (path) {
      setMcPath(path)
    }
  }

  async function handleSelectCWFile() {
    const path = await window.electronAPI.showConfigFileDialog(
      'Select CommandWhitelist config.yml',
      cwPath || undefined
    )
    if (path) {
      setCwPath(path)
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
    
    if (!generateAA && !generateCE && !generateTAB && !generateLM && !generateMC && !generateCW) {
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
      const result = await window.electronAPI.buildConfigs(server.id, {
        generateAA,
        generateCE,
        generateTAB,
        generateLM,
        generateMC,
        generateCW,
        ...(generateAA && aaPath ? { aaPath } : {}),
        ...(generateCE && cePath ? { cePath } : {}),
        ...(generateTAB && tabPath ? { tabPath } : {}),
        ...(generateLM && lmPath ? { lmPath } : {}),
        ...(generateMC && mcPath ? { mcPath } : {}),
        ...(generateCW && cwPath ? { cwPath } : {}),
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={generateAA}
              onChange={(e) => setGenerateAA(e.target.checked)}
              style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
            />
            <span>AdvancedAchievements</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={generateCW}
              onChange={(e) => setGenerateCW(e.target.checked)}
              style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
            />
            <span>CommandWhitelist</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={generateCE}
              onChange={(e) => setGenerateCE(e.target.checked)}
              style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
            />
            <span>ConditionalEvents</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={generateLM}
              onChange={(e) => setGenerateLM(e.target.checked)}
              style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
            />
            <span>LevelledMobs</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={generateMC}
              onChange={(e) => setGenerateMC(e.target.checked)}
              style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
            />
            <span>MyCommand</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={generateTAB}
              onChange={(e) => setGenerateTAB(e.target.checked)}
              style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
            />
            <span>TAB</span>
          </label>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
          Checked plugins will be generated. Leave paths empty to use bundled defaults, or provide custom config files.
        </div>
      </div>

      {/* Path Overrides - Collapsible */}
      {(generateAA || generateCE || generateTAB || generateLM || generateMC || generateCW) && (
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
        {/* AA Config */}
        {generateAA && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              AdvancedAchievements config.yml (optional override)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={aaPath}
                onChange={(e) => setAaPath(e.target.value)}
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
              {aaPath ? 'Using custom file' : 'Will use bundled default template'}
            </div>
          </div>
        )}

        {/* CE Config */}
        {generateCE && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              ConditionalEvents config.yml (optional override)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={cePath}
                onChange={(e) => setCePath(e.target.value)}
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
              {cePath ? 'Using custom file' : 'Will use bundled default template'}
            </div>
          </div>
        )}

        {/* TAB Config */}
        {generateTAB && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              TAB config.yml (optional override)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={tabPath}
                onChange={(e) => setTabPath(e.target.value)}
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
                onClick={handleSelectTABFile}
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
              {tabPath ? 'Using custom file' : 'Will use bundled default template'}
            </div>
          </div>
        )}

        {/* LM Config */}
        {generateLM && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              LevelledMobs rules.yml (optional override)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={lmPath}
                onChange={(e) => setLmPath(e.target.value)}
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
                onClick={handleSelectLMFile}
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
              {lmPath ? 'Using custom file' : 'Will use bundled default template'}
            </div>
          </div>
        )}

        {/* MC Config */}
        {generateMC && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              MyCommand commands.yml (optional override)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={mcPath}
                onChange={(e) => setMcPath(e.target.value)}
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
                onClick={handleSelectMCFile}
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
              {mcPath ? 'Using custom file' : 'Will use bundled default template'}
            </div>
          </div>
        )}

        {/* CW Config */}
        {generateCW && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              CommandWhitelist config.yml (optional override)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={cwPath}
                onChange={(e) => setCwPath(e.target.value)}
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
                onClick={handleSelectCWFile}
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
              {cwPath ? 'Using custom file' : 'Will use bundled default template'}
            </div>
          </div>
        )}
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
              {buildReport.generated.aa && '✓ AdvancedAchievements'}
              {buildReport.generated.aa && (buildReport.generated.ce || buildReport.generated.tab || buildReport.generated.lm || buildReport.generated.mc || buildReport.generated.cw) && ' • '}
              {buildReport.generated.ce && '✓ ConditionalEvents'}
              {buildReport.generated.ce && (buildReport.generated.tab || buildReport.generated.lm || buildReport.generated.mc || buildReport.generated.cw) && ' • '}
              {buildReport.generated.tab && '✓ TAB'}
              {buildReport.generated.tab && (buildReport.generated.lm || buildReport.generated.mc || buildReport.generated.cw) && ' • '}
              {buildReport.generated.lm && '✓ LevelledMobs'}
              {buildReport.generated.lm && (buildReport.generated.mc || buildReport.generated.cw) && ' • '}
              {buildReport.generated.mc && '✓ MyCommand'}
              {buildReport.generated.mc && buildReport.generated.cw && ' • '}
              {buildReport.generated.cw && '✓ CommandWhitelist'}
            </div>
          </div>

          {buildReport.configSources && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Config Sources:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                {buildReport.configSources.aa && (
                  <div>
                    <strong>AdvancedAchievements:</strong>{' '}
                    {buildReport.configSources.aa.isDefault ? (
                      <span style={{ color: '#28a745' }}>Bundled default</span>
                    ) : (
                      <span style={{ color: '#666' }}>{buildReport.configSources.aa.path}</span>
                    )}
                  </div>
                )}
                {buildReport.configSources.ce && (
                  <div>
                    <strong>ConditionalEvents:</strong>{' '}
                    {buildReport.configSources.ce.isDefault ? (
                      <span style={{ color: '#28a745' }}>Bundled default</span>
                    ) : (
                      <span style={{ color: '#666' }}>{buildReport.configSources.ce.path}</span>
                    )}
                  </div>
                )}
                {buildReport.configSources.tab && (
                  <div>
                    <strong>TAB:</strong>{' '}
                    {buildReport.configSources.tab.isDefault ? (
                      <span style={{ color: '#28a745' }}>Bundled default</span>
                    ) : (
                      <span style={{ color: '#666' }}>{buildReport.configSources.tab.path}</span>
                    )}
                  </div>
                )}
                {buildReport.configSources.lm && (
                  <div>
                    <strong>LevelledMobs:</strong>{' '}
                    {buildReport.configSources.lm.isDefault ? (
                      <span style={{ color: '#28a745' }}>Bundled default</span>
                    ) : (
                      <span style={{ color: '#666' }}>{buildReport.configSources.lm.path}</span>
                    )}
                  </div>
                )}
                {buildReport.configSources.mc && (
                  <div>
                    <strong>MyCommand:</strong>{' '}
                    {buildReport.configSources.mc.isDefault ? (
                      <span style={{ color: '#28a745' }}>Bundled default</span>
                    ) : (
                      <span style={{ color: '#666' }}>{buildReport.configSources.mc.path}</span>
                    )}
                  </div>
                )}
                {buildReport.configSources.cw && (
                  <div>
                    <strong>CommandWhitelist:</strong>{' '}
                    {buildReport.configSources.cw.isDefault ? (
                      <span style={{ color: '#28a745' }}>Bundled default</span>
                    ) : (
                      <span style={{ color: '#666' }}>{buildReport.configSources.cw.path}</span>
                    )}
                  </div>
                )}
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
