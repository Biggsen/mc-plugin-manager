# LevelledMobs CustomDrops Drop Tables — Specification

## Purpose

Extend MC Plugin Manager to generate **LevelledMobs `customdrops.yml` drop tables** from category catalog JSON files (for example `ores.json`, `drops.json`, `plants.json`) with user-managed item selection and per-item overrides.

This is a new generator track for LevelledMobs custom drops. Existing `rules.yml` generation remains separate.

---

## Scope

- **Input catalogs**: One JSON file per category (filename stem is canonical table name).
- **Customization UI**: New Drop Tables section where users select/unselect items per category and define per-item overrides.
- **Output**: Generated `customdrops.yml` with owned `drop-table` entries merged into a base file while preserving non-owned content.

---

## Core Principles

1. **Catalogs are sources, not output**: JSON category files provide selectable items only.
2. **Stem-to-table mapping**: `ores.json` maps to drop table `ores` exactly.
3. **Manual curation**: Users explicitly select/unselect table members.
4. **Sparse overrides**: Items inherit defaults and only changed fields are emitted.
5. **Deterministic output**: Stable alphabetical ordering for generated item entries.
6. **Surgical ownership**: Generator owns only the configured drop-table entries and preserves everything else.

---

## Source Data Contract

### Category Catalog Files

- Expected pattern: `<category>.json` where `<category>` becomes table key under `drop-table`.
- Examples:
  - `ores.json` -> `drop-table.ores`
  - `drops.json` -> `drop-table.drops`
  - `plants.json` -> `drop-table.plants`

### Catalog Parsing Rules

1. Parse JSON object entries as item definitions.
2. Ignore metadata keys beginning with `_` (for example `_export_metadata`).
3. Item object fields (such as `name`, `category`, `stack`, `unit_buy`) are catalog metadata for UI/filtering and do not need to be emitted to LM.
4. Item key is treated as the canonical item identifier source.
5. Item IDs are normalized to LM material style in output (`upper snake case`, for example `iron_ingot` -> `IRON_INGOT`).

### Invalid/Missing Catalog Behavior

- If a configured catalog file is missing or invalid at build time:
  - Skip generation for that table.
  - Continue build.
  - Add a warning to build report.

---

## User Decisions (Locked)

- Table membership is manual select/unselect.
- Per-item overrides are supported.
- Base behavior is inherited defaults.
- Default `amount` is `1` unless overridden.
- Items may appear in multiple category tables.
- Table name comes from filename stem exactly.
- Missing/invalid catalog files are skipped with warning.
- Generated item entries are sorted alphabetically.
- Empty selected tables are omitted entirely.

---

## Profile Data Model

Add a profile structure for Drop Tables configuration:

```ts
interface DropTablesConfig {
  catalogs: Record<string, {
    path: string;            // absolute or profile-relative source file path
    enabled: boolean;        // whether this category participates in generation
    lastLoadedAt?: string;   // optional UI metadata
  }>;

  tables: Record<string, {
    // key matches filename stem exactly, e.g. "ores"
    selectedItems: string[]; // canonical catalog keys (before output normalization)
    itemOverrides?: Record<string, {
      chance?: number;
      amount?: number | string; // e.g. 1 or "1-2"
      // extensible for future LM customdrop fields:
      equipped?: number;
      groupid?: string;
      groupLimits?: {
        capPerItem?: number;
        capTotal?: number;
        capEquipped?: number;
      };
    }>;
  }>;
}
```

Notes:
- `selectedItems` is the source of truth for inclusion.
- Overrides are optional and sparse.
- Multiple tables can reference the same item ID.

---

## Drop Tables UI (New Section)

### Section Goals

- Show available category catalogs.
- Load catalog items for each category.
- Allow select/unselect item membership.
- Provide per-item override editing.
- Show effective value (default vs overridden) for key fields like `amount`.

### v1 Behavior

1. User enables a catalog category table.
2. User selects/unselects items for that category.
3. User optionally sets per-item overrides.
4. UI stores sparse overrides only when value differs from inherited default.

### Defaults Presentation

- Display inherited defaults from `customdrops.yml defaults` as read context.
- For v1, treat `amount=1` as baseline if no override is set.

---

## Generation Details

### Owned Output Area

Generator owns configured `drop-table.<category>` entries only.

For each configured category table:
- Gather selected items.
- Normalize IDs (`IRON_INGOT`).
- Sort alphabetically.
- Emit each item with sparse overrides.
- Omit table if selected item list is empty.

### Per-item Emission Rules

For a selected item:
- Emit YAML list entry keyed by normalized item ID.
- Emit only override fields that differ from inherited defaults.
- If no overrides exist, emit an empty mapping for item key or a minimal valid node according to LM parser compatibility.

Example:

```yaml
drop-table:
  ores:
    - IRON_INGOT:
        chance: 0.20
        amount: 1-2
    - GOLD_INGOT: {}
```

If `ores` has no selected items, omit `drop-table.ores` entirely.

### Ordering

- Table keys: stable order (recommended alphabetical by table name).
- Item entries in each table: alphabetical by normalized item ID.
- Override keys: deterministic order (`chance`, `amount`, `equipped`, `groupid`, `group-limits`).

---

## Merge Algorithm (`customdrops.yml`)

1. Parse base `customdrops.yml`.
2. Ensure top-level `drop-table` map exists for merge target.
3. Identify owned table keys from Drop Tables config.
4. For each owned key:
   - Remove existing table block in base.
   - Reinsert generated table only if non-empty.
5. Preserve:
   - `defaults`
   - group customdrops sections
   - entity customdrops sections
   - `file-version`
   - non-owned `drop-table` entries
6. Serialize YAML with deterministic formatting (2-space indentation, stable key order for generated blocks).

---

## Diff Validation Strategy

Implement LM CustomDrops diff guard similar to other generators:

- Remove owned `drop-table` keys from original and generated.
- Deep-compare cleaned configs.
- Pass only when differences are limited to owned table keys.

Validation result shape:

```ts
{ valid: boolean; error?: string; differences?: string[] }
```

---

## Build Workflow Integration

### New Build Input Flags

Add LM customdrops generation controls in build payload:

```ts
inputs: {
  generateLMCustomDrops?: boolean;
  lmCustomDropsPath?: string; // optional override for base customdrops.yml
  // existing inputs...
}
```

### Build Branch

If `generateLMCustomDrops`:
1. Resolve base `customdrops.yml` path (override or bundled default).
2. Load Drop Tables config from profile.
3. Load/parse enabled catalog files.
4. Generate owned drop-table blocks.
5. Merge into base customdrops config.
6. Run diff validator.
7. Write output + build artifact with filename:
   - `${serverNameSanitized}-levelledmobs-customdrops.yml`
8. Add warnings for skipped catalogs/tables.

---

## Build Report Extensions

Include LM customdrops generation state and useful counts:

```ts
generated: {
  // existing...
  lmcustomdrops: boolean;
}

lmCustomDropsStats?: {
  tablesGenerated: number;
  itemsGenerated: number;
  catalogsSkipped: string[]; // with reason in warnings
}
```

---

## Edge Cases

1. **Empty table selection**
   - Omit table entirely.
2. **Item selected but missing from catalog**
   - Skip item and warn (non-fatal).
3. **Duplicate item across tables**
   - Allowed.
4. **Mixed-case or non-standard item IDs**
   - Normalize to output format; warn if invalid after normalization.
5. **No enabled valid catalogs**
   - Emit no owned table changes; generation succeeds with warnings.
6. **Base file missing `drop-table`**
   - Create `drop-table` and populate generated tables if any.

---

## Reference Inputs

- Example catalog: `reference/data/drops.json`
- Runtime sample target file:
  - `C:/Users/biggs/AppData/Roaming/mc-server-manager/data/runs/workspaces/charidh-1-21-11/plugins/LevelledMobs/customdrops.yml`

---

## Implementation Checklist

### Phase 1: Types + Profile Persistence
- [ ] Add Drop Tables config types to shared profile model.
- [ ] Add profile read/write support for Drop Tables section.

### Phase 2: Catalog Loader
- [ ] Implement JSON catalog discovery/loading.
- [ ] Implement key filtering (`_` metadata exclusion).
- [ ] Implement item ID normalization + validation.

### Phase 3: UI (Drop Tables)
- [ ] Build Drop Tables management section.
- [ ] Add select/unselect item controls.
- [ ] Add per-item override editor with inherited defaults UX.
- [ ] Save sparse overrides only.

### Phase 4: Generator + Merge
- [ ] Create LM customdrops generator module.
- [ ] Implement owned table emission logic.
- [ ] Implement merge into `customdrops.yml` preserving non-owned sections.

### Phase 5: Diff Gate + Build
- [ ] Implement customdrops diff validator.
- [ ] Wire generation branch into build handler + output paths.
- [ ] Add build report fields/warnings.

### Phase 6: Testing
- [ ] Table generated from valid catalog with manual selection.
- [ ] Empty table omitted.
- [ ] Missing catalog skipped with warning.
- [ ] Sparse overrides emitted correctly.
- [ ] Non-owned config sections preserved.
- [ ] Deterministic ordering (tables + items + keys).

---

## Open Decisions

- Define v1 override field set beyond `chance` and `amount` (minimal vs extended).
- Confirm exact YAML form for selected item with no overrides (`ITEM: {}` vs omitted node defaults) based on LM parser behavior.
- Decide whether to support catalog auto-discovery from folder or explicit per-file linking only.
