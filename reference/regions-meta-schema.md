# regions-meta.yml — Schema for mc-plugin-manager

This document defines the `regions-meta.yml` format. **Region Forge** should export this file so that **mc-plugin-manager** can import it as the single source of region data, onboarding, and LevelledMobs metadata.

---

## 1. Overview

- **Filename:** `regions-meta.yml` (or any name; mc-plugin-manager will accept it via file picker)
- **Format:** YAML
- **Encoding:** UTF-8
- **Root:** Single mapping with required `format` and `world`, and optional sections: `regions`, `onboarding`, `spawnCenter`, `levelledMobs`, `structureFamilies`

---

## 2. Root Fields

| Field        | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `format`    | integer| **Yes**  | Schema version. Use `1`. Mc-plugin-manager rejects other values. |
| `world`     | string | **Yes**  | The world this export represents. Typically `overworld`, `nether`, or `end`. All `regions[].world` should match this value. |
| `regions`   | array  | **Yes**  | List of region objects. See §3. |
| `onboarding`| object | No       | First-join teleport and start region. See §4. |
| `spawnCenter` | object | No     | World spawn center (for spawn region). See §5. |
| `levelledMobs` | object | No     | LevelledMobs bands and village strategy. See §6. |
| `structureFamilies` | object | No | Labels and AA counter names for **structure** regions (POIs). See §7. Should be present when any region has `kind: structure`. |

Unknown top-level keys are ignored. Mc-plugin-manager does not require `onboarding`, `spawnCenter`, `levelledMobs`, or `structureFamilies` to be present; if missing, it uses defaults or leaves those areas unset.

---

## 3. `regions` (array of region objects)

Each element describes one region. Order is preserved for display; mc-plugin-manager indexes by `id` + `world` for lookups.

### 3.1 Region Object

| Field     | Type   | Required | Description |
|----------|--------|----------|-------------|
| `id`     | string | **Yes**  | Region ID. Lowercase, snake_case recommended. Must be unique within `world`. |
| `world`  | string | **Yes**  | World name. Should match the root-level `world` field. Typically `overworld`, `nether`, or `end`; mc-plugin-manager accepts any string. |
| `kind`   | string | **Yes**  | One of: `system`, `region`, `village`, `heart`, `structure`. See §3.2. |
| `structureType` | string | **If `kind: structure`** | Which structure family this region belongs to. Must match a key in root `structureFamilies`. See §3.2 and §7. |
| `discover` | object | **Yes**  | Discovery behaviour. See §3.3. For `kind: structure`, use `method: on_enter` (mc-plugin-manager derives `recipeId` when omitted). |
| `biomes` | array  | No       | Biome breakdown for this region (from map scan). See §3.6. Only present for `kind: region` when a biome map is available. Omitted for `kind: structure`. |
| `category` | string | No     | Minecraft item category (e.g. `ores`, `stone`, `wood`, `food`). Used for economy plugins or discovery rewards. VZ price guide categories. |
| `items`  | array  | No       | Up to 3 Minecraft items for this region. See §3.7. Used for economy plugins or discovery rewards. VZ price guide item IDs. |
| `theme`  | array  | No       | Up to 3 theme pairs (A + B) for narrative flavor. See §3.8. Storyteller's Automaton table. |
| `description` | string | No   | Free-form description of the region. Used for display, quest hooks, or discovery text. mc-plugin-manager may use this for region lore or UI. May be multiline; Region Forge exports as YAML literal block scalar (`|`) to preserve line breaks. |

Unknown keys on a region object are ignored.

### 3.2 `kind` — Allowed Values

| Value    | Meaning |
|----------|---------|
| `system` | System region (e.g. spawn). No discovery rewards. |
| `region` | Normal discoverable region. Counts toward main exploration metrics (with villages and hearts). |
| `village`| Village. Uses village-specific crates/counters in CE and village band in LevelledMobs. Counts toward main exploration metrics. |
| `heart`  | Region heart (e.g. `heart_of_xyz`). Uses heart-specific crates/counters. Counts toward main exploration metrics. |
| `structure` | WorldGen / POI footprint (ancient city, desert well, igloo, etc.). **Does not** count toward main exploration totals. Uses separate AA counters, CE rules, and TAB scoreboard lines defined via `structureFamilies` and `structureType`. Display strings are derived from `id` (unique snake_case ids). |

When `kind` is `structure`, **`structureType` is required** and must be one of the keys in `structureFamilies` for this export.

**`structureType` — canonical values** (extend in Region Forge if you add families; keep in sync with `structureFamilies`):

| `structureType`   | Typical use |
|-------------------|-------------|
| `ancient_city`    | Ancient Cities |
| `buried_treasure` | Buried Treasures |
| `desert_pyramid`  | Desert Pyramids |
| `desert_well`     | Desert Wells |
| `igloo`           | Igloos |
| `jungle_temple`   | Jungle Temples |
| `pillager_outpost`| Pillager Outposts |
| `trail_ruins`     | Trail Ruins |

### 3.3 `discover` Object

| Field               | Type   | Required | Description |
|---------------------|--------|----------|-------------|
| `method`            | string | **Yes**  | One of: `disabled`, `on_enter`, `first_join`. See §3.4. |
| `recipeId`         | string | No (deprecated) | **Omit** in new Region Forge exports. Mc-plugin-manager derives a stored value from `kind` + `world` when absent. If present, must be one of: `none`, `region`, `nether_region`, `end_region`, `heart`, `nether_heart`, `end_heart`, `village`. See §3.5. |
| `commandIdOverride` | string | No       | Override for AA command ID. If omitted, mc-plugin-manager derives from `id`. |
| `displayNameOverride` | string | No     | Override for AA display name. If omitted, derived from `id`. |

### 3.4 `discover.method` — Allowed Values

| Value       | Meaning |
|-------------|---------|
| `disabled`  | No discovery (e.g. spawn). `recipeId` should be `none`. |
| `on_enter`  | Discover when player enters the region. |
| `first_join`| Discover on first join (only one region per world should use this). |

### 3.5 `discover.recipeId` — Allowed Values

| Value          | Typical use |
|----------------|-------------|
| `none`         | `kind: system`, `method: disabled`. |
| `region`       | Overworld region. |
| `nether_region`| Nether region. |
| `end_region`   | End region. |
| `heart`        | Overworld heart. |
| `nether_heart` | Nether heart. |
| `end_heart`    | End heart. |
| `village`      | Overworld village. (Note: Villages are overworld-only; there is no `nether_village` or `end_village`.) |

When `recipeId` is **omitted**, mc-plugin-manager sets a stored value from `kind` + `world` (e.g. `region` + overworld → `region`; `structure` → `none`). **Generators use `kind` and `world`, not `recipeId`.** When `recipeId` is **present**, it should match `kind` and `world`. The field is deprecated for new exports; it remains documented for older files.

### 3.6 `biomes` (array, optional)

Biome breakdown for a region, derived from sampling the biome map within the region polygon. Region Forge populates this when a biome map is loaded and the map origin is set. Only present for `kind: region` (main regions) in overworld and nether exports. Omitted for spawn, hearts, villages, `kind: structure`, and for End dimension (End has no biome map support).

| Field        | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `biome`     | string | **Yes**  | Biome identifier (e.g. `plains`, `forest`, `oak_forest`). |
| `percentage` | number | **Yes**  | Approximate percentage of the region covered by this biome (0–100). Percentages sum to 100 across all entries. |

Entries are sorted by percentage descending. Mc-plugin-manager may use this for filtering, display, or plugin configuration. Unknown keys in a biome entry are ignored.

### 3.7 `items` (array, optional)

Up to 3 Minecraft items associated with this region. Region Forge populates these from the VZ price guide (random or manual assignment). Mc-plugin-manager may use them for economy plugins, discovery rewards, or CE crate configuration.

| Field  | Type   | Required | Description |
|--------|--------|----------|-------------|
| `id`   | string | **Yes**  | Minecraft item ID (e.g. `diamond`, `acacia_planks`). |
| `name` | string | **Yes**  | Display name (e.g. `diamond`, `acacia planks`). |

### 3.8 `theme` (array, optional)

Up to 3 theme pairs (A + B) from the Storyteller's Automaton table. Region Forge populates these for narrative flavor; mc-plugin-manager may use them for region descriptions, quest hooks, or discovery text.

| Field  | Type   | Required | Description |
|--------|--------|----------|-------------|
| `a`    | string | **Yes**  | First word (e.g. `Return`, `Seek`, `Hidden`). |
| `b`    | string | **Yes**  | Second word (e.g. `Death`, `Truth`, `Conquest`). |

---

## 4. `onboarding` (object, optional)

First-join spawn and discovery. If absent, mc-plugin-manager leaves `profile.onboarding` unset or uses in-app defaults.

| Field           | Type   | Required | Description |
|-----------------|--------|----------|-------------|
| `startRegionId` | string | **Yes**  | Region `id` treated as “first-join” discovery. Should match one `regions[].id` with `discover.method: first_join` (or mc-plugin-manager can infer). |
| `teleport`      | object | **Yes**  | Where to teleport the player on first join. See §4.1. |

### 4.1 `onboarding.teleport`

| Field   | Type   | Required | Description |
|---------|--------|----------|-------------|
| `world` | string | **Yes**  | World name. |
| `x`     | number | **Yes**  | X coordinate. |
| `y`     | number | No       | Y coordinate. Region Forge exports this when set (manual; default 0). Mc-plugin-manager may override after checking in-game. |
| `z`     | number | **Yes**  | Z coordinate. |
| `yaw`   | number | No       | Yaw (degrees). |
| `pitch` | number | No       | Pitch (degrees). |

---

## 5. `spawnCenter` (object, optional)

Center of the spawn region. Used for distance-from-origin logic in some plugins. If the spawn region is in `regions`, this can describe its center.

| Field  | Type   | Required | Description |
|--------|--------|----------|-------------|
| `world`| string | **Yes**  | World name. |
| `x`    | number | **Yes**  | X coordinate. |
| `y`    | number | No       | Y coordinate. Region Forge exports when set (manual; default 0). |
| `z`    | number | **Yes**  | Z coordinate. |

---

## 6. `levelledMobs` (object, optional)

Per-region difficulty bands and village band strategy for LevelledMobs custom-rules. If absent, mc-plugin-manager does not generate LevelledMobs region-band or village-band rules.

| Field                | Type   | Required | Description |
|----------------------|--------|----------|-------------|
| `villageBandStrategy`| string | No       | Strategy for the “Villages” band. One of: `easy`, `normal`, `hard`, `severe`, `deadly`. Default in mc-plugin-manager: `easy`. |
| `regionBands`       | object | No       | Map of region `id` → difficulty. See §6.1. |

### 6.1 `levelledMobs.regionBands`

- **Type:** Object (map)
- **Keys:** Region `id` (must exist in `regions` for the rule to be generated)
- **Values:** One of: `easy`, `normal`, `hard`, `severe`, `deadly`

Only include entries for regions that should have a LevelledMobs region-band rule. Omitted regions get no region-band.

---

## 7. `structureFamilies` (object, optional)

Metadata for **structure** regions (`kind: structure`): human-readable labels for TAB and the **Advanced Achievements counter name** (suffix after `Custom.`) used for `aach add` and placeholders such as `%aach_custom_<counter>%`.

**Totals** (e.g. `14/14` on TAB, AA tier thresholds): **not** stored here. Mc-plugin-manager derives denominators by **counting** imported regions per `structureType` so generated configs always match the region list.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| *(keys)* | string | **Yes** | Each key is a `structureType` (e.g. `ancient_city`). Must match `regions[].structureType` values used in this file. |
| *(each value)* | object | **Yes** | See §7.1. |

If any region has `kind: structure`, `structureFamilies` **should** include an entry for every `structureType` used. Mc-plugin-manager may warn if a `structureType` is missing from this map.

Unknown keys in `structureFamilies` are ignored unless referenced by a region.

### 7.1 Structure family entry

| Field   | Type   | Required | Description |
|---------|--------|----------|-------------|
| `label` | string | **Yes**  | Short label for TAB and UI (e.g. `Ancient Cities`, `Desert Wells`). |
| `counter` | string | **Yes** | AA counter key **without** the `Custom.` prefix (e.g. `ancient_cities_found`). Used for `Custom.<counter>` in CE and TAB. |

Example:

```yaml
structureFamilies:
  ancient_city:
    label: Ancient Cities
    counter: ancient_cities_found
  desert_well:
    label: Desert Wells
    counter: desert_wells_found
```

---

## 8. World Names

- **Root-level `world`**: Required field indicating which world this export represents. Typically `overworld`, `nether`, or `end`. All `regions[].world` values should match this field.
- **`regions[].world`**: Should match the root-level `world` field. Mc-plugin-manager may warn if they differ.
- **`onboarding.teleport.world` and `spawnCenter.world`**: Use the server's actual world name (e.g. `world`, `world_nether`, `world_the_end`, or custom names like `Teledosi`). These do not need to match the root `world` field.
- Common choices: `overworld`, `world`, `nether`, `world_nether`, `end`, `world_the_end`. Region Forge should use whatever matches the server’s world names.

---

## 9. Region ID Uniqueness

- `id` must be unique per **world**. The same `id` may appear in both `overworld` and `nether` (e.g. different regions in different worlds).

---

## 10. Full Example

```yaml
format: 1
world: overworld

onboarding:
  startRegionId: acornbrook
  teleport:
    world: world
    x: 120
    y: 64
    z: -340
    yaw: 90
    pitch: 0

spawnCenter:
  world: world
  x: 0
  y: 0
  z: 0

regions:
  - id: spawn
    world: overworld
    kind: system
    discover:
      method: disabled
      recipeId: none

  - id: heart_of_dradacliff
    world: overworld
    kind: heart
    discover:
      method: on_enter
      recipeId: heart

  - id: acornbrook
    world: overworld
    kind: village
    discover:
      method: first_join
      recipeId: village

  - id: rotherhithe
    world: overworld
    kind: village
    discover:
      method: on_enter
      recipeId: village

  - id: dradacliff
    world: overworld
    kind: region
    discover:
      method: on_enter
      recipeId: region
    description: A rugged highland region rich in mineral deposits.
    category: ores
    items:
      - id: diamond
        name: diamond
      - id: gold_ingot
        name: gold ingot
      - id: coal
        name: coal
    theme:
      - a: Seek
        b: Truth
      - a: Hidden
        b: Conquest
    biomes:
      - biome: plains
        percentage: 45
      - biome: forest
        percentage: 30
      - biome: oak_forest
        percentage: 25

  - id: elfdonia
    world: overworld
    kind: region
    discover:
      method: on_enter
      recipeId: region

  - id: inner_core
    world: overworld
    kind: structure
    structureType: ancient_city
    discover:
      method: on_enter
      recipeId: none

structureFamilies:
  ancient_city:
    label: Ancient Cities
    counter: ancient_cities_found
  buried_treasure:
    label: Buried Treasures
    counter: buried_treasures_found
  desert_pyramid:
    label: Desert Pyramids
    counter: desert_pyramids_found
  desert_well:
    label: Desert Wells
    counter: desert_wells_found
  igloo:
    label: Igloos
    counter: igloos_found
  jungle_temple:
    label: Jungle Temples
    counter: jungle_temples_found
  pillager_outpost:
    label: Pillager Outposts
    counter: pillager_outposts_found
  trail_ruins:
    label: Trail Ruins
    counter: trail_ruins_found

levelledMobs:
  villageBandStrategy: easy
  regionBands:
    dradacliff: hard
    elfdonia: deadly
    firekeep: easy
    laraethia: normal
```

---

## 11. Minimal Valid Example

```yaml
format: 1
world: overworld
regions:
  - id: spawn
    world: overworld
    kind: system
    discover:
      method: disabled
```

---

## 12. Validation and Mc-Plugin-Manager Behaviour

- **`format`**  
  - If `format` is not `1`, mc-plugin-manager should reject the file with a clear error.

- **`world`**  
  - Required. If missing, reject.  
  - Indicates which world this export represents. Typically `overworld`, `nether`, or `end`.  
  - Mc-plugin-manager may validate that all `regions[].world` values match this field, or warn if they differ.

- **`regions`**  
  - Required. If missing or not an array, reject.  
  - Each element must have `id`, `world`, `kind`, `discover` with **`method`**. `discover.recipeId` is optional; if omitted, mc-plugin-manager derives it. Invalid or missing required fields: warn and skip that region, or reject the file (mc-plugin-manager may choose per-field).  
  - `regions[].world` should match the root-level `world` field. Mc-plugin-manager may warn if they differ.

- **`discover.method` / `recipeId`**  
  - If `method` is `disabled`, `recipeId` (when present) should be `none`. Mc-plugin-manager may warn otherwise. If `recipeId` is omitted, the importer derives `none` for `kind: system` and `structure`, and appropriate values for other kinds.

- **`levelledMobs.regionBands`**  
  - Keys that do not match any `regions[].id` (for the same logical world) are ignored; no rule is generated.

- **`levelledMobs.villageBandStrategy` and `regionBands` values**  
  - Must be one of: `easy`, `normal`, `hard`, `severe`, `deadly`. Invalid values: mc-plugin-manager skips that entry and may warn.

- **`onboarding.startRegionId`**  
  - Should match a `regions[].id`. If it does not, mc-plugin-manager can still store it and use it for first-join logic; behaviour is implementation-defined.

- **`kind: structure` and `structureType`**  
  - If `kind` is `structure`, `structureType` must be set and should appear under `structureFamilies`. Mc-plugin-manager may skip or reject regions that violate this.  
  - **Denominators** for TAB and AA structure tiers: derive from the **count** of imported regions per `structureType`, not from fixed numbers in `structureFamilies`.

- **`structureFamilies`**  
  - Each `counter` should be a stable snake_case identifier matching the AA custom counter you configure (e.g. `ancient_cities_found`).  
  - `label` is for display only; human-facing names for individual regions come from **`id`** (formatting rules in mc-plugin-manager).

---

## 13. Changelog

| Version | Notes |
|--------|-------|
| 1      | Initial schema: regions, onboarding, spawnCenter, levelledMobs. |
| 1.1    | Added optional `biomes` array on region objects (§3.6): biome breakdown from map scan for `kind: region`. |
| 1.2    | Added optional `category` and `items` on region objects (§3.7): Minecraft category and up to 3 items from VZ price guide. |
| 1.3    | Added optional `theme` on region objects (§3.8): up to 3 theme pairs (A + B) from Storyteller's Automaton table. |
| 1.4    | Added optional `description` on region objects: free-form text for display, quest hooks, or discovery. |
| 1.5    | Added `end_region` and `end_heart` recipeIds for End dimension. End exports omit `biomes` (no biome map support). |
| 1.6    | Region Forge exports optional `y` in `spawnCenter` and `onboarding.teleport` (manual value; default 0). |
| 1.7    | Added `kind: structure`, per-region `structureType`, and root `structureFamilies` (`label`, `counter`). Structure POIs do not count toward main exploration metrics; TAB/AA denominators are derived by counting regions per `structureType` in mc-plugin-manager. `discover.recipeId` is optional; omit in new Region Forge exports (mc-plugin-manager derives when absent). |

---

*Schema for mc-plugin-manager. Region Forge should export `regions-meta.yml` conforming to this document.*
