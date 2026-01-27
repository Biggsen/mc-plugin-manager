# regions-meta.yml — Schema for mc-plugin-manager

This document defines the `regions-meta.yml` format. **Region Forge** should export this file so that **mc-plugin-manager** can import it as the single source of region data, onboarding, and LevelledMobs metadata.

---

## 1. Overview

- **Filename:** `regions-meta.yml` (or any name; mc-plugin-manager will accept it via file picker)
- **Format:** YAML
- **Encoding:** UTF-8
- **Root:** Single mapping with required `format` and `world`, and optional sections: `regions`, `onboarding`, `spawnCenter`, `levelledMobs`

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

Unknown top-level keys are ignored. Mc-plugin-manager does not require `onboarding`, `spawnCenter`, or `levelledMobs` to be present; if missing, it uses defaults or leaves those areas unset.

---

## 3. `regions` (array of region objects)

Each element describes one region. Order is preserved for display; mc-plugin-manager indexes by `id` + `world` for lookups.

### 3.1 Region Object

| Field     | Type   | Required | Description |
|----------|--------|----------|-------------|
| `id`     | string | **Yes**  | Region ID. Lowercase, snake_case recommended. Must be unique within `world`. |
| `world`  | string | **Yes**  | World name. Should match the root-level `world` field. Typically `overworld`, `nether`, or `end`; mc-plugin-manager accepts any string. |
| `kind`   | string | **Yes**  | One of: `system`, `region`, `village`, `heart`. See §3.2. |
| `discover` | object | **Yes**  | Discovery behaviour. See §3.3. |

Unknown keys on a region object are ignored.

### 3.2 `kind` — Allowed Values

| Value    | Meaning |
|----------|---------|
| `system` | System region (e.g. spawn). No discovery rewards. |
| `region` | Normal discoverable region. |
| `village`| Village. Uses village-specific crates/counters in CE and village band in LevelledMobs. |
| `heart`  | Region heart (e.g. `heart_of_xyz`). Uses heart-specific crates/counters. |

### 3.3 `discover` Object

| Field               | Type   | Required | Description |
|---------------------|--------|----------|-------------|
| `method`            | string | **Yes**  | One of: `disabled`, `on_enter`, `first_join`. See §3.4. |
| `recipeId`         | string | **Yes**  | One of: `none`, `region`, `nether_region`, `heart`, `nether_heart`, `village`. See §3.5. |
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
| `heart`        | Overworld heart. |
| `nether_heart` | Nether heart. |
| `village`      | Overworld village. (Note: Villages are overworld-only; there is no `nether_village`.) |

`recipeId` should match `kind` and `world`. Mc-plugin-manager uses `kind` and `world` for CE reward logic; `recipeId` can be used for consistency checks or future features.

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
| `y`     | number | No       | Y coordinate. Region Forge does not export this; it is set manually in mc-plugin-manager after checking in-game. |
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
| `z`    | number | **Yes**  | Z coordinate. |

`y` is not required; mc-plugin-manager only needs x/z for 2D distance.

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

## 7. World Names

- **Root-level `world`**: Required field indicating which world this export represents. Typically `overworld`, `nether`, or `end`. All `regions[].world` values should match this field.
- **`regions[].world`**: Should match the root-level `world` field. Mc-plugin-manager may warn if they differ.
- **`onboarding.teleport.world` and `spawnCenter.world`**: Use the server's actual world name (e.g. `world`, `world_nether`, `world_the_end`, or custom names like `Teledosi`). These do not need to match the root `world` field.
- Common choices: `overworld`, `world`, `nether`, `world_nether`, `end`, `world_the_end`. Region Forge should use whatever matches the server’s world names.

---

## 8. Region ID Uniqueness

- `id` must be unique per **world**. The same `id` may appear in both `overworld` and `nether` (e.g. different regions in different worlds).

---

## 9. Full Example

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

  - id: elfdonia
    world: overworld
    kind: region
    discover:
      method: on_enter
      recipeId: region

levelledMobs:
  villageBandStrategy: easy
  regionBands:
    dradacliff: hard
    elfdonia: deadly
    firekeep: easy
    laraethia: normal
```

---

## 10. Minimal Valid Example

```yaml
format: 1
world: overworld
regions:
  - id: spawn
    world: overworld
    kind: system
    discover:
      method: disabled
      recipeId: none
```

---

## 11. Validation and Mc-Plugin-Manager Behaviour

- **`format`**  
  - If `format` is not `1`, mc-plugin-manager should reject the file with a clear error.

- **`world`**  
  - Required. If missing, reject.  
  - Indicates which world this export represents. Typically `overworld`, `nether`, or `end`.  
  - Mc-plugin-manager may validate that all `regions[].world` values match this field, or warn if they differ.

- **`regions`**  
  - Required. If missing or not an array, reject.  
  - Each element must have `id`, `world`, `kind`, `discover` (with `method`, `recipeId`). Invalid or missing required fields: warn and skip that region, or reject the file (mc-plugin-manager may choose per-field).  
  - `regions[].world` should match the root-level `world` field. Mc-plugin-manager may warn if they differ.

- **`discover.method` / `recipeId`**  
  - If `method` is `disabled`, `recipeId` should be `none`. Mc-plugin-manager may warn otherwise.

- **`levelledMobs.regionBands`**  
  - Keys that do not match any `regions[].id` (for the same logical world) are ignored; no rule is generated.

- **`levelledMobs.villageBandStrategy` and `regionBands` values**  
  - Must be one of: `easy`, `normal`, `hard`, `severe`, `deadly`. Invalid values: mc-plugin-manager skips that entry and may warn.

- **`onboarding.startRegionId`**  
  - Should match a `regions[].id`. If it does not, mc-plugin-manager can still store it and use it for first-join logic; behaviour is implementation-defined.

---

## 12. Changelog

| Version | Notes |
|--------|-------|
| 1      | Initial schema: regions, onboarding, spawnCenter, levelledMobs. |

---

*Schema for mc-plugin-manager. Region Forge should export `regions-meta.yml` conforming to this document.*
