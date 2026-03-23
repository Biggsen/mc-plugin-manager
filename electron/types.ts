// Re-export shared types for use in electron main process (type-only; no runtime dependency on src)
export type {
  ServerId,
  PluginType,
  GeneratorVersionKey,
  RegionKind,
  DiscoverMethod,
  RewardRecipeId,
  ServerProfile,
  DiscordSrvSettings,
  ImportedSource,
  RegionRecord,
  OnboardingConfig,
  ServerSummary,
  ServerSummaryWithStats,
  ImportResult,
  BuildResult,
  BuildReport,
} from '@shared/types'

export const PLUGIN_TYPES: import('@shared/types').PluginType[] = ['aa', 'ce', 'tab', 'lm', 'mc', 'cw']
