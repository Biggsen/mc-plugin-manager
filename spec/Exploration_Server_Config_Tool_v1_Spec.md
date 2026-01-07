# Exploration Server Config Tool (MC Plugin Manager) — v1 Spec

## Purpose
A local desktop GUI application that compiles **exploration-server experience data** (primarily regions + onboarding) into **fully-ready plugin configuration files**.

Initial scope focuses on generating and merging *owned* sections for:
- **ConditionalEvents** (`config.yml`)
- **AdvancedAchievements** (`config.yml`)

The tool is optimized for fast, safe regeneration of large configs with deterministic output and minimal drift.

## Core Principles
1. **GUI-first**: primary workflow is through a desktop interface.
2. **Compiler model**: store intent internally; generate configs from intent.
3. **Surgical ownership**: only touch explicitly owned config sections; preserve everything else verbatim (as YAML structures).
4. **Deterministic builds**: stable ordering and consistent formatting to minimize diffs.
5. **Local-first**: no cloud services required.

## Non-Goals (v1)
- Full generic “any-plugin” configuration editor.
- A full WorldGuard region editor (Region Forge remains source of region definitions).
- Managing every AdvancedAchievements category beyond `Commands.*`.
- Rewriting or reformatting entire plugin configs outside owned sections.

---

## Tech Stack
### Desktop
- **Electron** (desktop shell, filesystem access)
- **React + TypeScript + Vite** (renderer UI)
- **Node.js (TypeScript)** for core logic

### Libraries
- YAML: `yaml` (npm)
- Validation: `zod`
- Diff: `diff` (or `react-diff-viewer` in UI)
- Optional: `fs-extra` for file utilities

### Security / Architecture
- Use an Electron **preload** bridge with limited IPC APIs.
- Perform file I/O + generation in the **main process**.

---

## Data Model (Internal)

### ServerProfile
Stored per server. Minimum fields:

```ts
type ServerId = string; // e.g. "charidh"

type ServerProfile = {
  id: ServerId;
  name: string;

  // imports
  sources: {
    overworld?: ImportedSource;
    nether?: ImportedSource;
  };

  // internal compiled region catalogue (derived from imports + classification)
  regions: RegionRecord[];

  // onboarding policy used to generate CE first_join
  onboarding: {
    startRegionId: string; // e.g. "warriotos"
    teleport: {
      world: string;
      x: number; y: number; z: number;
      yaw?: number; pitch?: number;
    };
  };

  // build settings and last build
  build: {
    lastBuildId?: string;
    outputDirectory?: string;
  };
};

type ImportedSource = {
  label: string; // "overworld" | "nether"
  originalFilename: string;
  importedAtIso: string;
  fileHash: string;
};

type RegionKind = "system" | "region" | "village" | "heart";

type DiscoverMethod = "disabled" | "on_enter" | "first_join";

type RewardRecipeId = "region" | "heart" | "nether_region" | "nether_heart" | "none";

type RegionRecord = {
  world: "overworld" | "nether";
  id: string;         // canonical id (lowercase, snake_case)
  kind: RegionKind;

  // discovery intent
  discover: {
    method: DiscoverMethod;
    recipeId: RewardRecipeId;
    commandIdOverride?: string; // optional
    displayNameOverride?: string; // optional
  };
};
```

### Classification & Defaults (v1)
Applied after import in order:

1. **System regions**: If `id === "spawn"` → `kind=system`, `discover.method=disabled`, `recipeId=none`

2. **First-join region**: If `id === <onboarding.startRegionId>` → `discover.method=first_join`, `recipeId=region` (world-specific)

3. **Hearts**: If `id.startsWith("heart_of_")` → `kind=heart`, `discover.method=on_enter`
   - Overworld → `recipeId=heart`
   - Nether → `recipeId=nether_heart`

4. **Regular regions** (non-system, non-first-join, non-heart):
   - **Village detection**: Check `flags.greeting` text. If contains the word "village" (case-insensitive) → `kind=village`, otherwise → `kind=region`
   - **Note**: The `parent:` field indicates a subregion relationship but does not determine kind (subregions may be villages or other types in the future)
   - `discover.method=on_enter`
   - Overworld → `recipeId=region`
   - Nether → `recipeId=nether_region`

### Reward Recipes (v1, hardcoded)
Recipes are *not* a general “knob system” in v1; they are minimal and opinionated:

- `region`:
  - CE actions:
    - wait: 5
    - console_command: `aach give <AA_COMMAND_ID> %player%`
    - console_command: `aach add 1 Custom.regions_discovered %player%`
    - console_command: `aach add 1 Custom.total_discovered %player%`
    - console_command: `cc give virtual RegionCrate 1 %player%`
- `heart`:
  - as above, but:
    - `Custom.hearts_discovered`
    - crate: `HeartCrate`
- `nether_region`:
  - increment: `Custom.nether_regions_discovered`, `Custom.total_discovered`
  - crate: `RegionCrate` (or configurable later)
- `nether_heart`:
  - increment: `Custom.nether_hearts_discovered`, `Custom.total_discovered`
  - crate: `HeartCrate`
- `none`: no output

**Counter names**:
- `Custom.regions_discovered` - Overworld region discoveries
- `Custom.villages_discovered` - Village discoveries (if villages tracked separately)
- `Custom.hearts_discovered` - Heart discoveries
- `Custom.nether_regions_discovered` - Nether region discoveries
- `Custom.nether_hearts_discovered` - Nether heart discoveries
- `Custom.total_discovered` - Total discoveries across all types

> Note: The `Custom.*` counters must already exist in AA config (preserved). v1 validates presence and warns/fails per policy.

---

## Owned Sections Strategy (Option 1 / Fastest)

### ConditionalEvents (`config.yml`)
**Owned**
- `Events.*` where key matches `*_discover_once`
- `Events.region_heart_discover_once`
- `Events.first_join`

**Preserved**
- `Config` (all)
- `Messages` (all)
- Any other `Events.*` keys

**Merge rules**
1. Parse YAML into object (preserve structure, 2-space indentation).
2. Remove owned event keys from `Events`.
3. Insert regenerated owned keys into `Events`.
4. Sort owned keys alphabetically for deterministic output (e.g., `cherrybrook_discover_once` before `monkvos_discover_once`).
5. Preserve all non-owned keys in original positions where possible.

### AdvancedAchievements (`config.yml`)
**Owned**
- `Commands` section entirely (`Commands.*`)

**Preserved**
- All other top-level and category sections (`Custom`, globals, etc.)

**Merge rules**
1. Parse YAML into object (preserve structure, 2-space indentation).
2. Replace `Commands` with regenerated `Commands`.
3. Sort command IDs alphabetically for deterministic output.
4. Leave everything else untouched (preserve formatting, comments where possible).

---

## Naming Conventions (Deterministic)

### CE Event Key
- For discover-on-enter regions/hearts:
  - `<regionId>_discover_once`
- Global:
  - `region_heart_discover_once` (special rule, see below)
  - `first_join` (special rule)

### AA Command ID generation
**Pattern**: `discover` + PascalCase(regionId)

**Conversion rules**:
- Convert `snake_case` to PascalCase: `cherrybrook` → `discoverCherrybrook`
- Hearts: Keep full name → `heart_of_warriotos` → `discoverHeartOfWarriotos`
- Nether regions with underscores: Remove underscores in PascalCase → `ebon_of_wither` → `discoverEbonofWither`
- Examples:
  - `warriotos` → `discoverWarriotos`
  - `heart_of_monkvos` → `discoverHeartOfMonkvos`
  - `ebon_of_wither` → `discoverEbonofWither`
  - `heart_of_ebon_of_wither` → `discoverHeartOfEbonofWither`

**Override**: `RegionRecord.discover.commandIdOverride` takes precedence

### Display Name generation
- Default: Title Case derived from id:
  - `cherrybrook` → `Cherrybrook`
  - `heart_of_cherrybrook` → `Heart of Cherrybrook`
- Override:
  - `displayNameOverride`

---

## Generation Details

### 1) ConditionalEvents — discover-on-enter events
Generate for all regions where:
- `discover.method == "on_enter"`

Event template:

```yaml
<id>_discover_once:
  type: wgevents_region_enter
  one_time: true
  conditions:
    - "%region% == <id>"
  actions:
    default:
      - "wait: 5"
      - "console_command: aach give <AA_COMMAND_ID> %player%"
      - "console_command: aach add 1 <COUNTER> %player%"           # repeated per recipe counters
      - "console_command: cc give virtual <CRATE> 1 %player%"      # if recipe has crate
```

### 2) ConditionalEvents — region_heart_discover_once
Generate once, regardless of specific heart regions, for UX messaging only:

```yaml
region_heart_discover_once:
  type: wgevents_region_enter
  one_time: true
  conditions:
    - "%region% startsWith heart"
  actions:
    default:
      - "message: &aYou discovered a &eheart&a!"
      - "message: &7Hearts unlock rewards as you discover more."
```

(Exact strings can be adjusted later; v1 uses fixed defaults.)

### 3) ConditionalEvents — first_join
Generated from `ServerProfile.onboarding`:
- `player_join`, `one_time: true`
- Teleport to the stored location using `console_command: tp`
- Award the starting region command achievement + region recipe rewards

Template:

```yaml
first_join:
  type: player_join
  one_time: true
  actions:
    default:
      - "console_command: tp %player% <x> <y> <z>"
      - "wait: 5"
      - "console_command: aach give <AA_START_COMMAND> %player%"
      - "console_command: aach add 1 Custom.regions_discovered %player%"
      - "console_command: aach add 1 Custom.total_discovered %player%"
      - "console_command: cc give virtual RegionCrate 1 %player%"
```

**Note**: If `yaw` and `pitch` are provided in `onboarding.teleport`, they can be included in the tp command. If omitted, use 3-parameter format. World is not included in the tp command (handled by server context).

### 4) AdvancedAchievements — Commands section
Generate for all regions where:
- `discover.method != "disabled"`

Template:

```yaml
Commands:
  <AA_COMMAND_ID>:
    1:
      Goal: "<AA_COMMAND_ID>"
      Message: "You discovered <DISPLAY_NAME>!"
      Name: "<AA_COMMAND_ID>"
      DisplayName: "<DISPLAY_NAME>"
      Type: "normal"
```

---

## Region Forge Export Format

Region Forge exports WorldGuard regions in the following YAML structure:

**Top-level structure**:
```yaml
regions:
  <region_id>:
    type: cuboid | poly2d
    min-y: <number>   # -64 to 320 (poly2d)
    max-y: <number>   # -64 to 320 (poly2d)
    min: {x: <number>, y: <number>, z: <number>}  # cuboid
    max: {x: <number>, y: <number>, z: <number>}  # cuboid
    points:           # poly2d
      - {x: <number>, z: <number>}
      - ...
    flags:
      greeting: <string>      # e.g., "§2Entering §7Cherrybrook village"
      farewell: <string>      # e.g., "§6Leaving §7Cherrybrook village"
      passthrough: allow
      # ... other flags
    priority: <number>        # typically 0 for main regions, 10 for hearts
    parent: <region_id>?      # optional, indicates subregion relationship
    members: {}
    owners: {}
```

**Key fields for classification**:
- `id`: Region identifier (used as canonical ID)
- `flags.greeting`: Contains "village" for villages (used to determine `kind`)
- `parent`: Indicates subregion but doesn't determine kind
- Heart regions: IDs starting with `heart_of_`
- All regions use consistent multi-line `flags:` format

**YAML formatting**: 2-space indentation throughout

## Import Workflow (GUI)

### Inputs
- Overworld regions export (Region Forge format)
- Optional nether regions export

### Steps
1. User selects a **Server Profile** (create if new).
2. User imports overworld file.
3. User optionally imports nether file.
4. System:
   - parses YAML structure (validate format, handle errors)
   - extracts region IDs and flags
   - canonicalizes ids (lowercase, preserve snake_case structure)
   - creates `RegionRecord[]` entries
   - applies classification rules (see Classification & Defaults)
   - stores sources metadata + internal model

### Constraints
- Canonicalize ids (lowercase, preserve snake_case). Region Forge exports are typically already in snake_case.
- De-duplicate by `(world,id)`; last import wins for structural data.
- Both overworld and nether files use the same format structure.

---

## Build Workflow (GUI)

### User Inputs
- Path to existing `ConditionalEvents/config.yml`
- Path to existing `AdvancedAchievements/config.yml`
- Output directory (or use last-used)

### Output
- Full generated config files:
  - `ConditionalEvents/config.yml`
  - `AdvancedAchievements/config.yml`
- Build report:
  - timestamp/build id
  - region counts per world/kind
  - warnings/errors
  - diff summaries

### Diff Gate
Hard requirement for v1:
- If output differs outside owned sections, the build fails and shows why.

Implementation strategy:
- Compare parsed objects with owned nodes removed from both sides (or compute a structural “expected preserved equals actual preserved” assertion).

---

## UI Screens (v1)
1. **Server Profiles**
   - list/create/select
2. **Imports**
   - import overworld/nether
   - show counts: total, hearts, system, first_join target present?
3. **Onboarding**
   - set teleport location (fields + “paste location string” convenience)
   - select start region id from dropdown
4. **Build**
   - pick input configs
   - choose output directory
   - run build
   - show report + diffs

---

## File Storage Layout (v1)
Local app data directory:

```
data/
  servers/
    <serverId>/
      profile.json
      sources/
        overworld.yml
        nether.yml
      builds/
        <buildId>/
          conditionalevents-config.yml
          advancedachievements-config.yml
          report.json
```

---

## IPC Contract (Renderer ↔ Main)
Minimal APIs:

- `listServers(): ServerSummary[]`
- `createServer(name: string): ServerProfile`
- `getServer(serverId: string): ServerProfile`
- `importRegions(serverId: string, world: "overworld"|"nether", filePath: string): ImportResult`
- `updateOnboarding(serverId: string, onboarding: ServerProfile["onboarding"]): ServerProfile`
- `buildConfigs(serverId: string, inputs: { cePath: string; aaPath: string; outDir: string }): BuildResult`
- `readBuildReport(serverId: string, buildId: string): BuildReport`

---

## Validation Rules (v1)
- On import:
  - unique ids per world
  - required regions for onboarding exist (`startRegionId`)
- On build:
  - AA config has `Commands` (or can be inserted)
  - AA config contains required `Custom.*` counter categories referenced by recipes (warn or fail; default warn)
  - CE config contains `Events` map (create if missing)
  - YAML parse errors are fatal with clear messaging

---

## Milestones
### M1 — GUI skeleton + Server storage
- profiles list/create/select
- profile.json persistence

### M2 — Region import + onboarding editing
- import overworld/nether
- classification + defaults
- onboarding editor

### M3 — AA generator + merge
- generate `Commands` section
- replace in existing AA config
- output file + diff view

### M4 — CE generator + merge
- generate `*_discover_once`, `region_heart_discover_once`, `first_join`
- merge into existing CE config
- output file + diff view

### M5 — Diff gate + build reports
- ensure only owned sections change
- persist build history

---

## Format Details

### YAML Output Formatting
- **Indentation**: 2 spaces (consistent with plugin configs)
- **String quoting**: Single quotes for action strings in CE (e.g., `'wait: 5'`)
- **Key ordering**: Alphabetical for owned sections (deterministic builds)
- **Preservation**: Maintain original formatting for non-owned sections where possible

### AA Commands Structure
Each command achievement follows this structure:
```yaml
Commands:
  <commandId>:
    1:
      Goal: "<commandId>"
      Message: "You discovered <DisplayName>!"
      Name: "<commandId>"
      DisplayName: "<DisplayName>"
      Type: "normal"
```

### ConditionalEvents Actions Format
- Actions are strings in a list
- Format: `'<action_type>: <value>'` (single-quoted)
- Types: `wait`, `console_command`, `message`, `teleport` (if supported)
- Example: `'console_command: aach give discoverWarriotos %player%'`

## Open Decisions (implementation details)
- Import error handling: Fail fast vs partial import (TBD)
- Build input validation: Create missing sections vs fail (TBD)
- Build report structure: Detailed diff vs summary (TBD)
- File path handling: Absolute vs relative resolution (TBD)
- IPC error handling: Structured errors vs exceptions (TBD)
- Teleport default values: Omit yaw/pitch vs default to 0 (TBD)
