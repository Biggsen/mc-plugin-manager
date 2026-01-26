# TAB Plugin Integration — Specification

## Purpose
Extend the MC Plugin Manager to generate **TAB plugin configuration files** (`config.yml`) by dynamically creating header/footer content, scoreboard sections, and top explorer leaderboard conditions based on server region data.

This extends the existing build workflow alongside AdvancedAchievements and ConditionalEvents config generation.

## Scope
Generate and merge *owned* sections for:
- **TAB** (`config.yml`)

The tool will compute discovery counts from region data and generate:
1. **Header/Footer** sections with server name and top explorers display
2. **Scoreboard** sections (overworld/nether/end) - conditionally generated only when regions exist in those worlds
3. **Top Explorers Conditions** - leaderboard display conditions with computed total region counts

All other TAB plugin settings remain preserved from the base template.

---

## Core Principles
1. **Computed Discovery Counts**: All discovery totals are computed from region data (regions, villages, hearts by world)
2. **Conditional Generation**: Scoreboard sections are only generated for worlds that have regions
3. **Surgical Ownership**: Only touch owned config sections; preserve everything else verbatim
4. **Deterministic Output**: Stable ordering and consistent formatting to minimize diffs

---

## Owned Sections Strategy

### TAB (`config.yml`)

**Owned**:
- `header-footer.header` - Server name line (customized from profile)
- `header-footer.footer` - Top explorers section (generated conditions)
- `scoreboard.scoreboards.*` - World-specific scoreboards (conditional generation)
- `conditions.top-explorers-title` - Visibility check for top explorers
- `conditions.top-explorer-1` through `top-explorer-5` - Leaderboard display conditions

**Preserved** (Static Template Content):
- `conditions.region-name` - WorldGuard region detection logic
- `conditions.village-name` - Village detection logic
- `conditions.heart-region` - Heart region name formatting
- All other TAB plugin settings (permissions, MySQL, proxy-support, layout, etc.)

**Merge Rules**:
1. Parse YAML into object (preserve structure, 2-space indentation)
2. Replace owned sections with generated content
3. Preserve all non-owned sections in original positions
4. Sort scoreboard keys deterministically (overworld, nether, end)

---

## Generation Details

### 1) Header/Footer Customization

#### Header Section
Generate header with server name from `ServerProfile.name`:

```yaml
header-footer:
  enabled: true
  header:
    - "<#FFFFFF>&m                                                </#FFFF00>"
    - "&3&l<SERVER_NAME>"  # Generated from profile.name
    - "&r&7&l>> %animation:Welcome%&3 &l%player%&7&l! &7&l<<"
    - "&r&7Online players: &f%online%"
    - ""
```

**Note**: Server name should match the format used in other generated configs (e.g., "Charidh Server" becomes `&3&lCharidh Server`)

#### Footer Section
Generate footer with top explorers section referencing generated conditions:

```yaml
  footer:
    - ""
    - "&d%condition:top-explorers-title%"
    - "&b%condition:top-explorer-1%"
    - "&b%condition:top-explorer-2%"
    - "&b%condition:top-explorer-3%"
    - "&b%condition:top-explorer-4%"
    - "&b%condition:top-explorer-5%"
    - ""
    - "<#FFFFFF>&m                                                </#FFFF00>"
```

---

### 2) Scoreboard Sections (Conditional Generation)

Generate scoreboard sections **only** for worlds that have regions.

#### Scoreboard Overworld
Generated only if `overworld` regions exist:

```yaml
scoreboard:
  enabled: true
  toggle-command: /sb
  remember-toggle-choice: false
  hidden-by-default: false
  use-numbers: true
  static-number: 0
  delay-on-join-milliseconds: 0
  scoreboards:
    scoreboard-overworld:
      title: "<#E0B11E><SERVER_NAME></#FF0000>"  # Generated
      display-condition: "%player-version-id%>=765;%bedrock%=false;%world%=world"
      lines:
        - "%animation:MyAnimation1%"
        - "&bRegions"
        - "* &eCurrent&7:||%condition:region-name%"
        - "* &eDiscovered&7:||%aach_custom_regions_discovered%/<OVERWORLD_REGIONS_COUNT>"  # Computed
        - ""
        - "&bVillages"
        - "* &eCurrent&7:||%condition:village-name%"
        - "* &eDiscovered&7:||%aach_custom_villages_discovered%/<VILLAGES_COUNT>"  # Computed
        - ""
        - "&bRegion Hearts"
        - "* &eDiscovered&7:||%aach_custom_hearts_discovered%/<OVERWORLD_HEARTS_COUNT>"  # Computed
```

**Computation**:
- `<OVERWORLD_REGIONS_COUNT>` = Count of regions where `world='overworld'` AND `kind='region'` AND `discover.method != 'disabled'`
- `<VILLAGES_COUNT>` = Count of regions where `kind='village'` AND `discover.method != 'disabled'`
- `<OVERWORLD_HEARTS_COUNT>` = Count of regions where `world='overworld'` AND `kind='heart'` AND `discover.method != 'disabled'`

#### Scoreboard Nether
Generated only if `nether` regions exist:

```yaml
    scoreboard-nether:
      title: "<#E0B11E><SERVER_NAME></#FF0000>"  # Generated
      display-condition: "%player-version-id%>=765;%bedrock%=false;%world%=world_nether"
      lines:
        - "%animation:MyAnimation1%"
        - "&bNether Regions"
        - "* &eCurrent&7:||%condition:region-name%"
        - "* &eDiscovered&7:||%aach_custom_nether_regions_discovered%/<NETHER_REGIONS_COUNT>"  # Computed
        - ""
        - "&bNether Region Hearts"
        - "* &eDiscovered&7:||%aach_custom_nether_hearts_discovered%/<NETHER_HEARTS_COUNT>"  # Computed
```

**Computation**:
- `<NETHER_REGIONS_COUNT>` = Count of regions where `world='nether'` AND `kind='region'` AND `discover.method != 'disabled'`
- `<NETHER_HEARTS_COUNT>` = Count of regions where `world='nether'` AND `kind='heart'` AND `discover.method != 'disabled'`

#### Scoreboard End (Future)
Generated only if `end` regions exist (when end world support is added):

```yaml
    scoreboard-end:
      title: "<#E0B11E><SERVER_NAME></#FF0000>"
      display-condition: "%player-version-id%>=765;%bedrock%=false;%world%=world_the_end"
      lines:
        - "%animation:MyAnimation1%"
        - "&bEnd Regions"
        - "* &eCurrent&7:||%condition:region-name%"
        - "* &eDiscovered&7:||%aach_custom_end_regions_discovered%/<END_REGIONS_COUNT>"
        - ""
        - "&bEnd Region Hearts"
        - "* &eDiscovered&7:||%aach_custom_end_hearts_discovered%/<END_HEARTS_COUNT>"
```

---

### 3) Top Explorers Conditions

Generate **all 6 conditions** with computed total region count.

#### Total Region Count Computation
- Count all regions where `discover.method != 'disabled'`
- This includes: overworld regions, nether regions, villages, hearts (all worlds)
- Example: 30 overworld regions + 59 villages + 12 nether regions = 89 total

#### Condition Templates

```yaml
conditions:
  top-explorers-title:
    conditions:
      - '%ajlb_lb_aach_custom_total_discovered_1_alltime_name%!='
    yes: 'TOP EXPLORERS'
    no: ''
  
  top-explorer-1:
    conditions:
      - '%ajlb_lb_aach_custom_total_discovered_1_alltime_name%!='
    yes: '1. %ajlb_lb_aach_custom_total_discovered_1_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_1_alltime_value}/<TOTAL_COUNT>*100,0)%%'
    no: ''
  
  top-explorer-2:
    conditions:
      - '%ajlb_lb_aach_custom_total_discovered_2_alltime_name%!=---'
    yes: '2. %ajlb_lb_aach_custom_total_discovered_2_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_2_alltime_value}/<TOTAL_COUNT>*100,0)%%'
    no: ''
  
  top-explorer-3:
    conditions:
      - '%ajlb_lb_aach_custom_total_discovered_3_alltime_name%!=---'
    yes: '3. %ajlb_lb_aach_custom_total_discovered_3_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_3_alltime_value}/<TOTAL_COUNT>*100,0)%%'
    no: ''
  
  top-explorer-4:
    conditions:
      - '%ajlb_lb_aach_custom_total_discovered_4_alltime_name%!=---'
    yes: '4. %ajlb_lb_aach_custom_total_discovered_4_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_4_alltime_value}/<TOTAL_COUNT>*100,0)%%'
    no: ''
  
  top-explorer-5:
    conditions:
      - '%ajlb_lb_aach_custom_total_discovered_5_alltime_name%!=---'
    yes: '5. %ajlb_lb_aach_custom_total_discovered_5_alltime_name% - %math_0_round({ajlb_lb_aach_custom_total_discovered_5_alltime_value}/<TOTAL_COUNT>*100,0)%%'
    no: ''
```

**Computation**:
- `<TOTAL_COUNT>` = Total count of all regions where `discover.method != 'disabled'`

**Placeholder Pattern**:
- Uses `%ajlb_lb_aach_custom_total_discovered_{N}_alltime_name%` for player names
- Uses `%ajlb_lb_aach_custom_total_discovered_{N}_alltime_value%` for discovery counts
- Formula: `{value}/<TOTAL_COUNT>*100` rounded to 0 decimal places (percentage)

---

## Static Template Content (Preserved)

The following conditions use WorldGuard placeholders and contain no dynamic data. They should be **preserved from the base template**:

### Region Detection Conditions

```yaml
conditions:
  region-name:
    conditions:
      - '%worldguard_region_name_2%!='
    type: AND
    yes: '%capitalize_pascal-case-forced_{worldguard_region_name_2}%'
    no:  '%capitalize_pascal-case-forced_{worldguard_region_name_1}%'
  
  village-name:
    conditions:
      - '%worldguard_region_name_2%!='
      - '%worldguard_region_name_1%!=%worldguard_region_name_2%'
      - '%worldguard_region_name_1%!=spawn'
    type: AND
    yes: '%condition:heart-region%'
    no:  '-'
  
  heart-region:
    conditions:
      - '%worldguard_region_name_1%|-heart'
    yes: '-'
    no: '%capitalize_pascal-case-forced_{worldguard_region_name_1}%'
```

**Note**: These conditions are static logic using WorldGuard placeholders and do not reference specific region IDs. They should be merged from the base template or preserved if already present.

---

## Computation Requirements

### Region Count Functions

The generator must compute the following counts from `ServerProfile.regions`:

```typescript
interface RegionCounts {
  // By world and kind
  overworldRegions: number;  // world='overworld', kind='region', discover.method != 'disabled'
  overworldHearts: number;   // world='overworld', kind='heart', discover.method != 'disabled'
  netherRegions: number;     // world='nether', kind='region', discover.method != 'disabled'
  netherHearts: number;      // world='nether', kind='heart', discover.method != 'disabled'
  
  // By kind (all worlds)
  villages: number;          // kind='village', discover.method != 'disabled'
  
  // Total (all non-disabled)
  total: number;             // discover.method != 'disabled' (all kinds, all worlds)
}
```

---

## Build Workflow Integration

### Extended Build Inputs

Update the build handler to accept `tabPath`:

```typescript
inputs: {
  cePath: string;
  aaPath: string;
  tabPath: string;  // New
  outDir: string;
}
```

### Build Process

1. **Validate input**: `tabPath` is optional (like `cePath` and `aaPath`)
2. **If `tabPath` provided**:
   - Validate file exists
   - Compute region counts
   - Generate owned sections
   - Merge into TAB config
   - Validate diff (diff gate)
   - Generate filename: `${serverNameSanitized}-tab-config.yml`
   - Write to output directory and build directory
3. **Update build report**:
   - Add `tab: true/false` to `generated` section
   - Include computed counts in report

### Build Report Extension

```typescript
{
  buildId: string;
  timestamp: string;
  regionCounts: {
    overworld: number;
    nether: number;
    hearts: number;
    villages: number;
    regions: number;
    system: number;
  };
  computedCounts: {  // New section for TAB
    overworldRegions: number;
    overworldHearts: number;
    netherRegions: number;
    netherHearts: number;
    villages: number;
    total: number;
  };
  generated: {
    aa: boolean;
    ce: boolean;
    tab: boolean;  // New
  };
  warnings: string[];
  errors: string[];
}
```

---

## File Generation

### Output Filename Pattern
- Pattern: `${serverNameSanitized}-tab-config.yml`
- Example: `charidh-tab-config.yml`
- Server name sanitization: `profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')`

### Output Locations
1. **Output directory** (user-specified)
2. **Build directory** (for build history): `data/servers/<serverId>/builds/<buildId>/`

---

## UI Integration

### BuildScreen Updates

Add TAB config file selection:

```typescript
const [tabPath, setTabPath] = useState('')

async function handleSelectTABFile() {
  const path = await window.electronAPI.showConfigFileDialog(
    'Select TAB config.yml',
    tabPath || undefined
  )
  if (path) {
    setTabPath(path)
  }
}
```

### Build Validation

Update validation to accept at least one of AA, CE, or TAB:

```typescript
if (!inputs.aaPath && !inputs.cePath && !inputs.tabPath) {
  return {
    success: false,
    error: 'At least one config file (AA, CE, or TAB) must be provided',
  }
}
```

---

## Diff Gate Validation

### TAB Diff Validation

Similar to AA/CE validation:

```typescript
export function validateTABDiff(
  originalPath: string,
  generatedContent: string
): { valid: boolean; error?: string; differences?: string[] } {
  // Parse both configs
  // Remove owned sections from both
  // Compare preserved sections
  // Return validation result
}
```

**Validation Rules**:
- Only owned sections should differ
- Static conditions (region-name, village-name, heart-region) must match exactly
- All other TAB plugin settings must be preserved

---

## Implementation Checklist

### Phase 1: Core Generator
- [x] Create `tabGenerator.ts` with computation functions
- [x] Implement region count calculations
- [x] Generate header/footer sections
- [x] Generate scoreboard sections (conditional by world)
- [x] Generate top explorers conditions

### Phase 2: Merge & Validation
- [x] Implement `mergeTABConfig()` function
- [x] Preserve static conditions from template
- [x] Implement `validateTABDiff()` function
- [x] Add diff gate validation to build workflow

### Phase 3: Build Integration
- [x] Update IPC build handler to accept `tabPath`
- [x] Add TAB generation to build process
- [x] Update build report structure
- [x] Generate output files with correct naming

### Phase 4: UI Updates
- [x] Add TAB file selector to BuildScreen
- [x] Update build validation logic
- [x] Display TAB generation status in build report
- [x] Show computed counts in build report

### Phase 5: Testing
- [x] Test with overworld-only regions
- [x] Test with overworld + nether regions
- [x] Test with villages and hearts
- [x] Test diff validation with various template configs
- [x] Verify static conditions are preserved

---

## Format Details

### YAML Output Formatting
- **Indentation**: 2 spaces (consistent with TAB plugin configs)
- **Key ordering**: Deterministic ordering for owned sections
  - Scoreboards: `scoreboard-overworld`, `scoreboard-nether`, `scoreboard-end` (alphabetical)
  - Conditions: `top-explorers-title`, `top-explorer-1` through `top-explorer-5` (numerical)
- **Preservation**: Maintain original formatting for non-owned sections where possible

### Server Name Formatting
- Use exact server name from `ServerProfile.name`
- No additional formatting (e.g., "Charidh Server" remains "Charidh Server")
- Color codes in header: `&3&l<SERVER_NAME>`

---

## Edge Cases

### No Regions
- If total region count is 0, top explorers conditions should still be generated (will show empty leaderboard)
- No scoreboard sections should be generated

### Single World
- If only overworld exists, only `scoreboard-overworld` is generated
- If only nether exists, only `scoreboard-nether` is generated

### No Villages or Hearts
- If no villages exist, villages line in overworld scoreboard should still show (with `/0`)
- If no hearts exist, hearts line should still show (with `/0`)
- Same logic applies to nether hearts

### Missing Static Conditions
- If base template doesn't include `region-name`, `village-name`, or `heart-region` conditions, they should be added from reference template

---

## Reference Files

### Base Template
- `reference/plugin config files/defaults/tab-config.yml`

### Server-Specific Example
- `reference/plugin config files/charidh-server/charidh-tab-config.yml`

These files demonstrate:
- Static conditions structure (region-name, village-name, heart-region)
- Scoreboard formatting
- Top explorers conditions pattern
- Header/footer customization

---

## Open Decisions

- Server name formatting: Exact match vs. title case conversion (decision: use exact from profile)
- Empty leaderboard handling: Show "TOP EXPLORERS" header even with 0 regions? (decision: yes, generate all conditions)
- Static conditions source: Merge from base template vs. hardcode? (decision: preserve from input template, merge from reference if missing)
- Scoreboard animation placeholder: Should `%animation:MyAnimation1%` be configurable? (decision: hardcode for v1)
