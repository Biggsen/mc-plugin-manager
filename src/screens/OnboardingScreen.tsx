import { useState, useEffect } from 'react'
import {
  Title,
  Text,
  TextInput,
  NumberInput,
  Select,
  Button,
  Group,
  Stack,
  SimpleGrid,
  Paper,
} from '@mantine/core'
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
    <Stack gap="xl">
      <Title order={2}>Onboarding Configuration</Title>
      <Text size="sm" c="dimmed">
        Configure the teleport location and starting region for new players.
      </Text>

      <Stack gap="lg">
        <Stack gap="xs">
          <Select
            label="Start Region ID"
            placeholder="-- Select region --"
            value={startRegionId}
            onChange={(v) => setStartRegionId(v ?? '')}
            data={[{ value: '', label: '-- Select region --' }, ...regionIds.map((id) => ({ value: id, label: id }))]}
          />
          {startRegionId && !hasStartRegion && (
            <Text size="sm" c="red">
              ⚠ Warning: This region ID is not in your imported regions.
            </Text>
          )}
          <Text size="sm" c="dimmed">
            This region will be marked with <code>first_join</code> discovery method.
          </Text>
        </Stack>

        <Stack gap="md">
          <Title order={4}>Teleport Location</Title>

          <Paper p="md" withBorder>
            <Text size="sm" c="dimmed" mb="xs">
              Quick paste location (format: &quot;world x y z&quot; or &quot;x y z&quot; or &quot;x,y,z&quot;):
            </Text>
            <Group gap="sm">
              <TextInput
                placeholder="world 0 64 0"
                value={locationString}
                onChange={(e) => setLocationString(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasteLocation()
                  }
                }}
                flex={1}
              />
              <Button color="green" onClick={handlePasteLocation}>
                Paste
              </Button>
            </Group>
          </Paper>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <TextInput
              label="World"
              value={teleport.world}
              onChange={(e) => setTeleport({ ...teleport, world: e.currentTarget.value })}
            />
            <NumberInput
              label="X"
              value={teleport.x}
              onChange={(v) => setTeleport({ ...teleport, x: (v as number) ?? 0 })}
            />
            <NumberInput
              label="Y"
              value={teleport.y ?? ''}
              onChange={(v) => setTeleport({ ...teleport, y: (v as number) ?? undefined })}
              placeholder="64"
            />
            <NumberInput
              label="Z"
              value={teleport.z}
              onChange={(v) => setTeleport({ ...teleport, z: (v as number) ?? 0 })}
            />
          </SimpleGrid>

          <SimpleGrid cols={2} spacing="md">
            <NumberInput
              label="Yaw (optional)"
              value={teleport.yaw ?? ''}
              onChange={(v) =>
                setTeleport({
                  ...teleport,
                  yaw: (v as number) ?? undefined,
                })
              }
              placeholder="0"
            />
            <NumberInput
              label="Pitch (optional)"
              value={teleport.pitch ?? ''}
              onChange={(v) =>
                setTeleport({
                  ...teleport,
                  pitch: (v as number) ?? undefined,
                })
              }
              placeholder="0"
            />
          </SimpleGrid>
        </Stack>

        <Group gap="md" align="center">
          <Button onClick={handleSave} loading={isSaving}>
            Save Onboarding Config
          </Button>
          {saveStatus === 'success' && (
            <Text size="sm" c="green">
              ✓ Saved successfully!
            </Text>
          )}
          {saveStatus === 'error' && (
            <Text size="sm" c="red">
              ✗ Failed to save
            </Text>
          )}
        </Group>
      </Stack>
    </Stack>
  )
}
