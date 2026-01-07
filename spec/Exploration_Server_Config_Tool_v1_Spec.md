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
Applied after import:
- `spawn` → `kind=system`, `discover.method=disabled`, `recipeId=none`
- `warriotos` → `discover.method=first_join`, `recipeId=region`
- `id startsWith heart_of_` → `kind=heart`, `discover.method=on_enter`, `recipeId=heart`
- Overworld non-heart:
  - default `kind=village` OR `kind=region` (choose one rule; recommended: `village` if your Region Forge export distinguishes them; otherwise default `region`)
  - `discover.method=on_enter`, `recipeId=region`
- Nether:
  - non-heart → `recipeId=nether_region`
  - heart → `recipeId=nether_heart`

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
1. Parse YAML into object.
2. Remove owned event keys from `Events`.
3. Insert regenerated owned keys into `Events`.
4. Preserve ordering where possible (sort owned keys deterministically).

### AdvancedAchievements (`config.yml`)
**Owned**
- `Commands` section entirely (`Commands.*`)

**Preserved**
- All other top-level and category sections (`Custom`, globals, etc.)

**Merge rules**
1. Parse YAML into object.
2. Replace `Commands` with regenerated `Commands`.
3. Leave everything else untouched.

---

## Naming Conventions (Deterministic)

### CE Event Key
- For discover-on-enter regions/hearts:
  - `<regionId>_discover_once`
- Global:
  - `region_heart_discover_once` (special rule, see below)
  - `first_join` (special rule)

### AA Command ID generation
- Default:
  - Region: `discover` + PascalCase(regionId)
  - Heart: `discover` + PascalCase(regionId) (or `discoverHeartOf...` if you prefer; v1 should match your current practice)
- Override:
  - `RegionRecord.discover.commandIdOverride`

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
- Teleport to the stored location
- Award the starting region command achievement + region recipe rewards

Example template:

```yaml
first_join:
  type: player_join
  one_time: true
  actions:
    default:
      - "teleport: <world>;<x>;<y>;<z>;<yaw>;<pitch>"
      - "wait: 5"
      - "console_command: aach give <AA_START_COMMAND> %player%"
      - "console_command: aach add 1 Custom.regions_discovered %player%"
      - "console_command: aach add 1 Custom.total_discovered %player%"
      - "console_command: cc give virtual RegionCrate 1 %player%"
```

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

## Import Workflow (GUI)

### Inputs
- Overworld regions export (Region Forge format)
- Optional nether regions export

### Steps
1. User selects a **Server Profile** (create if new).
2. User imports overworld file.
3. User optionally imports nether file.
4. System:
   - parses regions into canonical `RegionRecord[]`
   - applies classification + defaults
   - stores sources metadata + internal model

### Constraints
- Canonicalize ids (lowercase, snake_case). If Region Forge export is already clean, only lowercase.
- De-duplicate by `(world,id)`; last import wins for structural data.

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

## Open Decisions (v1 defaults suggested)
- Heart AA command naming: match existing Charidh practice exactly (recommend: keep your current `discoverHeartOfX` pattern).
- Whether region kind distinguishes `village` vs `region`: keep simple until Region Forge exports provide an explicit type.
- Whether build warnings fail the build: default **warn** (fail only on parse/merge errors).
