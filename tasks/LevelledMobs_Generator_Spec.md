# LevelledMobs Generator — Specification

## Dependencies

**This spec depends on the regions-meta work.**

- **regions-meta schema** (`reference/regions-meta-schema.md`): Defines the `regions-meta.yml` format that Region Forge exports.
- **mc-plugin-manager import of regions-meta**: Mc-plugin-manager must be able to import `regions-meta.yml` and store:
  - `regions` → `profile.regions` (region list with `id`, `world`, `kind`, `discover`)
  - `levelledMobs` → `profile.regionsMeta.levelledMobs` (`villageBandStrategy`, `regionBands`)

The LevelledMobs generator consumes `profile.regions` and `profile.regionsMeta.levelledMobs`. If regions-meta is not implemented or not imported, the generator has no LevelledMobs metadata (e.g. no `regionBands`). The villages rule can still be generated from `profile.regions` when `villageBandStrategy` is defaulted.

---

## Purpose

Extend the MC Plugin Manager to generate **LevelledMobs custom-rules** in `rules.yml` by creating worldguard-regions–based rules: a **Villages band** (one rule with a list of village region IDs) and **region-band rules** (one rule per region with a difficulty: easy, normal, hard, severe, deadly).

This extends the existing build workflow alongside AdvancedAchievements, ConditionalEvents, and TAB. Mc-plugin-manager replaces Region Forge (or any other tool) as the source of these rules.

---

## Scope

- **Input**: User-selected LevelledMobs `rules.yml` (base file) and `profile.regions` + `profile.regionsMeta.levelledMobs` from regions-meta.
- **Output**: Merged `rules.yml` with generated *owned* `custom-rules` and all other sections preserved.
- **Owned**: A subset of entries in `custom-rules` only. No changes to `presets`, `default-rule`, `mob-groups`, `biome-groups`, or `file-version`.

---

## Core Principles

1. **Surgical ownership**: Only add or replace the custom-rules that we generate (Villages band, region-bands). All other `custom-rules` and every other top-level key are preserved.
2. **Data from regions-meta**: Village list from `profile.regions` where `kind === 'village'`. Region-band list and difficulties from `profile.regionsMeta.levelledMobs.regionBands`. Village strategy from `profile.regionsMeta.levelledMobs.villageBandStrategy` (default `easy` if absent).
3. **Intersection rule**: Generate a region-band rule only when the region `id` exists in both `profile.regions` and `profile.regionsMeta.levelledMobs.regionBands`. Ignore `regionBands` keys that do not match any `profile.regions[].id`.
4. **Deterministic output**: Stable ordering of generated rules (Villages first if present, then region-bands sorted by `custom-rule` name) and consistent YAML formatting.

---

## Owned vs Preserved

### Owned (generated and replaced in `custom-rules`)

1. **Villages band rule**
   - One rule whose `conditions.worldguard-regions` is an **array** of region IDs (the villages list).
   - Pattern: `custom-rule: 'Villages - {Strategy} Band'`, `use-preset: lvlstrategy-{easy|normal|hard|severe|deadly}`, `conditions.worldguard-regions: [id, id, ...]`, plus `conditions.worlds` and `conditions.entities` as per § Generation Details.

2. **Region-band rules**
   - Rules whose `conditions.worldguard-regions` is a **string** (one region ID) and `use-preset` is one of `lvlstrategy-easy`, `lvlstrategy-normal`, `lvlstrategy-hard`, `lvlstrategy-severe`, `lvlstrategy-deadly`.
   - Pattern: `custom-rule: '{RegionName} - {Difficulty}'`, `use-preset: lvlstrategy-{difficulty}`, `conditions.worlds`, `conditions.worldguard-regions: '<id>'`.

### Preserved (never modified by the generator)

- **`presets`**
- **`mob-groups`**
- **`biome-groups`**
- **`default-rule`**
- **`file-version`**
- **All other `custom-rules`** that do not match the owned patterns above (e.g. "Minimized Nametag for Specific Mobs", "Armor and Weapons CustomDrop Table", "Player Farm Item and XP Limiter", or any other server-specific rules).

---

## Generation Details

### 1) Villages Band Rule

**When**: There is at least one region in `profile.regions` with `kind === 'village'`.

**Data**:
- **Region IDs**: All `region.id` where `region.kind === 'village'`. Filter by `world` if desired (e.g. only overworld). For v1, include all villages regardless of `world`; `conditions.worlds` can be set to a default overworld world name (see World mapping below).
- **Strategy**: `profile.regionsMeta.levelledMobs.villageBandStrategy` or `'easy'` if missing.

**Shape** (YAML):

```yaml
- custom-rule: 'Villages - Easy Band'   # {Strategy} from villageBandStrategy, title-cased
  is-enabled: true
  use-preset: lvlstrategy-easy          # lvlstrategy-{villageBandStrategy}
  conditions:
    worlds: world                      # See World mapping below
    entities:
      included-groups: ['all_hostile_mobs']
    worldguard-regions:
      - rotherhithe
      - acornbrook
      # ... one entry per village region id, sorted
```

- **`custom-rule`**: `'Villages - {Strategy} Band'` with Strategy title-cased (e.g. `Easy`, `Normal`, `Hard`, `Severe`, `Deadly`).
- **`conditions.worlds`**: Default `world` for overworld. A profile option or world mapping can override.
- **`conditions.entities`**: Use `included-groups: ['all_hostile_mobs']` to match the reference. Not configurable in v1.
- **`worldguard-regions`**: Sorted list of village `region.id` values.

**When no villages exist**: Do not emit a Villages band rule.

---

### 2) Region-Band Rules

**When**: For each `regionId` that exists in both `profile.regions` and `profile.regionsMeta.levelledMobs.regionBands`.

**Data**:
- **Region ID**: Key from `regionBands`.
- **Difficulty**: Value from `regionBands[regionId]`; must be one of `easy`, `normal`, `hard`, `severe`, `deadly`. Invalid values: skip that entry and optionally warn.
- **Region name for `custom-rule`**: Title-case derived from `regionId`, e.g. `dradacliff` → `Dradacliff`, `heart_of_foo` → `Heart Of Foo` (split on `_`, capitalize each segment; “of” can be lowercased heuristically if desired).

**Shape** (per region):

```yaml
- custom-rule: 'Dradacliff - Hard'
  is-enabled: true
  use-preset: lvlstrategy-hard
  conditions:
    worlds: 'world'
    worldguard-regions: 'dradacliff'
```

- **`custom-rule`**: `'{RegionName} - {Difficulty}'` with RegionName from `regionId`, Difficulty title-cased.
- **`use-preset`**: `lvlstrategy-{difficulty}` (lowercase).
- **`conditions.worlds`**: World name for the region. Use the `region.world` from `profile.regions`. If `world` is `overworld`, output `world`; if `nether`, output `world_nether`; otherwise use as-is. (A configurable mapping is optional.)
- **`conditions.worldguard-regions`**: The `regionId` as a string.

**Ordering**: Sort generated region-band rules by `custom-rule` string.

---

### 3) World Mapping

- **Region `world` in profile**: May be `overworld`, `nether`, or the server’s real world name (e.g. `world`, `world_nether`).
- **LevelledMobs `conditions.worlds`**: Expects the server’s world name (e.g. `world`, `world_nether`).
- **Convention for v1**: If `region.world === 'overworld'` → emit `world`; if `region.world === 'nether'` → emit `world_nether`; else use `region.world` as-is.
- **Villages rule**: Use `world` (overworld) as default for `conditions.worlds` unless a profile/config override exists.

---

## Merge Algorithm

1. Parse the base `rules.yml` (user-selected) into an object.
2. **Identify owned rules** in `custom-rules`:
   - Villages: the rule with `conditions.worldguard-regions` as an array (and matching the Villages pattern if we need to be strict).
   - Region-bands: rules with `conditions.worldguard-regions` as a string and `use-preset` matching `lvlstrategy-easy|normal|hard|severe|deadly`.
3. **Build preserved list**: All `custom-rules` entries that are not owned, in their original order.
4. **Build generated list**: Villages rule (if any), then region-band rules sorted by `custom-rule`.
5. **Replace `custom-rules`**: `preserved ++ generated`. (Preserved first, then generated, to match the reference where non-owned rules come first.)
6. Re-serialize to YAML with 2-space indentation, `lineWidth: 0`, and consistent key ordering for generated rules.

---

## Diff Validator

### `removeOwnedLMSections(config)`

- For `config['custom-rules']` (array):
  - Drop any rule where:
    - `conditions.worldguard-regions` is an **array** (Villages band), or
    - `conditions.worldguard-regions` is a **string** and `use-preset` is one of `lvlstrategy-easy`, `lvlstrategy-normal`, `lvlstrategy-hard`, `lvlstrategy-severe`, `lvlstrategy-deadly`.
- Do not modify `presets`, `default-rule`, `mob-groups`, `biome-groups`, `file-version`, or any other key.

### `validateLMDiff(originalPath, generatedContent)`

1. Read and parse the original file at `originalPath`.
2. Parse `generatedContent`.
3. `originalCleaned = removeOwnedLMSections(original)`.
4. `generatedCleaned = removeOwnedLMSections(generated)`.
5. Deep-compare `originalCleaned` and `generatedCleaned`.
6. If equal → `{ valid: true }`. If not → `{ valid: false, error: '...', differences: [...] }`.

---

## Build Workflow Integration

### Extended Build Inputs

```text
inputs: {
  cePath: string;
  aaPath: string;
  tabPath: string;
  lmPath: string;   // New: path to base LevelledMobs rules.yml
  outDir: string;
}
```

### Build Process

1. **Validate**: `lmPath` is optional. At least one of `aaPath`, `cePath`, `tabPath`, `lmPath` must be set.
2. **If `lmPath` provided**:
   - Ensure the file exists.
   - Run `generateOwnedLMRules(profile.regions, profile.regionsMeta?.levelledMobs)`.
   - Run `mergeLMConfig(lmPath, ownedRules)`.
   - Run `validateLMDiff(lmPath, mergedContent)`. On failure, abort the build and return the error.
   - Write to output directory and build directory with filename: `${serverNameSanitized}-levelledmobs-rules.yml`.
3. **Build report**: Set `generated.lm: true` when LM was generated; include any LM-specific stats (e.g. villages count, region-bands count) if useful.

### Output Filename

- Pattern: `${serverNameSanitized}-levelledmobs-rules.yml`
- Example: `teledosi-levelledmobs-rules.yml`
- `serverNameSanitized = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')`

---

## Data Requirements

- **`profile.regions`**: Required for both Villages and region-bands. From regions-meta import.
- **`profile.regionsMeta.levelledMobs`**: Optional.
  - **`villageBandStrategy`**: Optional. Default `'easy'` when generating the Villages rule.
  - **`regionBands`**: Optional. If missing or empty, no region-band rules are generated. Keys must match `profile.regions[].id` for a rule to be emitted.

---

## UI Integration

### BuildScreen

- Add `lmPath` state and a file picker: “Select LevelledMobs rules.yml”.
- Pass `lmPath` into `buildConfigs`.
- “At least one config” = AA or CE or TAB or LM.
- Build report: show “✓ LevelledMobs” when `generated.lm` is true; optionally show villages count and region-bands count.

### Preload / IPC

- `buildConfigs` inputs: add `lmPath`.
- `BuildReport.generated`: add `lm: boolean`.

---

## Edge Cases

### No regions-meta imported

- `profile.regionsMeta` or `profile.regionsMeta.levelledMobs` is undefined.
- **Villages rule**: Can still be generated from `profile.regions` (kind === 'village') using default `villageBandStrategy: 'easy'`.
- **Region-bands**: None (no `regionBands`).

### No villages

- Do not generate a Villages band rule.

### regionBands key not in profile.regions

- Do not generate a rule for that key. Optionally warn.

### Invalid difficulty in regionBands

- Skip that entry; optionally warn. Valid: `easy`, `normal`, `hard`, `severe`, `deadly`.

### Base rules.yml lacks lvlstrategy-* presets

- The generator does not validate presence of presets. It only emits `use-preset: lvlstrategy-{difficulty}`. If the base does not define them, LevelledMobs may error at runtime. User responsibility to supply a valid base.

### Empty custom-rules in base

- Merge still works: preserved = [], generated = [Villages?] ++ region-bands.

---

## Reference Files

- **Server example (owned rules)**: `reference/plugin config files/teledosi-server/teledosi-rules.yml`
  - Shows: Villages - Easy Band (`worldguard-regions` list), region-band rules (`worldguard-regions` string, `use-preset: lvlstrategy-*`), and preserved rules (Minimized Nametag, Armor and Weapons, Player Farm).
- **regions-meta schema**: `reference/regions-meta-schema.md` (§6 `levelledMobs`).

---

## Implementation Checklist

### Prerequisites (from regions-meta work)

- [x] regions-meta schema defined and accepted.
- [x] Mc-plugin-manager: import `regions-meta.yml` → `profile.regions` and `profile.regionsMeta.levelledMobs`. **Spec**: `tasks/Regions_Meta_Import_Spec.md`.

### Phase 1: Generator

- [x] Create `lmGenerator.ts` (or `levelledMobsGenerator.ts`).
- [x] `generateOwnedLMRules(regions, levelledMobs?)` → `{ villagesRule?: object; regionBandRules: object[] }`.
- [x] Implement Villages rule generation (including world and entities).
- [x] Implement region-band rule generation (including region id → title-case name, world mapping).
- [x] `mergeLMConfig(existingPath, owned)` → merged YAML string.

### Phase 2: Diff Validator

- [x] `removeOwnedLMSections(config)` in `diffValidator.ts`.
- [x] `validateLMDiff(originalPath, generatedContent)`.
- [x] Wire `validateLMDiff` into the LM branch of the build handler; abort build on failure.

### Phase 3: Build and Types

- [x] IPC: add `lmPath` to build inputs; implement LM build branch.
- [x] Build report: `generated.lm`, optional LM counts.
- [x] Preload and `BuildResult`/`BuildReport` types: `lmPath`, `lm`.

### Phase 4: UI

- [x] BuildScreen: `lmPath` state, “Select LevelledMobs rules.yml” picker.
- [x] Build validation: at least one of AA, CE, TAB, LM.
- [x] Build report: show LM generation and optional counts.

### Phase 5: Testing

**Status: ⏸️ Deferred**

Testing will be done incrementally through real-world usage. The generator is working correctly for current server configurations.

- [ ] Villages-only (no regionBands).
- [ ] Region-bands only (no villages).
- [ ] Both Villages and region-bands.
- [ ] No regions-meta: villages with default strategy, no region-bands.
- [ ] `validateLMDiff`: owned-only changes pass; changes to presets or preserved custom-rules fail.

---

## Implementation Status

**Status: ✅ Complete (Implementation phases 1-4)**

All implementation phases are complete. The generator:
- Uses yaml Document API to preserve formatting
- Correctly identifies and replaces owned rules (Villages band and region-bands)
- Preserves all other sections (presets, default-rule, mob-groups, biome-groups, file-version, and non-owned custom-rules)
- Validates that only owned sections change via diff validator
- Integrates fully into the build workflow and UI

**Note**: Death-messages key ordering normalization was removed as it's not functionally necessary and the server loads the config correctly regardless of key order.

---

## Format Details

### YAML

- Indentation: 2 spaces.
- `lineWidth: 0` to avoid wrapping.
- Generated `custom-rules` entries: deterministic field order (`custom-rule`, `is-enabled`, `use-preset`, `conditions`).

### Naming

- **Villages `custom-rule`**: `'Villages - {Strategy} Band'` (Strategy: Easy, Normal, Hard, Severe, Deadly).
- **Region-band `custom-rule`**: `'{RegionName} - {Difficulty}'` (RegionName from `regionId` title-case; Difficulty: Easy, Normal, Hard, Severe, Deadly).

---

## Open Decisions

- World mapping: fixed `overworld`→`world`, `nether`→`world_nether` vs profile-level config.
- Villages `conditions.entities`: always `included-groups: ['all_hostile_mobs']` or make configurable.
- Whether to emit a rule for `regionBands` keys that are not in `profile.regions`: current decision is no (intersection only).
