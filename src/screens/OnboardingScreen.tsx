import { useState, useEffect } from 'react'
import type { ServerProfile, OnboardingConfig } from '../types'

interface OnboardingScreenProps {
  server: ServerProfile
  onServerUpdate: (server: ServerProfile) => void
}

export function OnboardingScreen({ server, onServerUpdate }: OnboardingScreenProps) {
  const [startRegionId, setStartRegionId] = useState(server.onboarding.startRegionId)
  const [teleport, setTeleport] = useState(server.onboarding.teleport)
  const [locationString, setLocationString] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null)

  // Get unique region IDs for dropdown
  const regionIds = Array.from(new Set(server.regions.map((r) => r.id))).sort()

  useEffect(() => {
    setStartRegionId(server.onboarding.startRegionId)
    setTeleport(server.onboarding.teleport)
    
    // Auto-prefill from spawn center if teleport is empty/default
    // Precedence: profile.spawnCenter -> sources.overworld -> sources.nether -> sources.end -> legacy sources.overworld
    const hasEmptyTeleport = !server.onboarding.teleport.world || 
      (server.onboarding.teleport.x === 0 && server.onboarding.teleport.z === 0)
    if (hasEmptyTeleport) {
      const spawnCenter = server.spawnCenter ||
        server.sources.overworld?.spawnCenter ||
        server.sources.nether?.spawnCenter ||
        server.sources.end?.spawnCenter ||
        server.sources.world?.spawnCenter
      
      if (spawnCenter) {
        setTeleport({
          world: spawnCenter.world,
          x: spawnCenter.x,
          z: spawnCenter.z,
          // Don't set y from spawnCenter (it has no y); use existing y or leave undefined
          y: server.onboarding.teleport.y,
        })
      }
    }
  }, [server])

  function handlePasteLocation() {
    // Try to parse common location formats
    // Format: "world x y z" or "x y z" or "x,y,z"
    const text = locationString.trim()
    
    // Try space-separated: "world x y z" or "x y z"
    const spaceParts = text.split(/\s+/)
    if (spaceParts.length === 4) {
      setTeleport({
        world: spaceParts[0],
        x: parseFloat(spaceParts[1]) || 0,
        y: parseFloat(spaceParts[2]) || 0,
        z: parseFloat(spaceParts[3]) || 0,
      })
    } else if (spaceParts.length === 3) {
      setTeleport({
        ...teleport,
        x: parseFloat(spaceParts[0]) || 0,
        y: parseFloat(spaceParts[1]) || undefined,
        z: parseFloat(spaceParts[2]) || 0,
      })
    } else {
      // Try comma-separated: "x,y,z"
      const commaParts = text.split(',')
      if (commaParts.length === 3) {
        setTeleport({
          ...teleport,
          x: parseFloat(commaParts[0]) || 0,
          y: parseFloat(commaParts[1]) || undefined,
          z: parseFloat(commaParts[2]) || 0,
        })
      }
    }
    
    setLocationString('')
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveStatus(null)

    try {
      const onboarding: OnboardingConfig = {
        startRegionId,
        teleport,
      }

      const updated = await window.electronAPI.updateOnboarding(server.id, onboarding)
      if (updated) {
        onServerUpdate(updated)
        setSaveStatus('success')
        setTimeout(() => setSaveStatus(null), 2000)
      } else {
        setSaveStatus('error')
      }
    } catch (error) {
      console.error('Failed to save onboarding:', error)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  const hasStartRegion = regionIds.includes(startRegionId)

  return (
    <div>
      <h2>Onboarding Configuration</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Configure the teleport location and starting region for new players.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Start Region */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Start Region ID
          </label>
          <select
            value={startRegionId}
            onChange={(e) => setStartRegionId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            <option value="">-- Select region --</option>
            {regionIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          {startRegionId && !hasStartRegion && (
            <div style={{ marginTop: '0.5rem', color: '#d9534f', fontSize: '0.875rem' }}>
              ⚠ Warning: This region ID is not in your imported regions.
            </div>
          )}
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
            This region will be marked with <code>first_join</code> discovery method.
          </div>
        </div>

        {/* Teleport Location */}
        <div>
          <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 'bold' }}>
            Teleport Location
          </label>

          {/* Quick paste */}
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: '#666' }}>
              Quick paste location (format: "world x y z" or "x y z" or "x,y,z"):
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="world 0 64 0"
                value={locationString}
                onChange={(e) => setLocationString(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasteLocation()
                  }
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
              <button
                onClick={handlePasteLocation}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '1rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Paste
              </button>
            </div>
          </div>

          {/* Manual entry */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                World
              </label>
              <input
                type="text"
                value={teleport.world}
                onChange={(e) => setTeleport({ ...teleport, world: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                X
              </label>
              <input
                type="number"
                value={teleport.x}
                onChange={(e) => setTeleport({ ...teleport, x: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Y
              </label>
              <input
                type="number"
                value={teleport.y ?? ''}
                onChange={(e) => setTeleport({ ...teleport, y: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="64"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Z
              </label>
              <input
                type="number"
                value={teleport.z}
                onChange={(e) => setTeleport({ ...teleport, z: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

          {/* Optional yaw/pitch */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Yaw (optional)
              </label>
              <input
                type="number"
                value={teleport.yaw ?? ''}
                onChange={(e) =>
                  setTeleport({
                    ...teleport,
                    yaw: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Pitch (optional)
              </label>
              <input
                type="number"
                value={teleport.pitch ?? ''}
                onChange={(e) =>
                  setTeleport({
                    ...teleport,
                    pitch: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Save Onboarding Config'}
          </button>
          {saveStatus === 'success' && (
            <span style={{ marginLeft: '1rem', color: '#28a745' }}>✓ Saved successfully!</span>
          )}
          {saveStatus === 'error' && (
            <span style={{ marginLeft: '1rem', color: '#d9534f' }}>✗ Failed to save</span>
          )}
        </div>
      </div>
    </div>
  )
}
