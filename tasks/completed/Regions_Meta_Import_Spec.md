# regions-meta Import — Specification

**Status: ✅ COMPLETED** (2026-01-26)

Implementation complete. All phases finished and tested. Note: `nether_village` was removed from `RewardRecipeId` as villages are overworld-only.

## Purpose

Replace the existing **Region Forge `regions.yml`** import with an import of **`regions-meta.yml`**, the format that Region Forge exports as the single source of region data, onboarding, spawn center, and LevelledMobs metadata. Mc-plugin-manager becomes the consumer of this format and the single source of truth for downstream generators (AA, CE, TAB, LevelledMobs).

---

## Dependencies

- **regions-meta schema** (`reference/regions-meta-schema.md`): Defines the `regions-meta.yml` format. All import behaviour must conform to this schema.
- **Reference export** (`reference/regions-meta.yml`): Example of a valid regions-meta export for validation and tests.

---

## Scope

### In Scope

- **Parser**: New `importRegionsMeta(filePath)` in `regionParser.ts` that parses `regions-meta.yml`, validates `format`, and maps into profile shape.
- **Profile model**: Add `regionsMeta`, `spawnCenter`; extend `sources` with `regionsMeta`; make `onboarding.teleport.y` optional.
- **IPC**: New `import-regions-meta` handler; deprecate or remove `import-regions` (regions.yml).
- **ImportScreen**: Replace Overworld/Nether dual import with a single “Import regions-meta” flow.
- **OnboardingScreen**: Prefill from `spawnCenter` (regions-meta or legacy); handle optional `teleport.y`.
- **Generators**: `ceGenerator` must use `teleport.y ?? <default>` when building `tp` command; `recipeId` and `RegionRecord` types extended for `village` (villages are overworld-only, no `nether_village`).
- **Types**: `src/types`, `preload`, and local interfaces in aa/ce/tab generators.

### Out of Scope

- **LevelledMobs generator**: Consumes `profile.regionsMeta.levelledMobs`; implementation is covered by `LevelledMobs_Generator_Spec.md`. This spec only ensures the data is stored.
- **Support for both regions.yml and regions-meta**: The refactor replaces the regions.yml import path. Optional backward compatibility (keeping both) is an open decision.

---

## Current vs New Behaviour

### Current (regions.yml)

| Aspect | Behaviour |
|--------|------------|
| **Source** | Region Forge `regions.yml` (cuboid/poly2d, `flags.greeting`, etc.) |
| **Import flow** | User picks file **per world** (Overworld, Nether). Two separate imports. |
| **Classification** | Heuristics: `spawn` → system; `heart_of_*` → heart; `onboarding.startRegionId` → first_join; `greeting` contains "village" → village; else region. |
| **spawnCenter** | Computed from spawn region’s cuboid `min`/`max` and file path `.../worlds/{worldName}/regions.yml`. |
| **onboarding** | Not in file; user configures fully in OnboardingScreen. |
| **levelledMobs** | Not in file; not stored. |
| **API** | `importRegions(filePath, world, existingRegions, onboarding)`; IPC `import-regions(serverId, world, filePath)`. |

### New (regions-meta.yml)

| Aspect | Behaviour |
|--------|------------|
| **Source** | Region Forge `regions-meta.yml` (format 1, `regions[]`, optional `onboarding`, `spawnCenter`, `levelledMobs`). |
| **Import flow** | User picks **one file**. Single import replaces all region data and merges onboarding / spawnCenter / levelledMobs when present. |
| **Classification** | None. `id`, `world`, `kind`, `discover` (including `recipeId`) come from the file. |
| **spawnCenter** | From file `spawnCenter`; stored in `profile.spawnCenter` and/or `sources.regionsMeta.spawnCenter`. |
| **onboarding** | From file when present. `teleport.y` is optional (Region Forge does not export it); user sets Y manually in OnboardingScreen. |
| **levelledMobs** | From file when present; stored in `profile.regionsMeta.levelledMobs`. |
| **API** | `importRegionsMeta(filePath)`; IPC `import-regions-meta(serverId, filePath)`. |

---

## Schema Reference (Summary)

See `reference/regions-meta-schema.md` for the full definition. Relevant points:

- **Root**: `format` (required, must be `1`), **`world`** (required, indicates which world this export represents: `overworld`, `nether`, or `end`), `regions` (required), `onboarding`, `spawnCenter`, `levelledMobs` (optional).
- **regions[]**: `id`, `world`, `kind`, `discover{ method, recipeId, commandIdOverride?, displayNameOverride? }`. `regions[].world` should match the root-level `world` field. `kind` ∈ `system`|`region`|`village`|`heart`; `recipeId` ∈ `none`|`region`|`nether_region`|`heart`|`nether_heart`|`village` (villages are overworld-only).
- **onboarding**: `startRegionId`, `teleport{ world, x, z, y?, yaw?, pitch? }`. `teleport.y` is **optional** (Region Forge does not export it).
- **spawnCenter**: `world`, `x`, `z` (no `y`).
- **levelledMobs**: `villageBandStrategy?`, `regionBands?` (map of region `id` → difficulty).

**Note**: Region Forge exports **one file per world**. Each file has a root-level `world` field indicating which world it represents. All `regions[]` in that file should have `world` matching the root `world`.

---

## Profile / Data Model Changes

### ServerProfile (and `create-server` defaults)

| Field | Change |
|-------|--------|
| `sources.overworld?` | **Replaced by regions-meta imports.** Kept for backward compat when reading; new imports set `sources.world`, `sources.nether`, `sources.end` instead. |
| `sources.nether?` | Same as overworld. |
| `sources.world?` | **New.** `ImportedSource` with `label: 'world'` (or `'overworld'`), `originalFilename`, `importedAtIso`, `fileHash`, `spawnCenter?`. Set when importing overworld regions-meta. |
| `sources.nether?` | **Updated.** `ImportedSource` with `label: 'nether'`, set when importing nether regions-meta. |
| `sources.end?` | **New.** `ImportedSource` with `label: 'end'`, set when importing end regions-meta. |
| `spawnCenter?` | **New (optional).** `{ world: string; x: number; z: number }` at profile root. Merged from any regions-meta file that includes it (last import wins). |
| `regionsMeta?` | **New (optional).** `{ levelledMobs?: { villageBandStrategy?: string; regionBands?: Record<string, string> } }`. Merged from any regions-meta file that includes it (`regionBands` combined, `villageBandStrategy` last import wins). |
| `onboarding.teleport.y` | Becomes **optional** (`y?: number`). Region Forge does not export it; user sets in OnboardingScreen. |

### ImportedSource

- Already has optional `spawnCenter`. When `sources.regionsMeta` is set, `spawnCenter` can be on the source and/or mirrored to `profile.spawnCenter` (see § Import algorithm).

### RegionRecord

- `world`: remains `'overworld' | 'nether' | 'end'` for compatibility with AA/CE/TAB. **World mapping** (see § World Mapping) happens in `importRegionsMeta`. The root-level `world` field in the file is used to determine which world slot to import into.
- `discover.recipeId`: extend type to include `'village'` so schema-conformant files are accepted. Generators use `kind` and `world`; no logic change for `recipeId` required. (Note: `nether_village` does not exist; villages are overworld-only.)

### OnboardingConfig.teleport

- `y?: number` (optional). CE’s `tpCommand` must use `y ?? 64` (or agreed default) when generating the `tp` command.

---

## regionParser: importRegionsMeta

### Signature

```ts
function importRegionsMeta(
  filePath: string,
  world?: 'overworld' | 'nether' | 'end'
): {
  regions: RegionRecord[];
  world: 'overworld' | 'nether' | 'end';  // The world this import represents
  source: ImportedSource;
  onboarding?: OnboardingConfig;
  spawnCenter?: { world: string; x: number; z: number };
  levelledMobs?: { villageBandStrategy?: string; regionBands?: Record<string, string> };
}
```

**Note**: `world` parameter is optional. If not provided, it is inferred from the file's root-level `world` field. If provided, it must match the file's root `world` field (or a warning is issued).

### Algorithm

1. **Read and parse YAML** at `filePath`. On parse error, throw with a clear message.
2. **Validate `format`**: If missing or not `1`, throw `"Unsupported regions-meta format: expected 1"`.
3. **Validate root `world`**: If missing, throw `"Missing required field: world"`. Map the root `world` to `'overworld' | 'nether' | 'end'` using world mapping (see § World Mapping). If `world` parameter was provided, validate it matches the mapped root `world`; if not, warn but proceed with the file's `world`.
4. **Validate `regions`**: If missing or not an array, throw. For each element, require `id`, `world`, `kind`, `discover` with `method` and `recipeId`. Invalid or missing required fields: **warn and skip that region** (or reject entire file; implementation choice). Unknown keys on a region are ignored.
5. **Validate `regions[].world` matches root `world`**: For each region, if `region.world` (after world mapping) does not match the root `world` (after mapping), warn but include the region. This allows flexibility while encouraging consistency.
6. **Map each region to RegionRecord**:
   - `id`: use `canonicalizeId(region.id)` (lowercase, preserve snake_case).
   - `world`: use the mapped root `world` (all regions in the file share the same world).
   - `kind`, `discover.method`, `discover.recipeId`: pass through. Ensure `recipeId` is one of the allowed values; if unknown, default to `'region'` or `'nether_region'` or `'end_region'` based on mapped world, or skip/warn.
   - `discover.commandIdOverride`, `discover.displayNameOverride`: pass through if present.
7. **Build `source`**:
   - `label`: use the mapped root `world` (e.g. `'overworld'`, `'nether'`, `'end'`)
   - `originalFilename`: `path.basename(filePath)`
   - `importedAtIso`: `new Date().toISOString()`
   - `fileHash`: existing `calculateFileHash(filePath)` (or equivalent)
   - `spawnCenter`: from file’s `spawnCenter` if present.
8. **Extract optional sections**: `onboarding`, `spawnCenter`, `levelledMobs` from file root when present.
9. **Return** `{ regions, world: <mapped root world>, source, onboarding?, spawnCenter?, levelledMobs? }`.

### recipeId Validation

- Allowed: `none`, `region`, `nether_region`, `heart`, `nether_heart`, `village`. If the file has any other value, warn and map to a safe default (e.g. `region` or `nether_region` by world) or skip that region. Mc-plugin-manager does not need to enforce `method`/`recipeId` consistency (e.g. `disabled` + `none`) in the parser; it may warn. (Note: `nether_village` does not exist; villages are overworld-only.)

---

## World Mapping

`regions-meta` allows any `world` string (e.g. `overworld`, `nether`, `world`, `world_nether`, `Teledosi`). `RegionRecord.world` and generators expect `'overworld' | 'nether'`.

**Mapping rule** (in `importRegionsMeta`):

- If `region.world` (lowercased) is in `['nether','world_nether']` → `'nether'`.
- Otherwise → `'overworld'`.

**Note**: `onboarding.teleport.world` and `spawnCenter.world` are **not** mapped; they remain the server’s real world name (e.g. `Teledosi`). Only `regions[].world` is mapped for `RegionRecord`.

---

## IPC: import-regions-meta

### Handler

- **Channel**: `import-regions-meta`
- **Args**: `(serverId: string, world: 'overworld' | 'nether' | 'end', filePath: string)`
- **Returns**: `Promise<ImportResult>` with `{ success, regionCount?, error? }` (and optional extras like `onboardingMerged` if useful).

**Note**: `world` parameter can be inferred from the file's root `world` field, but passing it explicitly allows the UI to route to the correct world slot and validate consistency.

### Algorithm

1. Load `profile = loadServerProfile(serverId)`. If not found, return `{ success: false, error: 'Server profile not found: …' }`.
2. If `!existsSync(filePath)`, return `{ success: false, error: 'File not found: …' }`.
3. Call `importRegionsMeta(filePath, world)`. On throw, return `{ success: false, error: error.message }`.
4. **Update profile**:
   - **Regions**: Remove existing regions for `result.world`, then add `result.regions` (replace regions for that world only).
   - **Sources**: `profile.sources[result.world] = result.source` (e.g. `sources.overworld`, `sources.nether`, `sources.end`). Optionally clear old `sources.overworld`/`sources.nether` if they were from regions.yml; for backward compat, they can remain if not overwritten.
   - **spawnCenter**: If `result.spawnCenter` present: `profile.spawnCenter = result.spawnCenter` (last import wins). Also set `result.source.spawnCenter = result.spawnCenter` so `ImportedSource` carries it (OnboardingScreen can use either).
   - **onboarding**: If `result.onboarding` present: merge into `profile.onboarding`:
     - `profile.onboarding = { ...profile.onboarding, ...result.onboarding, teleport: { ...profile.onboarding.teleport, ...result.onboarding.teleport } }`.
     - Effect: `startRegionId` and `teleport` (world, x, z, yaw, pitch) are overwritten by the file. **`teleport.y`**: if the file omits it, `result.onboarding.teleport.y` is undefined and the spread keeps `profile.onboarding.teleport.y` unchanged. If the file includes `y`, it overwrites. Last import wins.
   - **levelledMobs**: If `result.levelledMobs` present: merge into `profile.regionsMeta.levelledMobs`:
     - `villageBandStrategy`: last import wins (overwrite).
     - `regionBands`: merge objects (`{ ...profile.regionsMeta?.levelledMobs?.regionBands, ...result.levelledMobs.regionBands }`). Keys from later imports overwrite earlier ones.
     - If `profile.regionsMeta` is undefined, initialize it: `profile.regionsMeta = { levelledMobs: result.levelledMobs }`.
5. `saveServerProfile(profile)`.
6. Return `{ success: true, regionCount: result.regions.length }`.

### Deprecation / Removal of import-regions

- **Recommendation**: Remove the `import-regions` handler and the old `importRegions(filePath, world, existingRegions, onboarding)` path. The ImportScreen no longer offers Overworld/Nether; it only offers “Import regions-meta”.
- **Alternative**: Keep both during a transition; UI would need two flows (e.g. “Import regions-meta” vs “Import Region Forge regions (legacy)”). This spec assumes replacement.

---

## ImportScreen

### UI Changes

- **Remove**: Two blocks “Import Overworld” and “Import Nether” with separate file pickers and `importRegions(serverId, world, filePath)`.
- **Add**: Single block “Import regions-meta”:
  - Button: “Import regions-meta” or “Select regions-meta file”.
  - On click: `showImportDialog()` (or a dialog titled “Select regions-meta file”), then `importRegionsMeta(serverId, filePath)` (via IPC `import-regions-meta`).
  - When `sources.regionsMeta` exists: show “Imported: `sources.regionsMeta.originalFilename`” and `importedAtIso` (formatted). Re-import replaces all region data and merges onboarding/spawnCenter/levelledMobs as above.
- **Copy**: Can stay generic (“Import Region Forge export” / “regions-meta”) or be updated to “Import regions-meta from Region Forge”.

### showImportDialog

- Reuse `show-import-dialog`. Optionally change dialog title to “Select regions-meta file”. Filters remain YAML.

---

## OnboardingScreen

### spawnCenter Prefill

- **Current**: `server.sources.overworld?.spawnCenter` to prefill `teleport { world, x, z }` and `y: server.onboarding.teleport.y || 64`.
- **New precedence** (first defined wins):
  1. `server.spawnCenter` (from any regions-meta import)
  2. `server.sources.overworld?.spawnCenter` (from overworld regions-meta)
  3. `server.sources.nether?.spawnCenter` (from nether regions-meta)
  4. `server.sources.end?.spawnCenter` (from end regions-meta)
  5. `server.sources.overworld?.spawnCenter` (legacy from regions.yml)
- Prefill only `world`, `x`, `z` from spawnCenter. For `y`: use `server.onboarding.teleport.y ?? 64` (or leave empty; see below).

### teleport.y Optional

- **State**: `teleport.y` may be `undefined`. Use `value={teleport.y ?? ''}` for the Y input so the field can be empty when not set.
- **Save**: When user leaves Y empty, persist `y` as `undefined` or omit. `updateOnboarding` and `OnboardingConfig` support `y?: number`. CE’s `tpCommand` uses `tp.y ?? 64` when generating the command.
- **Paste / default**: On prefill from spawnCenter, do **not** set `y` from spawnCenter (it has no `y`). Use `y: server.onboarding.teleport.y ?? 64` only as default for the prefill object when we need a number (e.g. for paste or for CE). In the UI, empty Y is allowed.

---

## ceGenerator: tpCommand and teleport.y

### tpCommand

- **Current**: `tp %player% ${tp.x} ${tp.y} ${tp.z}` (and optional yaw/pitch). Assumes `tp.y` is a number.
- **Change**: Use `const y = tp.y ?? 64` (or an agreed default) before building the string, so `tp %player% ${tp.x} ${y} ${tp.z}`. Prevents `undefined` in the generated command.

### OnboardingConfig in ceGenerator

- Local `OnboardingConfig` (or shared type): `teleport.y` optional. No other logic changes.

---

## Types: recipeId and RegionRecord

### Files to Update

- `src/types/index.ts`: `RewardRecipeId` add `'village'`; `OnboardingConfig.teleport.y` → `y?: number`; `ServerProfile` add `spawnCenter?`, `regionsMeta?`, `sources.world?`, `sources.end?` (and update `sources.nether?` to be from regions-meta).
- `electron/preload.ts`: Mirror `ServerProfile`, `ImportedSource`, `RegionRecord`, `OnboardingConfig`; add `importRegionsMeta(serverId, world, filePath)` to `ElectronAPI`.
- `src/vite-env.d.ts`: `ElectronAPI` add `importRegionsMeta(serverId, world, filePath)`.
- `electron/regionParser.ts`: `RegionRecord` and any local types; `recipeId` includes `village`.
- `electron/aaGenerator.ts`, `electron/ceGenerator.ts`, `electron/tabGenerator.ts`: Local `RegionRecord.recipeId` (and `OnboardingConfig` in CE) extended for `village` and `y?`.

### RewardRecipeId (full)

```ts
| 'region' | 'heart' | 'nether_region' | 'nether_heart' | 'none' | 'village'
```

**Note**: `nether_village` does not exist; villages are overworld-only.

---

## Backward Compatibility

### Existing Profiles

- **sources.overworld / sources.nether**: Remain in stored JSON. OnboardingScreen prefill still checks `sources.overworld?.spawnCenter` as fallback. No migration to delete them.
- **profile.spawnCenter, profile.regionsMeta**: Absent until first regions-meta import. `create-server` does not need to set them.

### create-server

- `onboarding.teleport`: Can omit `y` or set `y: 0` as “unset” sentinel. Prefer `y?: number` and omit when undefined. If existing code expects a number, `0` is acceptable for “not yet set” as long as CE uses `?? 64` when generating.

---

## Edge Cases

### format !== 1

- Reject with: `"Unsupported regions-meta format: expected 1"`.

### Root world field missing

- Reject with: `"Missing required field: world"`.

### regions missing or not array

- Reject with a clear error.

### Region missing id, world, kind, or discover

- **Option A**: Warn and skip that region. **Option B**: Reject the file. Spec recommends **warn and skip** for robustness.

### discover.recipeId unknown

- Warn and map to `region` or `nether_region` by mapped world, or skip. Do not crash.

### onboarding in file, teleport.y absent

- Merge as in § IPC. `profile.onboarding.teleport.y` is preserved. OnboardingScreen and CE handle `y` optional.

### levelledMobs absent in file

- Do not clear `profile.regionsMeta.levelledMobs`. Leave existing value.

### spawnCenter in file

- Set `profile.spawnCenter` and `source.spawnCenter`. OnboardingScreen prefill will use it.

### Empty regions array

- Allowed. `profile.regions = []`. Generators will produce empty or minimal output.

### Root world field in file is custom (e.g. Teledosi)

- For root `world` field: apply world mapping; `Teledosi` → `'overworld'`. For `onboarding.teleport.world` and `spawnCenter.world`: keep `Teledosi` as-is (not mapped).

### Duplicate region id within same world

- Schema says unique per world. Parser may keep last or first; recommend **last wins** when de-duplicating by `world:id`. For a single regions-meta file, the file should not have duplicates; if it does, last in array wins.

### regions[].world does not match root world

- Warn but include the region. The root `world` determines which world slot to import into; individual region `world` mismatches are warnings, not errors.

---

## Implementation Checklist

### Phase 1: Types and Profile Model

- [x] `src/types/index.ts`: `OnboardingConfig.teleport.y` → optional; `RewardRecipeId` add `village`; `ServerProfile` add `spawnCenter?`, `regionsMeta?`, `sources.world?`, `sources.end?`; `RegionRecord.world` add `'end'`.
- [x] `electron/preload.ts`: Update `ServerProfile`, `RegionRecord`, `OnboardingConfig`; add `importRegionsMeta(serverId, world, filePath)` to API.
- [x] `src/vite-env.d.ts`: `ElectronAPI.importRegionsMeta(serverId, world, filePath)`.

### Phase 2: regionParser

- [x] Add `importRegionsMeta(filePath, world?)`.
- [x] Parse YAML; validate `format === 1`; validate root `world` field; validate `regions` array.
- [x] Map root `world` to `'overworld' | 'nether' | 'end'`; validate `regions[].world` matches (warn if not).
- [x] Map each region: `canonicalizeId`, use mapped root `world` for all regions, pass through `kind`, `discover` (including `recipeId`); handle invalid `recipeId` (warn + default or skip).
- [x] Build `source` with `label` = mapped root `world` and `spawnCenter` when present.
- [x] Return `{ regions, world, source, onboarding?, spawnCenter?, levelledMobs? }`.
- [x] (Optional) Deprecate or remove `importRegions` and Region Forge–specific parsing.

### Phase 3: IPC and Preload

- [x] Add `import-regions-meta(serverId, world, filePath)` handler in `ipc.ts`.
- [x] Implement per-world region replacement (remove existing regions for that world, add new ones).
- [x] Implement merge of `onboarding` (preserve `teleport.y` when file omits it), `spawnCenter` (last wins), `regionsMeta.levelledMobs` (`regionBands` merged, `villageBandStrategy` last wins).
- [x] Set `sources.{world}` based on `result.world`.
- [x] Remove or disable `import-regions` handler.
- [x] preload: wire `importRegionsMeta(serverId, world, filePath)` to `import-regions-meta`.

### Phase 4: ImportScreen

- [x] Replace Overworld/Nether blocks with single “Import regions-meta” flow.
- [x] Call `importRegionsMeta` via IPC; display `sources.regionsMeta?.originalFilename` and `importedAtIso` when set.
- [x] (Optional) Update `show-import-dialog` title to “Select regions-meta file”.

### Phase 5: OnboardingScreen

- [x] Prefill: use `profile.spawnCenter` → `sources.overworld?.spawnCenter` → `sources.nether?.spawnCenter` → `sources.end?.spawnCenter` → legacy `sources.overworld?.spawnCenter`.
- [x] Y input: `value={teleport.y ?? ''}`; on save, allow `y` to be undefined/omitted.
- [x] Prefill logic: `y: server.onboarding.teleport.y ?? 64` when constructing prefill object for world/x/z; do not overwrite `y` from spawnCenter.

### Phase 6: Generators and create-server

- [x] `ceGenerator`: `tpCommand` use `tp.y ?? 64`; `OnboardingConfig.teleport.y` optional; `recipeId` include `village`.
- [x] `aaGenerator`, `tabGenerator`: `RegionRecord.recipeId` include `village`.
- [x] `create-server` (if needed): `onboarding.teleport` omit `y` or set to `0`; ensure `regionsMeta` and `spawnCenter` are not required on new profiles.

### Phase 7: ServerDetailScreen and Build

- [x] ServerDetailScreen: if it displays “Imported: …”, support `sources.regionsMeta` when `overworld`/`nether` are absent. Counts from `server.regions` unchanged.
- [x] Build: no signature change; `profile.regions` and `profile.regionsMeta` are already consumed by existing (or future LevelledMobs) logic.

### Phase 8: Testing and Docs

- [x] Manual test: import `reference/regions-meta.yml`; verify `regions`, `onboarding`, `spawnCenter`, `levelledMobs` stored; OnboardingScreen prefill and Y optional; CE tp command with `y` default.
- [x] Edge cases: `format` 0/2, missing `regions`, invalid `recipeId`, empty `regions`, no `onboarding`/`spawnCenter`/`levelledMobs`.
- [x] Update README or user-facing docs to describe regions-meta as the import source.

---

## Reference Files

- **Schema**: `reference/regions-meta-schema.md`
- **Sample export**: `reference/regions-meta.yml`
- **LevelledMobs dependency**: `tasks/LevelledMobs_Generator_Spec.md` (consumes `profile.regionsMeta.levelledMobs`).

---

## Open Decisions

1. **Legacy regions.yml**: Support both regions-meta and regions.yml (two UI flows) vs. full replacement. This spec assumes replacement.
2. **Invalid region handling**: Warn-and-skip vs. reject-file for malformed `regions[]` elements. Spec recommends warn-and-skip.
3. **`sources.overworld` / `sources.nether` on regions-meta import**: Clear them to avoid confusion, or leave as-is for backward compat. Spec leaves to implementation; prefer clear when committing to regions-meta-only. New imports set `sources.world`, `sources.nether`, `sources.end`.
4. **Default for `tp.y`**: `64` vs. configurable. Spec uses `64` for v1.
5. **World parameter in IPC**: Require explicit `world` parameter vs. infer from file. Spec recommends explicit for UI routing and validation, but allows inference as fallback.
6. **levelledMobs merging**: How to handle `regionBands` conflicts when same region ID appears in multiple world imports? Spec recommends last import wins (overwrite).
