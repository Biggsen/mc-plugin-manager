# Refactor — Code Quality & Maintainability Specification

**Status: Pending**  
*Last reviewed against codebase: 2025-03-07 (line numbers and locations verified).*

## Purpose

Improve code quality, reduce duplication, and increase maintainability through targeted refactoring. This spec addresses findings from a codebase evaluation: duplicated logic, oversized files, inconsistent types, and missing abstractions.

---

## Scope

- **In scope**: Shared utilities, type consolidation, IPC handler modularization, build-configs handler extraction, YAML/region stats standardization.
- **Out of scope**: Feature changes, UI redesign, dependency upgrades beyond what refactor requires.

---

## Refactoring Targets

### 1. Shared String Utilities (High Priority)

**Problem**: `snakeToTitleCase`, `formatRegionTitle`, and `formatRegionLabel` are duplicated across 5+ files. Server name sanitization (same pattern for server IDs / build output) appears in `ipc.ts` in two places.

**Current locations**:
| Function | Files |
|----------|-------|
| `snakeToTitleCase` | `electron/lmGenerator.ts:32`, `electron/aaGenerator.ts:133` |
| `formatRegionTitle` | `electron/loreBooksGenerator.ts:19`, `src/components/LoreBookPreview.tsx:15` |
| `formatRegionLabel` | `src/screens/LoreBooksScreen.tsx:16` |
| Server name sanitization (`*.toLowerCase().replace(/[^a-z0-9]/g, '-')`) | `electron/ipc.ts` (line 155 `create-server` id; line 502 `build-configs` `serverNameSanitized`) |

**Solution**:
- Create `electron/utils/stringFormatters.ts`:
  - `snakeToTitleCase(str: string): string`
  - `formatRegionTitle(id: string): string` — same logic as snakeToTitleCase for region IDs
  - `sanitizeServerName(name: string): string` — `name.toLowerCase().replace(/[^a-z0-9]/g, '-')`
- Create `src/utils/stringFormatters.ts` (or shared package) for renderer:
  - `formatRegionTitle`, `formatRegionLabel` (latter uses `displayNameOverride ?? formatRegionTitle(id)`)
- Replace all usages; remove duplicated implementations.

**Acceptance**: No duplicated string formatting logic; both sanitization sites use `sanitizeServerName`.

---

### 2. Type Consolidation (High Priority)

**Problem**: `RegionRecord` is redefined in 8 places. `ipc.ts` and `storage.ts` use `type X = any` for `ServerProfile`, `BuildResult`, etc., despite proper types already existing in `src/types/index.ts` (e.g. `ServerProfile`, `BuildResult`, `BuildReport`, `ImportResult`, `OnboardingConfig`, `ServerSummary`).

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

**Problem**: `resolveConfigPath` in `ipc.ts` (lines 35–66) is 30+ lines with nested ternaries. Config filename mapping is verbose. (Note: `ipc.ts` already has `PLUGIN_FLAT_FILENAMES` at lines 78–85 for build output; the new module can share or align with that mapping.)

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

**Problem**: The `build-configs` handler in `ipc.ts` (~500+ lines for the handler) repeats the same pattern for each plugin (AA, CE, TAB, LM, MC, CW), plus a BookGUI block: resolve path → generate/copy → validate diff (where applicable) → write output → write build dir → track sources. Each plugin block is ~50–60 lines.

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

**Problem**: `ipc.ts` is ~990 lines. Handlers are grouped by concern but all live in one file.

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

**Problem**: Region counting/filtering logic is duplicated in `ipc.ts` (build handler builds `regionCounts` inline with `profile.regions.filter((r: any) => ...)` at ~511–517), `ServerDetailScreen.tsx` (lines 52–56: overworld/nether region/village/heart counts), and `tabGenerator.ts` (exports `computeRegionCounts`).

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

**Problem**: AA, CE, LM, and MC generators use YAML stringify in different ways: AA/CE/LM use inline `{ indent: 2, lineWidth: 0 }`; MC uses a local `yamlOptions` with `singleQuote: true` as well. No shared options object.

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
- [x] Create `electron/types.ts` re-exporting from `src/types` (via tsconfig.types.json → dist-types)
- [x] Update all electron modules to import `RegionRecord` from shared types
- [x] Remove `type X = any` from ipc.ts; use proper types
- [x] Create `electron/utils/stringFormatters.ts` with `snakeToTitleCase`, `formatRegionTitle`, `sanitizeServerName`
- [x] Create `src/utils/stringFormatters.ts` for renderer (or shared)
- [x] Replace all duplicated string logic and sanitization calls

### Phase 2: Config & Build
- [x] Create `electron/utils/configPathResolver.ts` with `resolveConfigPath`
- [x] Add `PluginType` and `PLUGIN_TYPES` to types
- [x] Create `electron/build/buildPluginConfig.ts` (or equivalent) with generic build helper
- [x] Refactor `build-configs` handler to use build helper

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

- **tasks/completed/Unit_Tests_Spec.md**: Run tests after each refactor phase to catch regressions. String formatter tests depend on Phase 1 extraction.
- **Existing specs**: Refactor preserves behavior specified in AA_Custom_Achievements, Bundle_Default_Config_Files, TAB_Plugin_Integration, LevelledMobs_Generator, etc.
