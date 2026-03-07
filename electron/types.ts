// Re-export shared types for use in electron main process (type-only; no runtime dependency on src)
export type {
  ServerId,
  RegionKind,
  DiscoverMethod,
  RewardRecipeId,
  ServerProfile,
  ImportedSource,
  RegionRecord,
  OnboardingConfig,
  ServerSummary,
  ServerSummaryWithStats,
  ImportResult,
  BuildResult,
  BuildReport,
} from '@shared/types'
