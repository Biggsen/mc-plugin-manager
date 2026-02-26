# Refactor — Code Quality & Maintainability Specification

**Status: Pending**

## Purpose

Improve code quality, reduce duplication, and increase maintainability through targeted refactoring. This spec addresses findings from a codebase evaluation: duplicated logic, oversized files, inconsistent types, and missing abstractions.

---

## Scope

- **In scope**: Shared utilities, type consolidation, IPC handler modularization, build-configs handler extraction, YAML/region stats standardization.
- **Out of scope**: Feature changes, UI redesign, dependency upgrades beyond what refactor requires.

---

## Refactoring Targets

### 1. Shared String Utilities (High Priority)

**Problem**: `snakeToTitleCase`, `formatRegionTitle`, and `formatRegionLabel` are duplicated across 5+ files. Server name sanitization appears 7 times in `ipc.ts`.

**Current locations**:
| Function | Files |
|----------|-------|
| `snakeToTitleCase` | `electron/lmGenerator.ts:32`, `electron/aaGenerator.ts:129` |
| `formatRegionTitle` | `electron/loreBooksGenerator.ts:19`, `src/components/LoreBookPreview.tsx:15` |
| `formatRegionLabel` | `src/screens/LoreBooksScreen.tsx:16` |
| `profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')` | `electron/ipc.ts` (lines 90, 469, 517, 567, 619, 655, 689) |

**Solution**:
- Create `electron/utils/stringFormatters.ts`:
  - `snakeToTitleCase(str: string): string`
  - `formatRegionTitle(id: string): string` — same logic as snakeToTitleCase for region IDs
  - `sanitizeServerName(name: string): string` — `name.toLowerCase().replace(/[^a-z0-9]/g, '-')`
- Create `src/utils/stringFormatters.ts` (or shared package) for renderer:
  - `formatRegionTitle`, `formatRegionLabel` (latter uses `displayNameOverride ?? formatRegionTitle(id)`)
- Replace all usages; remove duplicated implementations.

**Acceptance**: No duplicated string formatting logic; all 7 sanitization calls use `sanitizeServerName`.

---

### 2. Type Consolidation (High Priority)

**Problem**: `RegionRecord` is redefined in 8 places. `ipc.ts` uses `type X = any` for `ServerProfile`, `BuildResult`, etc., despite proper types existing in `src/types/index.ts`.

**Current locations**:
- Canonical: `src/types/index.ts`
- Duplicates: `electron/aaGenerator.ts`, `ceGenerator.ts`, `lmGenerator.ts`, `tabGenerator.ts`, `regionParser.ts`, `loreBooksGenerator.ts`, `mcGenerator.ts`, `preload.ts`

**Solution**:
- Create `electron/types.ts` that re-exports from `src/types/index.ts` (or use path alias).
- Update all electron modules to `import type { RegionRecord } from './types'` (or shared path).
- Remove `type ServerProfile = any` etc. from `ipc.ts`; import from `src/types/index.ts`.
- Ensure `tsconfig.electron.json` can resolve `src/types` (e.g. via `paths` or relative `../src/types`).

**Acceptance**: Single source of truth for `RegionRecord`, `ServerProfile`, `BuildResult`, `BuildReport`, `OnboardingConfig`; no `type X = any` in ipc.ts.

---

### 3. Extract `resolveConfigPath` (Medium Priority)

**Problem**: `resolveConfigPath` in `ipc.ts` (lines 34–65) is 30+ lines with nested ternaries. Config filename mapping is verbose.

**Solution**:
- Create `electron/utils/configPathResolver.ts`.
- Extract `resolveConfigPath(type: PluginType, userProvidedPath?: string): string`.
- Use a lookup table for `type → filename` instead of chained ternaries:
  ```ts
  const CONFIG_FILENAMES: Record<PluginType, string> = {
    aa: 'advancedachievements-config.yml',
    ce: 'conditionalevents-config.yml',
    tab: 'tab-config.yml',
    lm: 'levelledmobs-rules.yml',
    mc: 'mycommand-commands.yml',
    cw: 'commandwhitelist-config.yml',
  }
  ```
- Import and use in `ipc.ts`.

**Acceptance**: `resolveConfigPath` lives in dedicated module; ipc.ts imports it.

---

### 4. Extract Build Plugin Helper (High Priority)

**Problem**: The `build-configs` handler in `ipc.ts` (~400 lines) repeats the same pattern for each plugin: resolve path → generate → validate diff → write output → write build dir → track sources. Each block is 60–80 lines.

**Solution**:
- Create `electron/build/buildPluginConfig.ts` (or similar).
- Define a generic helper, e.g.:
  ```ts
  async function buildPlugin(
    type: PluginType,
    profile: ServerProfile,
    inputs: BuildInputs,
    buildDir: string
  ): Promise<{ generated: boolean; configSource?: ConfigSource }>
  ```
- Internal logic: resolve path, call appropriate generator (switch on type), run diff validator, write to `inputs.outDir` and `buildDir`, return source info.
- Refactor `build-configs` handler to loop over requested plugins and call `buildPlugin` for each.
- Keep validation (at least one plugin, outDir set) in the handler.

**Acceptance**: No repeated 60-line blocks per plugin; single `buildPlugin`-style abstraction; handler reduced to orchestration.

---

### 5. Split `electron/ipc.ts` (Medium Priority)

**Problem**: `ipc.ts` is 856 lines. Handlers are grouped by concern but all live in one file.

**Solution**:
- Create `electron/ipc/` directory:
  - `handlers/serverHandlers.ts` — list-servers, create-server, get-server, update-onboarding
  - `handlers/importHandlers.ts` — import-regions, import-regions-meta
  - `handlers/buildHandlers.ts` — build-configs
  - `handlers/loreBookHandlers.ts` — export-lore-books, update-region-lore-book
  - `handlers/dialogHandlers.ts` — show-import-dialog, show-config-file-dialog, show-output-dialog
  - `index.ts` — registers all handlers with `ipcMain.handle`
- `electron/main.ts` (or equivalent) imports from `electron/ipc/index.ts` instead of `ipc.ts`.
- Remove or archive original `ipc.ts` after migration.

**Acceptance**: No single file > ~200 lines for IPC handlers; clear separation by domain.

---

### 6. Shared Region Stats (Medium Priority)

**Problem**: Region counting/filtering logic is duplicated in `ipc.ts`, `ServerDetailScreen.tsx`, and `tabGenerator.ts`.

**Solution**:
- Create `electron/utils/regionStats.ts` (or `src/utils/regionStats.ts` if used by renderer):
  - `computeRegionCounts(regions)` — move from `tabGenerator` or re-export
  - `computeRegionStats(regions)` — overworld/nether/hearts/villages/regions/system counts for build report
- Use in `ipc.ts` build handler and `ServerDetailScreen.tsx`.
- Ensure `tabGenerator` uses the same utility (or imports from it).

**Acceptance**: Single implementation for region stats; both electron and renderer use it where applicable.

---

### 7. Replace `any` with Proper Types (Medium Priority)

**Problem**: 50+ uses of `any` across electron code, especially in `ipc.ts`, `storage.ts`, `diffValidator.ts`, `aaGenerator.ts`.

**Solution**:
- Define `IpcMainInvokeEvent` type for IPC handlers (from Electron types).
- Replace `(r: any)` with `(r: RegionRecord)` in filters.
- Replace `config: any` in diff validator with a generic or `Record<string, unknown>`.
- Replace `configSources: any` with `BuildResult['configSources']`.
- Use `unknown` instead of `any` for truly unknown values; narrow with type guards.

**Acceptance**: No `any` in critical paths (ipc handlers, storage, diff validator); strict mode passes.

---

### 8. Plugin Type Constants (Low Priority)

**Problem**: Plugin type strings (`'aa'`, `'ce'`, etc.) are magic strings throughout.

**Solution**:
- Add to `src/types/index.ts` or `electron/types.ts`:
  ```ts
  export type PluginType = 'aa' | 'ce' | 'tab' | 'lm' | 'mc' | 'cw'
  export const PLUGIN_TYPES: PluginType[] = ['aa', 'ce', 'tab', 'lm', 'mc', 'cw']
  ```
- Use `PluginType` in `resolveConfigPath`, `buildPlugin`, and build handler.

**Acceptance**: No raw plugin strings; `PluginType` used consistently.

---

### 9. Standardize YAML Formatting (Low Priority)

**Problem**: AA, CE, and LM generators use different YAML stringify options.

**Solution**:
- Create `electron/utils/yamlOptions.ts` with shared `YAML_STRINGIFY_OPTIONS`.
- Use in all generators for consistent output style.

**Acceptance**: Single YAML options object; generators import and use it.

---

## Implementation Order

Recommended sequence (dependencies first):

1. **Type consolidation** — Enables cleaner imports in subsequent refactors.
2. **Shared string utilities** — Quick win; unblocks Unit Tests spec Phase 4.
3. **Extract `resolveConfigPath`** — Isolates path logic before build refactor.
4. **Extract build plugin helper** — Largest impact; simplifies ipc.ts significantly.
5. **Replace `any`** — Improves type safety; do alongside handler split.
6. **Split ipc.ts** — After build helper extraction, handlers are smaller.
7. **Shared region stats** — Consolidates remaining duplication.
8. **Plugin type constants** — Low risk, can be done anytime.
9. **YAML options** — Cosmetic; lowest priority.

---

## Implementation Checklist

### Phase 1: Types & Utilities
- [ ] Create `electron/types.ts` re-exporting from `src/types`
- [ ] Update all electron modules to import `RegionRecord` from shared types
- [ ] Remove `type X = any` from ipc.ts; use proper types
- [ ] Create `electron/utils/stringFormatters.ts` with `snakeToTitleCase`, `formatRegionTitle`, `sanitizeServerName`
- [ ] Create `src/utils/stringFormatters.ts` for renderer (or shared)
- [ ] Replace all duplicated string logic and sanitization calls

### Phase 2: Config & Build
- [ ] Create `electron/utils/configPathResolver.ts` with `resolveConfigPath`
- [ ] Add `PluginType` and `PLUGIN_TYPES` to types
- [ ] Create `electron/build/buildPluginConfig.ts` (or equivalent) with generic build helper
- [ ] Refactor `build-configs` handler to use build helper

### Phase 3: IPC Split
- [ ] Create `electron/ipc/` directory and handler modules
- [ ] Move handlers to respective files
- [ ] Create `electron/ipc/index.ts` to register handlers
- [ ] Update main process to use new ipc index
- [ ] Remove original `ipc.ts`

### Phase 4: Cleanup
- [ ] Create `electron/utils/regionStats.ts`; consolidate region counting
- [ ] Replace `any` with proper types in ipc, storage, diffValidator
- [ ] Create `electron/utils/yamlOptions.ts`; standardize YAML formatting in generators

---

## Success Criteria

- No duplicated string formatting or server name sanitization
- Single `RegionRecord` definition; proper types in ipc handlers
- `build-configs` handler uses abstracted build logic; no 60-line repeated blocks
- `ipc.ts` split into focused handler modules
- `npm run test:run` passes (per Unit Tests spec)
- No new linter errors; existing functionality preserved

---

## Related Specs

- **Unit_Tests_Spec.md**: Run tests after each refactor phase to catch regressions. String formatter tests depend on Phase 1 extraction.
- **Existing specs**: Refactor preserves behavior specified in AA_Custom_Achievements, Bundle_Default_Config_Files, TAB_Plugin_Integration, LevelledMobs_Generator, etc.
