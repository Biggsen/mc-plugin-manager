# Structures (POI) — Import, AA, CE, TAB — Specification

**Status: 📋 PLANNED**

## Purpose

Region Forge exports **`kind: structure`** regions with **`structureType`** and root **`structureFamilies`** (`label`, `counter`) in `regions-meta.yml` (see `reference/regions-meta-schema.md` §3.2, §7). Mc-plugin-manager already imports structure **rows** into `profile.regions` but **drops** `structureFamilies` and **does not** generate AA commands, Custom tiers, CE enter events, or TAB lines for POIs.

This spec closes that gap so structure discovery behaves like the schema describes: separate **Advanced Achievements** custom counters, **ConditionalEvents** one-time region-enter handling, and **TAB** scoreboard lines—without incrementing main exploration counters (`regions_discovered`, `total_discovered`, etc.).

---

## Dependencies

| Document / code | Role |
|-----------------|------|
| `reference/regions-meta-schema.md` | Authoritative YAML shape; denominators come from **counts** of imported regions per `structureType`, not from fixed numbers in `structureFamilies`. |
| `tasks/completed/Regions_Meta_Import_Spec.md` | Existing import merge rules for `profile.regions`, `regionsMeta.levelledMobs`. |
| `tasks/completed/AA_Custom_Achievements_Spec.md` | Tier templates, `calculateTiers`, merge rules for owned Custom categories. |
| `tasks/completed/TAB_Plugin_Integration_Spec.md` | Scoreboard layout and placeholder conventions. |
| `electron/regionParser.ts` | `importRegionsMeta` — extend parsing and return value. |
| `electron/ipc/handlers/importHandlers.ts` | Merge `structureFamilies` into `profile.regionsMeta`. |
| `electron/aaGenerator.ts` | Commands + Custom generation and `mergeAAConfig` owned-category list. |
| `electron/ceGenerator.ts` | `generateOwnedCEEvents`, `isOwnedEventKey`, structure filtering today at `kind !== 'structure'`. |
| `electron/tabGenerator.ts` (or equivalent) | World scoreboards — extend lines for structure families. |

---

## Goals

1. **Persist** `structureFamilies` from each regions-meta import into the server profile.
2. **Validate** structure rows on import (required fields, consistency with `structureFamilies`); fail soft (warn + skip bad rows) unless we agree to hard-fail—default **warn + skip** to match existing region validation style.
3. **AA**: Per-POI **Commands** (`discover…` id, Goal/Message/Name/DisplayName/Type per § Advanced Achievements) and per-family **Custom** tiers driven by **count of** `kind: structure` regions per `structureType` (see § Denominator rules).
4. **CE**: One-time `wgevents_region_enter` events keyed **`{id}_discover_once`**, `aach give` using the **same command id as AA** (`generateCommandId` / override), then **`aach add 1 Custom.<counter>`** only (default **no crate**, no `total_discovered` or main exploration counters).
5. **TAB**: **Structures** scoreboard section when a world has POIs; **`structureFamilies[].label` drives each family row’s title** (not hardcoded names); `%aach_custom_<counter>%/<N(T)>` for counts; **Current** row via `%condition:structure-name%` (condition body TBD / preserved from TAB template). (Plural **label** on TAB; AA command **DisplayName** uses singular from `structureType`, see § Advanced Achievements.)

---

## Non-goals (v1)

- LevelledMobs rules for structures (POIs are not main `kind: region` bands).
- Changing top-explorers **percentage** denominator to include structures (schema: structures do not count toward main exploration; keep `<TOTAL_COUNT>` definition unchanged).
- Nether/End-specific structure families unless present in data; generator must be **data-driven** off imported regions + `structureFamilies`.
- CommandWhitelist / DiscordSRV changes unless a follow-up task requires new commands.

---

## Data model

### `ServerProfile.regionsMeta` extension

```ts
regionsMeta?: {
  levelledMobs?: { ... }  // existing
  /** Merged from regions-meta root `structureFamilies`. Keys = structureType. */
  structureFamilies?: Record<
    string,
    { label: string; counter: string }
  >
}
```

- **`counter`**: AA / Placeholder API name **without** `Custom.` prefix (e.g. `ancient_cities_found`), same as schema §7.1.
- **Merge on import** (aligned with `levelledMobs.regionBands`):  
  `structureFamilies: { ...existing, ...fromFile }`  
  Keys from a **later** import for the same server **overwrite** earlier values for that key. If the file omits `structureFamilies`, **do not** clear existing `profile.regionsMeta.structureFamilies`.

### `importRegionsMeta` return type

Add optional:

```ts
structureFamilies?: Record<string, { label: string; counter: string }>
```

### Parser type `RegionsMetaExport`

Add root-level optional `structureFamilies` matching the schema.

---

## Import behaviour

### Parsing

- Read `structureFamilies` when present; validate shape: each value is an object with string `label` and string `counter`.
- Ignore unknown keys on each family object (schema §7.1).

### Per-region validation (`kind: structure`)

| Check | Action |
|-------|--------|
| Missing `structureType` | `console.warn`, **skip** region (do not push to `regions`). |
| `structureType` not a key in file’s `structureFamilies` | `console.warn`, **skip** region (or warn and keep row but generators skip—prefer **skip** for consistency). |
| `discover.method` not `on_enter` | Warn; v1 still import row (generators only emit CE for `on_enter`). |

### IPC / profile merge

After a successful parse, merge `result.structureFamilies` into `profile.regionsMeta` as above. Initialise `regionsMeta` if needed (same pattern as `levelledMobs`).

---

## Denominator and counting rules

- For each **`structureType` T**, let **N(T, W)** = number of regions in `profile.regions` with `kind === 'structure'`, `structureType === T`, `world === W`, and `discover.method !== 'disabled'`.
- Let **N(T)** = sum over worlds of **N(T, W)** (global POI count for that family).

**v1 default (single rule everywhere):**

- **AA Custom tiers** for family T use **N(T)** as the total (“all” tier = **N(T)**). One custom counter per `counter` key; all worlds contribute to the same stat.
- **TAB**: Show a subsection for family T on world **W**’s scoreboard only if **N(T, W) > 0** (so empty worlds do not show that family). Use placeholder `%aach_custom_<counter>%` with denominator **N(T)** (global). That keeps numerator ≤ denominator and matches the AA “all” tier.

**Future (out of v1):** Per-world AA counters or TAB denominators **N(T, W)** if design wants “100% of this world’s ancient cities” with a global stat—requires AA/TAB contract change.

---

## Advanced Achievements (`aaGenerator`)

### Commands (owned)

Include regions where `kind === 'structure'` and `discover.method !== 'disabled'` in **command generation** (same pipeline as other kinds, with structure-specific copy rules below).

**YAML key (command id):** `discover.commandIdOverride` if set, else **`generateCommandId(region.id)`** — `discover` + PascalCase from id (same rules as today for `of` / hearts).

**Per-region copy (from `region.id` and `region.structureType`):**

- **`Name`:** `discover_` + lowercase region id (same as `regionIdToSnakeCaseName`, e.g. `inner_core` → `discover_inner_core`).
- **`Goal`:** `Discover <Structure Id Name>` where `<Structure Id Name>` is the region id in **Title Case** (same idea as `snakeToTitleCase` / `getRegionName` for a flat id, e.g. `inner_core` → `Inner Core`).
- **`Message`:** `You found <Structure Id Name>` (same title case as Goal).
- **`DisplayName`:** **`<Singular Structure Type> Found`**, where **`<Singular Structure Type>`** is derived **only from `structureType`** (snake_case key), **not** from `structureFamilies.label` (labels stay plural, e.g. “Ancient Cities”, and are a poor fit for “X Found”).
  - **Rule (v1):** Split `structureType` on `_`, title-case each segment, join with spaces — e.g. `ancient_city` → `Ancient City`, `buried_treasure` → `Buried Treasure`, `trail_ruins` → `Trail Ruins`, `pillager_outpost` → `Pillager Outpost`.
  - Then **DisplayName** = that singular string + ` Found` (e.g. `Ancient City Found`).
  - If a future type string looks wrong, add a **small override map** in code; do not add schema fields for v1.
- **`Type`:** `normal`.

**Example** (`id: inner_core`, `structureType: ancient_city`):

```yaml
discoverInnerCore:
  Goal: Discover Inner Core
  Message: You found Inner Core
  Name: discover_inner_core
  DisplayName: Ancient City Found
  Type: normal
```

`discover.displayNameOverride` on the region, if present, replaces **`DisplayName`** only (same as other kinds).

### Custom section (owned) — one category per structure family counter

Emit **all** structure family counters that appear in the build: for each `structureType` T with **N(T) &gt; 0** and a matching entry in `profile.regionsMeta.structureFamilies` with **`counter`** and **`label`**:

- **Custom YAML key:** **`counter`** (e.g. `ancient_cities_found`) — must match CE `aach add Custom.<counter>` and AA’s internal stat name (no `Custom.` prefix in the key).
- **Tier keys:** numeric milestones only, produced by **`calculateTiers(STRUCTURE_TEMPLATE, N(T))`** (choose a **STRUCTURE_TEMPLATE** such as `[1, 'half', 'all']` or align with hearts/regions; same filtering rules as `AA_Custom_Achievements_Spec.md`).
- **Per-tier entry shape** (each generated tier value maps to one block under that `counter`):

| Field | Rule |
|-------|------|
| `Message` | **Template-driven** with substitutions. The **highest tier (“all”)** must read **`All <label> Found!`** where **`<label>`** is **`structureFamilies[T].label`** (e.g. `All Ancient Cities Found!`). Intermediate tiers use the **bundled prototype** messages with **`{label}`** / tier count substituted (same cloning approach as `generateCustomCategory` for villages/regions). |
| `Name` | **`<counter>_<tier>`** (e.g. `ancient_cities_found_7`). |
| `DisplayName` | **`<label> Wanderer`** (literal suffix ` Wanderer`; **`<label>`** = `structureFamilies[T].label`). If the bundled template defines per-tier `DisplayName`, substitute **`{label}`**; default v1 is the same **`<label> Wanderer`** for every tier unless the template varies by tier key. |
| `Type` | `normal` |
| `Reward` | From bundled prototype (clone per tier). **v1 default:** `Experience: 1000` on each tier unless the template specifies different rewards per numeric/`_half`/`_all` slot. |

**Example** (illustrative single tier; `counter: ancient_cities_found`, `label: Ancient Cities`, `N(T) = 14` ⇒ one of the emitted numeric keys might be `14`):

```yaml
ancient_cities_found:
  14:
    Message: All Ancient Cities Found!
    Name: ancient_cities_found_14
    DisplayName: Ancient Cities Wanderer
    Type: normal
    Reward:
      Experience: 1000
```

Lower tiers under the same `ancient_cities_found` key follow the same field set with different numeric keys and **Message** / optional **Reward** from the prototype (not necessarily the “All … Found!” line).

- **`mergeAAConfig`**: Extend owned-category replacement to include:
  - Fixed: `villages_discovered`, `regions_discovered`, `hearts_discovered`
  - **Dynamic**: every **`counter`** string present in generated structure Custom output for this build (so all structure families are regenerated each time).

### Bundled template

- Add a **prototype** `Custom` subcategory (e.g. `_structure_family_template`) whose tier slots (`1`, `_half`, `_all`, …) provide **Message**, **DisplayName**, **Reward** patterns with placeholders for **`{label}`** and tier numbers — cloned for each real **`counter`** + **`label`** pair, then pruned to **`calculateTiers`** output (same mental model as `generateCustomCategory` in `aaGenerator.ts`).
- Alternatively, hardcode the **DisplayName** / **Reward** rules above in code and only keep **Message** variants in YAML; tests should lock whichever approach is chosen.

### Preconditions

- If `structureFamilies` is missing but structure regions exist: **no** Custom tiers for those families; **warn** at build or import. Commands may still be generated if families missing—prefer **skip command generation** for structure rows without a resolvable family (consistent with skipped import).

---

## ConditionalEvents (`ceGenerator`)

### Naming and ownership

- Event keys **must** use the suffix **`_discover_once`** (e.g. `inner_core_discover_once`), **not** `_found_once` or other variants—`isOwnedEventKey` only treats `*_discover_once` as owned, so merge can replace regenerated events cleanly.
- Events are **generated from `profile.regions`** (and `structureFamilies` for the counter name). No per-POI rows are required in the bundled CE template; merge overwrites all owned `*_discover_once` keys each build.

### New events (shape)

For each structure region with `discover.method === 'on_enter'`, a resolvable `structureType`, a matching `structureFamilies[structureType].counter`, and the same **start-region skip** as other regions (`region.id !== onboarding.startRegionId`).

- `type: wgevents_region_enter`
- `one_time: true`
- `conditions: ['%region% == <canonical_region_id>']`
- **`commandId`**: same as AA Commands for that region—`discover.commandIdOverride` if set, else `generateCommandId(region.id)` (existing `discover…` style). **Do not** introduce a separate `find…` id scheme unless AA is changed to match.

**Minimal v1 `actions.default`** (optional `wait:` lines may be added for parity with other discover_once chains):

```yaml
inner_core_discover_once:
  type: wgevents_region_enter
  conditions:
    - '%region% == inner_core'
  one_time: true
  actions:
    default:
      - 'console_command: aach give discoverInnerCore %player%'
      - 'console_command: aach add 1 Custom.ancient_cities_found %player%'
```

(`discoverInnerCore` and `ancient_cities_found` are illustrative; real values come from `generateCommandId` / overrides and from `structureFamilies`.)

### Must not

- Increment `Custom.total_discovered`, `regions_discovered`, or any village/heart counter.
- Grant crates in v1 unless a later design adds a structure crate.
- Add `console_message` / metrics unless product asks to match region discover_once verbosity.

### `isOwnedEventKey`

- No change: structure events use `*_discover_once` like regions, villages, and hearts.

### Ordering

- Merge order remains deterministic; include structure `*_discover_once` in the sorted discover-once set (sort by key with other events).

---

## TAB (`tabGenerator`)

### Structures scoreboard (owned)

Add a world-specific scoreboard section (e.g. key `structures` under `scoreboard.scoreboards`) when that world has at least one structure POI (**N(T, W) &gt; 0** for any family), using the same **title** / **display-condition** / **world** patterns as the existing overworld scoreboard (server name color markup, Java client, `%world%=world` for overworld—mirror for nether/end if those worlds ever have structure rows).

**`lines` layout (conceptual):**

1. Leading animation / header lines (match style of other scoreboards).
2. Section title line, e.g. `&bStructures`.
3. **Current** line: `&eCurrent&7:||%condition:structure-name%` — shows whichever structure region the player is in (or empty when not in one). The **`structure-name`** condition body is **static TAB plugin YAML** (like `region-name` / `village-name`): **preserve from the base template** or add when the condition definition is finalized; mc-plugin-manager does not synthesize WG logic for it until that definition exists (see follow-up from product).
4. **One line per structure family** shown in this world: **row title** = **`structureFamilies[T].label`** (data-driven — no hardcoded “Ancient Cities” / “Igloos” strings in generator output). **Row value** = `%aach_custom_<counter>%/<DENOM>` where **`<counter>`** is `structureFamilies[T].counter` and **`<DENOM>`** = **N(T)** (global count per § Denominator rules).
5. **Formatting:** e.g. `&e<label>&7:||%aach_custom_<counter>%/<N(T)>` (color codes can follow the same convention as other scoreboard lines; escape `&` / `%` / `:` in `label` if ever needed).
6. Trailing animation / compass lines as required for parity with other scoreboards.

**Family row ordering:** Deterministic — e.g. sort by **`structureType`** string ascending (or by **`label`**), so diffs are stable across builds.

**Which families get a row:** Only types T with **N(T, W) &gt; 0** for this scoreboard’s world **and** a resolvable `structureFamilies[T]` entry (`label` + `counter`). Do not emit rows for families absent from the merged `structureFamilies` map.

### Merge / preservation

- Preserve surgical ownership: only touch owned scoreboard sections; follow existing merge and sorting rules.
- **`conditions.structure-name`**: treat as **preserved** from the bundled TAB template (same strategy as `region-name` / `village-name` in `TAB_Plugin_Integration_Spec.md`) until/unless a later spec adds generated structure detection logic.
- Update `tasks/completed/TAB_Plugin_Integration_Spec.md` or add a structures addendum once `structure-name` is defined and shipped (optional doc follow-up).

---

## Build pipeline

- `buildPluginConfig` (or equivalent) must pass **`profile.regionsMeta?.structureFamilies`** into AA, CE, and TAB generators together with `profile.regions`.
- Bump **`generatorVersions`** for affected plugins if emit output shape changes (per existing project rules).

---

## Testing

| Area | Test idea |
|------|-----------|
| Parser | YAML with `structureFamilies` + valid structure rows → merged profile; missing `structureType` → row skipped + warning |
| Merge | Second import overwrites same `structureType` key; import without `structureFamilies` preserves previous |
| AA | Custom per `counter`: tier keys from `calculateTiers`; `Name` `<counter>_<tier>`; **all** tier `Message` `All <label> Found!`; `DisplayName` `<label> Wanderer`; `Reward.Experience` from template (default 1000); Commands per POI with singular-type `DisplayName` + ` Found` |
| CE | `{id}_discover_once`; `aach give` matches AA command id; `Custom.<counter>` only; no `total_discovered` |
| TAB | Structures scoreboard when N(T,W)&gt;0; each family row uses **`label`** + `%aach_custom_<counter>%/<N(T)>`; deterministic order; `structure-name` condition preserved when present in template |
| Integration | Build from reference `reference/regions-meta.yml` (extend fixture if needed) |

---

## Phased delivery (suggested)

| Phase | Deliverable |
|-------|-------------|
| **1** | Types + parser + IPC merge for `structureFamilies`; import validation for structure rows |
| **2** | CE structure `discover_once` events + tests |
| **3** | AA Commands for structures + Custom tiers per family + template + mergeAAConfig dynamic owned keys |
| **4** | TAB scoreboard lines + tests |
| **5** | Docs: reference schema cross-link; mark this spec **COMPLETED** |

---

## Acceptance criteria

- Importing a Region Forge file with structures and `structureFamilies` yields a profile that survives save/load and shows structure counts in UI (existing Regions screen already shows `structureType`).
- Build produces AA config with discover commands for every imported structure POI (Goal / Message / Name / DisplayName / Type per § Advanced Achievements; **DisplayName** from `structureType` singular + ` Found`) and **Custom** milestones for **every** family **`counter`** with N(T) &gt; 0 (per-tier shape: **Name** `<counter>_<tier>`, **all**-tier **Message** `All <label> Found!`, **DisplayName** `<label> Wanderer`, **Reward.Experience** per § Custom section).
- Build produces CE events (`{id}_discover_once`) that `aach give` the same per-POI command as AA and increment only the family `Custom.<counter>`.
- Build produces a **structures** scoreboard section when applicable: **Current** line uses `%condition:structure-name%` (condition YAML supplied / preserved per template); family rows use **`structureFamilies[].label`** for titles and `%aach_custom_<counter>%/<N(T)>` for values; no regression to other scoreboards.
- No regression for servers with **zero** structure regions (no empty Custom categories injected unless template requires).

---

## Changelog (this spec)

| Revision | Notes |
|----------|--------|
| 1.0 | Initial spec: structureFamilies persistence, AA/CE/TAB, counting rules, phases. |
| 1.1 | CE: locked to `*_discover_once`; documented codegen-only (no bundled per-POI rows); example YAML; `commandId` aligned with AA `generateCommandId` / override; explicit must-not list; start-region skip. |
| 1.2 | AA Commands: fixed shape (Goal / Message / Name / DisplayName / Type); **DisplayName** singular via `structureType` → title case + ` Found`; TAB headings still use plural `label`. |
| 1.3 | AA Custom: per-**counter** categories; per-tier shape (Message / Name / DisplayName / Type / Reward.Experience); **all** tier Message `All <label> Found!`; **DisplayName** `<label> Wanderer`; **Name** `<counter>_<tier>`; bundled prototype + `calculateTiers`. |
| 1.4 | TAB: structures scoreboard section; **data-driven row titles** from `structureFamilies.label`; `%condition:structure-name%` for current row; preserve template-defined `structure-name` condition until defined; ordering + N(T) denominators. |
