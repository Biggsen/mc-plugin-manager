<!-- PROJECT-MANIFEST:START -->
```json
{
  "schemaVersion": 1,
  "projectId": "mc-plugin-manager",
  "name": "MC Plugin Manager",
  "repo": "",
  "visibility": "private",
  "status": "active",
  "domain": "minecraft",
  "type": "tool",
  "lastUpdated": "2026-01-17",
  "links": {
    "prod": null,
    "staging": null
  },
  "tags": ["electron", "react", "typescript", "minecraft", "desktop", "config-generator"]
}
```
<!-- PROJECT-MANIFEST:END -->

# MC Plugin Manager - Project Summary

<!-- 
  The manifest block above contains machine-readable metadata about the project.
  This block MUST be present at the top of the file and MUST be valid JSON.
  The parser extracts this block to populate the Project Atlas dashboard.
  
  Required fields:
  - schemaVersion: Always 1 for v1
  - projectId: Unique identifier (lowercase, hyphens)
  - name: Display name
  - repo: GitHub owner/repo-name
  - visibility: "public" | "staging" | "private"
  - status: "active" | "mvp" | "paused" | "archived"
  - domain: "music" | "minecraft" | "management" | "other" (field/area categorization)
  - type: "webapp" | "microservice" | "tool" | "cli" | "library" | "other" (technical architecture)
  - lastUpdated: ISO date string (YYYY-MM-DD)
  - links: Object with "prod" and "staging" (strings or null)
  - tags: Array of strings
-->

## Project Overview

**MC Plugin Manager** is a local desktop GUI application that compiles exploration-server experience data (primarily regions + onboarding) into fully-ready Minecraft plugin configuration files. The tool is optimized for fast, safe regeneration of large configs with deterministic output and minimal drift.

The application follows a compiler model: it stores intent internally (server profiles, region data, onboarding configs) and generates plugin configs from that intent. It uses a surgical ownership strategy, only touching explicitly owned config sections while preserving everything else verbatim.

### Key Features

- **Server Profile Management**: Create and manage multiple server profiles with independent configurations
- **Region Import**: Import WorldGuard region exports (overworld and nether) from Region Forge
- **Automatic Classification**: Automatically classifies regions as system, region, village, or heart based on naming and flags
- **Onboarding Configuration**: Configure first-join teleport location and starting region
- **Config Generation**: Generate AdvancedAchievements and ConditionalEvents plugin configs
- **Diff Validation**: Ensures only owned sections change, preventing accidental config drift
- **Build History**: Track all builds with detailed reports including region counts and warnings

---

## Tech Stack

- **Frontend**: React 18.2, TypeScript 5.3, Vite 5.0
- **Desktop Framework**: Electron 28.0
- **Backend**: Node.js (TypeScript) for core logic
- **Libraries**: 
  - `yaml` (2.3.4) - YAML parsing and generation
  - `zod` (3.22.4) - Schema validation
  - `fs-extra` (11.2.0) - File system utilities
- **Build Tools**: electron-builder, electron-packager
- **Deployment**: Local desktop application (Windows)

---

## Current Focus

Currently focused on **TAB Plugin Integration**. This involves extending the build workflow to generate TAB plugin configuration files (`config.yml`) by dynamically creating header/footer content, scoreboard sections, and top explorer leaderboard conditions based on server region data.

This work includes:
- Computing discovery counts from region data
- Generating header/footer sections with server name and top explorers display
- Conditionally generating scoreboard sections for overworld/nether/end worlds
- Creating top explorer leaderboard conditions with computed total region counts
- Implementing merge logic to preserve static template content

---

## Features (Done)

- [x] **M1: GUI Skeleton + Server Storage** - Server profile management with create/list/select functionality and persistent storage
- [x] **M2: Region Import + Onboarding Editing** - Import overworld/nether region files, automatic classification, onboarding editor with spawn center extraction
- [x] **M3: AA Generator + Merge** - Generate AdvancedAchievements `Commands` section, merge into existing config, output files and build reports
- [x] **M4: CE Generator + Merge** - Generate ConditionalEvents `*_discover_once`, `region_heart_discover_once`, and `first_join` events, merge into existing config
- [x] **M5: Diff Gate + Build Reports** - Validate that only owned sections change, persist build history, generate detailed build reports

### Detailed Completed Features

#### Server Profile Management
- Create, list, and select server profiles
- Persistent storage in local app data directory
- Server profile structure with regions, sources, onboarding, and build settings
- Status: Production ready

#### Region Import System
- Import WorldGuard region exports from Region Forge (YAML format)
- Support for overworld and nether regions
- Automatic region classification (system, region, village, heart)
- Spawn center extraction for onboarding defaults
- Source metadata tracking (filename, hash, import timestamp)
- Status: Production ready

#### AdvancedAchievements Config Generator
- Generate `Commands` section with achievement commands for all discoverable regions
- Deterministic command ID generation (PascalCase from region IDs)
- Support for region kinds: regular regions, villages, hearts, nether regions
- Merge into existing AA config while preserving all other sections
- Status: Production ready

#### ConditionalEvents Config Generator
- Generate `*_discover_once` events for all on-enter regions
- Generate `region_heart_discover_once` global event for heart discovery messaging
- Generate `first_join` event from onboarding configuration
- Merge into existing CE config while preserving all other sections
- Status: Production ready

#### Diff Validation System
- Validates that only owned sections change during build
- Compares parsed YAML structures with owned nodes removed
- Fails build if non-owned sections differ
- Provides clear error messages for validation failures
- Status: Production ready

#### Build Report System
- Detailed build reports with timestamp and build ID
- Region counts by world and kind (overworld, nether, hearts, villages, regions, system)
- Generated config flags (AA, CE)
- Warnings and errors tracking
- Build history persistence per server
- Status: Production ready

---

## Features (In Progress)

- [ ] **TAB Plugin Integration** - Generate TAB plugin config files with header/footer, scoreboards, and top explorer conditions (0% complete)

### Detailed In-Progress Features

#### TAB Plugin Integration
- **Current status**: Specification complete, implementation not started
- **Remaining work**: 
  - Create `tabGenerator.ts` with computation functions
  - Implement region count calculations
  - Generate header/footer sections
  - Generate conditional scoreboard sections
  - Generate top explorers conditions
  - Implement merge and validation logic
  - Update build workflow and UI
- **Estimated completion**: TBD

---

## Enhancements

- [ ] **End World Support** - Add support for end world regions in addition to overworld and nether
- [ ] **Region Editor** - Allow manual editing of region classification and discovery settings
- [ ] **Config Preview** - Show diff preview before building
- [ ] **Batch Operations** - Support building multiple server profiles at once
- [ ] **Export/Import Server Profiles** - Share server profiles between installations
- [ ] **Template Management** - Manage and version control base config templates

### High Priority Enhancements

- **Region Editor**: Currently regions are auto-classified on import. Adding a UI to manually adjust classification, discovery methods, and overrides would improve flexibility.
- **Config Preview**: Showing a diff preview before building would help users understand what will change.

### Medium Priority Enhancements

- **End World Support**: Extend region import and generation to support the end dimension.
- **Export/Import Server Profiles**: Enable sharing server configurations between team members or installations.

---

## Known Issues

### Active Bugs

- None currently documented

---

## Outstanding Tasks

### High Priority

- [ ] Implement TAB plugin generator (`tabGenerator.ts`)
- [ ] Add TAB file selector to BuildScreen UI
- [ ] Update build validation to accept TAB configs
- [ ] Test TAB generation with various region configurations

### Medium Priority

- [ ] Add unit tests for region classification logic
- [ ] Add integration tests for config generation
- [ ] Improve error messages for YAML parse failures
- [ ] Add validation for required AA counter categories

### Low Priority / Future

- [ ] Add support for additional plugin configs (beyond AA, CE, TAB)
- [ ] Implement config template versioning
- [ ] Add command-line interface for batch operations
- [ ] Create documentation for plugin config structure

---

## Project Status

**Overall Status**: Active Development  
**Completion**: ~85% (v1.0 complete, TAB integration in progress)  
**Last Major Update**: January 2026

### Metrics

- **Completed Milestones**: 5/5 (M1-M5)
- **Active Features**: 1 (TAB integration)
- **Completed Features**: 6 (Server profiles, Region import, AA generator, CE generator, Diff validation, Build reports)
- **Supported Plugins**: 2 (AdvancedAchievements, ConditionalEvents)
- **Target Plugins**: 3 (adding TAB)

---

## Next Steps

### Immediate (Next 1-2 weeks)

1. Implement TAB plugin generator core functionality
2. Add TAB config file selection to BuildScreen
3. Update build workflow to include TAB generation
4. Test TAB generation with reference configs

### Short-term (Next 1-3 months)

1. Complete TAB plugin integration
2. Add region editor UI for manual classification adjustments
3. Add config preview/diff view before building
4. Improve error handling and validation messages

### Long-term (3+ months)

1. Add end world support
2. Implement server profile export/import
3. Add support for additional Minecraft plugins
4. Create comprehensive documentation

---

## Notes

- **Architecture Decision**: Uses surgical ownership model - only owned config sections are modified, everything else is preserved verbatim. This prevents accidental config drift and allows safe regeneration.
- **Deterministic Builds**: All generated configs use stable ordering (alphabetical) and consistent formatting to minimize diffs between builds.
- **Local-First**: No cloud services required - all data stored locally in app data directory.
- **Compiler Model**: Stores intent (server profiles, regions) internally and generates configs from that intent, rather than editing configs directly.
- **Future Consideration**: The tool could be extended to support additional Minecraft plugins beyond AA, CE, and TAB. The architecture supports this through the owned sections strategy.

---

<!-- 
  END OF DOCUMENT
  
  This document follows the Project Atlas template structure.
  
  Key points:
  1. Manifest block MUST be at the top with valid JSON
  2. Four work item types are defined: Features, Enhancements, Bugs, Tasks
  3. Items are tagged by the section they appear in
  4. TODO items use - [ ] (incomplete) and - [x] (completed) format
  
  Work Item Types:
  - Features: New functionality (sections like "Features (Done)", "Features (In Progress)")
  - Enhancements: Improvements to existing features (section: "Enhancements")
  - Bugs: Problems to fix (sections like "Known Issues", "Active Bugs")
  - Tasks: Inbox for uncategorized work (section: "Outstanding Tasks")
-->
