import { useState, useEffect } from 'react'
import {
  Title,
  Text,
  TextInput,
  Button,
  Checkbox,
  Group,
  Stack,
  SimpleGrid,
  Paper,
  Alert,
  Collapse,
  UnstyledButton,
  List,
} from '@mantine/core'
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
    <Stack gap="xl">
      <Text size="sm" c="dimmed">
        Generate or include config files for the selected plugins. Use bundled defaults or provide custom sources.
      </Text>

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Select Plugins to Generate:
        </Text>
        <Stack gap="xs">
            {BUILD_PLUGINS.map((p) => (
            <Checkbox
              key={p.id}
              label={p.label}
              checked={pluginOptions[p.id].generate}
              onChange={() =>
                setPluginOptions((prev) => ({
                  ...prev,
                  [p.id]: { ...prev[p.id], generate: !prev[p.id].generate },
                }))
              }
            />
          ))}
        </Stack>
        <Text size="sm" c="dimmed">
          Checked plugins will be generated. Leave paths empty to use bundled defaults, or provide custom config files.
        </Text>
      </Stack>

      {BUILD_PLUGINS.some((p) => pluginOptions[p.id].generate) && (
        <Stack gap="md">
          <UnstyledButton
            onClick={() => setShowOverrides(!showOverrides)}
            style={{ color: 'var(--mantine-color-blue-6)', textDecoration: 'underline', fontSize: '0.875rem' }}
          >
            {showOverrides ? '▼' : '▶'} Custom config file overrides (optional)
          </UnstyledButton>

          <Collapse in={showOverrides}>
            <Stack gap="lg">
              {BUILD_PLUGINS.filter((p) => pluginOptions[p.id].generate).map((p) => (
                <Stack key={p.id} gap="xs">
                  <Text size="sm" fw={600}>
                    {p.overrideLabel}
                  </Text>
                  <Group gap="sm">
                    <TextInput
                      value={pluginOptions[p.id].path}
                      placeholder="Leave empty to use bundled default, or select custom file..."
                      readOnly
                      flex={1}
                    />
                    <Button variant="default" onClick={() => handleSelectPluginFile(p.id)}>
                      Browse...
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {pluginOptions[p.id].path ? 'Using custom file' : 'Will use bundled default template'}
                  </Text>
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </Stack>
      )}

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Output Directory <Text component="span" c="red">*</Text>
        </Text>
        <Group gap="sm">
          <TextInput
            value={outDir}
            onChange={(e) => setOutDir(e.currentTarget.value)}
            placeholder="Select output directory..."
            readOnly
            flex={1}
          />
          <Button variant="default" onClick={handleSelectOutputDir}>
            Browse...
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Generated files will be written to this directory
        </Text>
      </Stack>

      {validationError && (
        <Alert color="red" title="Validation Error">
          {validationError}
        </Alert>
      )}

      <Button onClick={handleBuild} loading={isBuilding}>
        Build Configs
      </Button>

      {buildResult && (
        <Alert
          color={buildResult.success ? 'green' : 'red'}
          title={buildResult.success ? '✓ Build successful!' : '✗ Build failed'}
        >
          {buildResult.success ? (
            buildResult.buildId && (
              <Text size="sm">
                Build ID: {buildResult.buildId}
                <br />
                Output directory: {outDir}
              </Text>
            )
          ) : (
            <>
              {buildResult.error && (
                <>
                  <Text size="sm">{buildResult.error}</Text>
                  {buildResult.buildId && (
                    <Text size="xs" mt="xs">
                      Build ID: {buildResult.buildId}
                    </Text>
                  )}
                </>
              )}
            </>
          )}
        </Alert>
      )}

      {buildReport && (
        <Paper p="lg" withBorder>
          <Title order={3} mb="md">Build Report</Title>

          <Stack gap="xs" mb="md">
            <Text size="sm" c="dimmed">
              Build ID: <Text component="span" fw={600} c="dark">{buildReport.buildId}</Text>
            </Text>
            <Text size="sm" c="dimmed">
              Timestamp: {new Date(buildReport.timestamp).toLocaleString()}
            </Text>
          </Stack>

          <Stack gap="md" mb="md">
            <Text size="sm" fw={600}>Region Counts:</Text>
            <SimpleGrid cols={{ base: 3, sm: 5 }} spacing="md">
              {[
                { label: 'Overworld', value: buildReport.regionCounts.overworld },
                { label: 'Nether', value: buildReport.regionCounts.nether },
                { label: 'Hearts', value: buildReport.regionCounts.hearts },
                { label: 'Villages', value: buildReport.regionCounts.villages },
                { label: 'Regions', value: buildReport.regionCounts.regions },
                { label: 'System', value: buildReport.regionCounts.system },
              ].map(({ label, value }) => (
                <Stack key={label} gap={4}>
                  <Text size="sm" c="dimmed">{label}</Text>
                  <Text size="lg" fw={700}>{value}</Text>
                </Stack>
              ))}
            </SimpleGrid>
          </Stack>

          <Stack gap="xs" mb="md">
            <Text size="sm" fw={600}>Generated:</Text>
            <Text size="sm">
              {(() => {
                const generated = BUILD_PLUGINS.filter((p) => buildReport.generated?.[p.id]).map((p) => '✓ ' + p.label)
                return generated.length > 0 ? generated.join(' • ') : 'None'
              })()}
            </Text>
          </Stack>

          {buildReport.configSources && (
            <Stack gap="xs" mb="md">
              <Text size="sm" fw={600}>Config Sources:</Text>
              <Stack gap={4}>
                {BUILD_PLUGINS.map((p) => {
                  const src = buildReport.configSources?.[p.id]
                  if (!src) return null
                  return (
                    <Text key={p.id} size="sm">
                      <Text component="span" fw={600}>{p.label}:</Text>{' '}
                      {src.isDefault ? (
                        <Text component="span" c="green">Bundled default</Text>
                      ) : (
                        <Text component="span" c="dimmed">{src.path}</Text>
                      )}
                    </Text>
                  )
                })}
              </Stack>
            </Stack>
          )}

          {buildReport.computedCounts && (
            <Stack gap="md" mb="md">
              <Text size="sm" fw={600}>Computed Counts (TAB):</Text>
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                {[
                  { label: 'Overworld Regions', value: buildReport.computedCounts.overworldRegions },
                  { label: 'Overworld Hearts', value: buildReport.computedCounts.overworldHearts },
                  { label: 'Nether Regions', value: buildReport.computedCounts.netherRegions },
                  { label: 'Nether Hearts', value: buildReport.computedCounts.netherHearts },
                  { label: 'Villages', value: buildReport.computedCounts.villages },
                  { label: 'Total', value: buildReport.computedCounts.total },
                ].map(({ label, value }) => (
                  <Stack key={label} gap={4}>
                    <Text size="sm" c="dimmed">{label}</Text>
                    <Text size="lg" fw={700}>{value}</Text>
                  </Stack>
                ))}
              </SimpleGrid>
            </Stack>
          )}

          {buildReport.warnings && buildReport.warnings.length > 0 && (
            <Stack gap="xs" mb="md">
              <Text size="sm" fw={600} c="yellow.7">Warnings:</Text>
              <List size="sm" c="yellow.7">
                {buildReport.warnings.map((warning, i) => (
                  <List.Item key={i}>{warning}</List.Item>
                ))}
              </List>
            </Stack>
          )}

          {buildReport.errors && buildReport.errors.length > 0 && (
            <Stack gap="xs">
              <Text size="sm" fw={600} c="red">Errors:</Text>
              <List size="sm" c="red">
                {buildReport.errors.map((error, i) => (
                  <List.Item key={i}>{error}</List.Item>
                ))}
              </List>
            </Stack>
          )}
        </Paper>
      )}

      {pastBuilds.length > 0 && (
        <Paper p="md" withBorder>
          <Title order={3} mb="md">Past Builds</Title>
          <Stack gap="xs">
            {pastBuilds.map((buildId) => (
              <Button
                key={buildId}
                variant={buildReport?.buildId === buildId ? 'light' : 'default'}
                onClick={() => loadBuildReport(buildId)}
                fullWidth
                justify="flex-start"
              >
                {buildId}
              </Button>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  )
}
