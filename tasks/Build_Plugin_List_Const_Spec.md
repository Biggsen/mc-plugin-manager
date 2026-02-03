# Build Plugin List — Single Source of Truth (Const) Specification

## Purpose

Refactor the Build screen and related code so that the list of build plugins (AdvancedAchievements, CommandWhitelist, ConditionalEvents, LevelledMobs, MyCommand, TAB) is defined once in a constant and used everywhere: checkbox list, validation, build payload, path overrides, and build report. This reduces duplication, keeps order and labels consistent (e.g. A–Z), and makes adding or removing a plugin a single-point change.

## Scope

- **In scope**: `src/screens/BuildScreen.tsx` (plugin list const, state shape, checkbox list, validation, payload building, overrides section, build report “Generated” and “Config sources”). Optionally a small shared module (e.g. `src/constants/buildPlugins.ts`) if the const is used elsewhere later.
- **Out of scope**: Changing the IPC contract (`generateAA`, `aaPath`, etc.) or the electron main process logic; the backend continues to receive the same payload shape. Changing `electron/ipc.ts` or `electron/preload.ts` only if we introduce a shared plugin list that both frontend and electron consume (optional).

## Current State

- Six plugins are hardcoded in multiple places in `BuildScreen.tsx`:
  - Checkbox list: six separate `<label>` blocks with `generateX` / `setGenerateX` and display names.
  - Validation: `!generateAA && !generateCE && !generateTAB && !generateLM && !generateMC && !generateCW`.
  - Build payload: explicit `generateAA`, `generateCE`, … and `...(generateAA && aaPath ? { aaPath } : {})`, etc.
  - Overrides visibility: same six booleans OR’d together.
  - Overrides section: six nearly identical blocks (label, input, browse button, hint) differing only by plugin id, display label, dialog title, and state keys.
  - Build report “Generated”: six conditional lines with “✓ PluginName” and “ • ” separators.
  - Build report “Config sources”: six conditional blocks for `configSources.aa`, `.ce`, `.tab`, `.lm`, `.mc`, `.cw`.
- Twelve `useState` calls: six for `generateX`, six for `xPath`.
- Six separate file-picker handlers: `handleSelectAAFile`, `handleSelectCEFile`, etc., differing only by dialog title and which path setter is called.

## Proposed Solution

### 1) Plugin list constant

Define a single ordered list of build plugins (e.g. A–Z by display name). Each entry includes:

- **id**: string union used in state (e.g. `'aa' | 'ce' | 'tab' | 'lm' | 'mc' | 'cw'`).
- **label**: display name in UI (e.g. `"AdvancedAchievements"`, `"CommandWhitelist"`).
- **overrideLabel**: short label for the override section (e.g. `"AdvancedAchievements config.yml (optional override)"`).
- **dialogTitle**: title for the file picker (e.g. `"Select AdvancedAchievements config.yml"`).
- **generateKey**: payload key for the backend (e.g. `"generateAA"`). Required because casing is not derivable from id (`aa` → `generateAA`, `tab` → `generateTAB`).
- **pathKey**: payload key for override path (e.g. `"aaPath"`).

**Location**: Top of `BuildScreen.tsx` or a small module e.g. `src/constants/buildPlugins.ts` (or `src/config/buildPlugins.ts`). If only `BuildScreen` uses it, in-file const is enough; if we later share with electron or other screens, extract to a shared module.

**Example shape** (conceptual):

```ts
const BUILD_PLUGINS = [
  { id: 'aa', label: 'AdvancedAchievements', overrideLabel: 'AdvancedAchievements config.yml (optional override)', dialogTitle: 'Select AdvancedAchievements config.yml', generateKey: 'generateAA', pathKey: 'aaPath' },
  { id: 'cw', label: 'CommandWhitelist', overrideLabel: 'CommandWhitelist config.yml (optional override)', dialogTitle: 'Select CommandWhitelist config.yml', generateKey: 'generateCW', pathKey: 'cwPath' },
  // ... ce, lm, mc, tab — sorted A–Z by label; each has generateKey and pathKey matching IPC contract
] as const
```

Type for `id`: derive `BuildPluginId` from `typeof BUILD_PLUGINS[number]['id']` for use in state and payload building.

### 2) State shape (choose one)

- **Option A — Single state object (recommended)**  
  One state: `pluginOptions: Record<BuildPluginId, { generate: boolean; path: string }>`, initialized so every plugin has `{ generate: false, path: '' }`.  
  - Pros: One place to add a new plugin (const + initial state). Payload and UI both iterate the const.  
  - Cons: Requires updating all reads/writes from `generateAA`/`aaPath` to `pluginOptions.aa.generate` / `pluginOptions.aa.path`, and setters that update by id.

- **Option B — Keep 12 useStates**  
  Keep `generateAA`, `aaPath`, … but derive “list of plugins” from `BUILD_PLUGINS` and use a helper or small lookup to get/set by id (e.g. a function or object that maps id → current value and setter).  
  - Pros: Smaller change, no big state refactor.  
  - Cons: Still 12 useStates to add when adding a plugin; payload building and report display can still be driven by the const.

Spec recommends **Option A** for a single source of truth; Option B is acceptable if we want minimal state change.

### 3) Checkbox list

- Render checkboxes by mapping over `BUILD_PLUGINS`.
- For each plugin, `checked={pluginOptions[p.id].generate}`, `onChange` updates `pluginOptions[p.id].generate`, `span` shows `p.label`.
- Order is defined only in `BUILD_PLUGINS` (A–Z).

### 4) Validation

- Replace the long “at least one” condition with:  
  `BUILD_PLUGINS.some(p => pluginOptions[p.id].generate)` (Option A) or equivalent using current state (Option B).

### 5) Build payload

- Build the object passed to `window.electronAPI.buildConfigs(server.id, { ... })` by iterating `BUILD_PLUGINS`:
  - Set `[p.generateKey]` (e.g. `generateAA`) from `pluginOptions[p.id].generate` (or current state for Option B).
  - When `pluginOptions[p.id].generate` is true and `pluginOptions[p.id].path` is non-empty, set `[p.pathKey]` (e.g. `aaPath`).
- Final payload has the same shape the IPC expects (`generateAA`, `aaPath`, etc.); construction is data-driven using each plugin’s `generateKey` and `pathKey`.

### 6) Path overrides section

- **Visibility**: `BUILD_PLUGINS.some(p => pluginOptions[p.id].generate)` (or Option B equivalent).
- **Content**: One reusable block; map over `BUILD_PLUGINS.filter(p => pluginOptions[p.id].generate)` and for each plugin render the same structure (label from `p.overrideLabel`, value from `pluginOptions[p.id].path`, browse button that calls a single handler with `p.id` and `p.dialogTitle`).

### 7) File picker handler(s)

- Replace the six `handleSelectXFile` functions with one: e.g. `handleSelectPluginFile(id: BuildPluginId)` that:
  - Gets `dialogTitle` from `BUILD_PLUGINS.find(p => p.id === id).dialogTitle`.
  - Calls `window.electronAPI.showConfigFileDialog(dialogTitle, pluginOptions[id].path || undefined)`.
  - On result, updates `pluginOptions[id].path` (or the corresponding path setter in Option B).

### 8) Build report — “Generated” line

- Replace the six conditional lines with one data-driven line, e.g.:  
  `BUILD_PLUGINS.filter(p => buildReport.generated[p.id]).map(p => '✓ ' + p.label).join(' • ')`  
  (or filter then map then join with “ • ”). Handle empty list if needed (e.g. show “None” or hide section).

### 9) Build report — “Config sources”

- Replace the six conditional blocks with a single map over `BUILD_PLUGINS`: for each `p`, if `buildReport.configSources?.[p.id]` exists, render one row with `<strong>{p.label}:</strong>` and the same “Bundled default” vs path display as today.

## Implementation Details

### Const definition and type

- Add `BUILD_PLUGINS` (and, if extracted to a module, export it).
- Define or export `BuildPluginId` so the rest of the app can type state and payload keys (e.g. `type BuildPluginId = typeof BUILD_PLUGINS[number]['id']`).
- Ensure order is A–Z by `label` so the UI matches the existing sorted list.

### Backward compatibility

- Build report shape from the server is unchanged (`generated: { aa, ce, tab, lm, mc, cw }`, `configSources: { aa?, ce?, ... }`). Old reports without a key (e.g. `cw` on older builds) should not break: use optional chaining and only render when `buildReport.generated[p.id]` or `buildReport.configSources?.[p.id]` is present.

### Testing / verification

- Manually: Select each plugin, run build, confirm payload and report match. Add/remove a plugin from the const (and state init) and confirm UI and build still work.
- No change to IPC or electron main logic is required for the minimal refactor; existing e2e or manual build flows remain valid.

## Implementation Order

1. Add `BUILD_PLUGINS` (and `BuildPluginId` if desired) in `BuildScreen.tsx` or shared module.
2. (Option A) Replace 12 useStates with single `pluginOptions` state and initializer; (Option B) keep useStates and add a helper to get/set by id.
3. Refactor checkbox list to `.map()` over `BUILD_PLUGINS`.
4. Refactor validation and overrides visibility to use `BUILD_PLUGINS.some(...)`.
5. Refactor build payload construction to loop over `BUILD_PLUGINS`.
6. Replace six file-picker handlers with `handleSelectPluginFile(id)` and refactor overrides section to a single `.map()` over selected plugins.
7. Refactor build report “Generated” and “Config sources” to iterate `BUILD_PLUGINS`.

## Out of Scope (for this spec)

- Changing IPC handler or preload to accept a generic “plugin list” payload; the API remains `generateAA`, `aaPath`, etc.
- Sharing `BUILD_PLUGINS` with `electron/ipc.ts` (e.g. for `resolveConfigPath` type or filename map) — can be a follow-up if we want one list for both frontend and main process.
- Adding or removing a specific plugin; this spec only introduces the const and refactors usage.

## Success Criteria

- One const defines plugin id, label, override label, and dialog title; order is A–Z by label.
- Checkbox list, validation, build payload, overrides section, and build report “Generated” and “Config sources” all derive from that const (no hardcoded duplicate list).
- Adding a new plugin requires: adding one entry to the const (and to initial state in Option A), and no other changes in `BuildScreen.tsx` for list order, validation, payload, overrides, or report display.
- Existing build and report behavior is preserved; no change to IPC contract or electron main logic for the minimal refactor.
