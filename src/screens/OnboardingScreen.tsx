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
} from '@mantine/core'
import type { ServerProfile, OnboardingConfig } from '../types'

interface OnboardingScreenProps {
  server: ServerProfile
  onServerUpdate: (server: ServerProfile) => void
}

export function OnboardingScreen({ server, onServerUpdate }: OnboardingScreenProps) {
  const [startRegionId, setStartRegionId] = useState(server.onboarding.startRegionId)
  const [teleport, setTeleport] = useState(server.onboarding.teleport)
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
          y: spawnCenter.y ?? server.onboarding.teleport.y,
        })
      }
    }
  }, [server])

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
