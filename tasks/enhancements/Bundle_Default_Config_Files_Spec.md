# Bundle Default Config Files — Enhancement Specification

**Status: 📋 Proposed**

## Purpose

Bundle default template config files for AdvancedAchievements, ConditionalEvents, TAB, and LevelledMobs plugins directly within the application bundle. This eliminates the requirement for users to manually select existing config files on every build, improving UX and reducing friction.

## Problem Statement

### Current Workflow Issues

1. **Repetitive File Selection**: Users must select existing config files (`advancedachievements-config.yml`, `conditionalevents-config.yml`, TAB `config.yml` / `tab-config.yml`, and `levelledmobs-rules.yml`) for every build, even though these files need to conform to specific structural requirements for the generators to work correctly.

2. **Structural Dependencies**: The generators (`mergeAAConfig`, `mergeCEConfig`, `mergeTABConfig`, `mergeLMConfig`) require existing config files with specific sections:
   - **AA**: Must have a `Commands` section (will be completely replaced)
   - **CE**: Must have an `Events` section (owned events merged into it)
   - **TAB**: Must have `header-footer`, `scoreboard.scoreboards`, and `conditions`; generator replaces/merges owned sections (header, footer, scoreboards, top-explorer conditions) and adds `region-name`, `village-name`, `heart-region` if missing
   - **LM**: Must have a `custom-rules` array; generator merges owned rules (villages rule and region-band rules) while preserving non-owned rules

3. **User Confusion**: Users may not understand why they need to provide config files when the generators will replace/merge specific sections anyway.

4. **Maintenance Burden**: Users must maintain compatible template files externally, which creates an unnecessary dependency.

### Why Defaults Exist

The `reference/plugin config files/to be bundled/` directory contains properly structured default config files ready for bundling:
- `advancedachievements-config.yml` — Full AA config with `Commands` section placeholder
- `conditionalevents-config.yml` — Full CE config with `Events` section placeholder
- `tab-config.yml` — Full TAB config with `header-footer`, `scoreboard.scoreboards`, and `conditions`
- `levelledmobs-rules.yml` — Full LM config with `custom-rules` array structure

These files represent minimal viable templates that satisfy the generator's structural requirements.

## Proposed Solution

### Core Concept

Bundle default config templates as application assets. Use them automatically when users don't explicitly provide custom existing config files. Allow users to override with custom files when needed.

### Behavior Changes

1. **Plugin checkboxes (new)**: Users select which plugins to generate (AA, CE, TAB, LM). Checked = generate; unchecked = skip. Only checked plugins are built.

2. **Default vs override**: For each checked plugin, if no path is provided, use the bundled default. If a path is provided (file picker), use that custom file as the base. Path overrides default when provided.

3. **Build button**: Always enabled. Validation runs on submit: if no plugins are checked or `outDir` is not set, show validation feedback and do not invoke build. Invalid submission is not a disabled button — it's an error message.

4. **File selection**: Paths are optional per plugin. UI clearly indicates default vs custom (e.g. in build report via `configSources`).

## Implementation Details

### File Structure

```
electron/
  assets/
    templates/
      advancedachievements-config.yml    (copied from reference/to be bundled)
      conditionalevents-config.yml       (copied from reference/to be bundled)
      tab-config.yml                     (copied from reference/to be bundled)
      levelledmobs-rules.yml             (copied from reference/to be bundled)
```

**Alternative**: Store in `src/assets/templates/` if bundling through Vite is preferred.

### Packaging

1. **Pre-packager copy**: Add a build step that copies `reference/plugin config files/to be bundled/*` → `electron/assets/templates/` before packaging (e.g. `prepack` or `prebuild` script, or as part of `build:electron`). Ensure the four template files exist in `electron/assets/templates/` prior to running electron-packager.

2. **Verification**: Include verification in **build/packaging tests**. Automatically assert that the four template files exist in the packager output (and optionally that they are readable at the resolved `app.getAppPath()`-based path) before considering the build valid.

### Code Changes

#### 1. Asset Bundling

**Option A: Electron Assets (Recommended)**
- Copy default config files to `electron/assets/templates/`
- Reference via `app.getAppPath()` + relative path
- Files are included in build/dist-electron

**Option B: Vite Assets**
- Store in `src/assets/templates/`
- Use `import` to bundle (may require raw loader)
- Access via Electron IPC from renderer

**Recommendation**: Option A — simpler, files remain accessible at runtime without bundler complexity.

#### 2. Generator Interface Changes

**Current Signature**:
```typescript
mergeAAConfig(existingConfigPath: string, newCommands: AACommandsSection): string
mergeCEConfig(existingConfigPath: string, ownedEvents: CEEventsSection): string
mergeTABConfig(existingConfigPath: string, ...): string
mergeLMConfig(existingConfigPath: string, owned: OwnedLMRules): string
```

**Proposed**: No changes needed. Generators continue to accept file paths. Path resolution happens at caller level.

#### 3. Path Resolution Logic

**New Function**: `resolveConfigPath(type: 'aa' | 'ce' | 'tab' | 'lm', userProvidedPath?: string): string`  
**Requires**: `app` from `electron` (for `app.getAppPath()`). Ensure the module that defines `resolveConfigPath` (e.g. `ipc.ts`) imports `app` from `electron`.

```typescript
function resolveConfigPath(type: 'aa' | 'ce' | 'tab' | 'lm', userProvidedPath?: string): string {
  // If user provided path, validate and use it
  if (userProvidedPath && userProvidedPath.trim().length > 0) {
    if (!existsSync(userProvidedPath)) {
      throw new Error(`${type.toUpperCase()} config file not found: ${userProvidedPath}`)
    }
    return userProvidedPath
  }
  
  // Otherwise, use bundled default
  const appPath = app.getAppPath()
  const filename = type === 'aa' ? 'advancedachievements-config.yml'
    : type === 'ce' ? 'conditionalevents-config.yml'
    : type === 'tab' ? 'tab-config.yml'
    : 'levelledmobs-rules.yml'
  const defaultPath = path.join(appPath, 'electron', 'assets', 'templates', filename)
  
  if (!existsSync(defaultPath)) {
    throw new Error(`Bundled ${type.toUpperCase()} default config not found at: ${defaultPath}`)
  }
  
  return defaultPath
}
```

#### 4. IPC Handler Updates

**File**: `electron/ipc.ts` — `build-configs` handler

**Input validation**: Require at least one of `generateAA` / `generateCE` / `generateTAB` / `generateLM` true and `outDir` set. The UI validates on submit and does not invoke build when invalid; the IPC handler should also validate defensively and return a clear error if these preconditions fail.

**Build inputs**: Add `generateAA`, `generateCE`, `generateTAB`, `generateLM` (booleans). Keep `aaPath`, `cePath`, `tabPath`, `lmPath` as optional overrides. Only generate plugins that are checked; for those, use path when provided, else bundled default.

**Diff validation**: Diff validation (`validateAADiff`, `validateCEDiff`, `validateTABDiff`, `validateLMDiff`) still runs for each generated plugin. Use the **resolved** path (bundled default or custom) for both merge and validation. Do not special-case default vs custom.

**Current Flow**:
```typescript
if (inputs.aaPath && inputs.aaPath.trim().length > 0) {
  if (!existsSync(inputs.aaPath)) {
    return { success: false, error: `AA config file not found: ${inputs.aaPath}` }
  }
  const mergedAAContent = mergeAAConfig(inputs.aaPath, newCommands)
  // ... validate, write ...
}
```

**Updated Flow** (per-plugin: only run when plugin is checked; path overrides default when provided):
```typescript
// AA generation (when generateAA checked)
if (inputs.generateAA) {
  try {
    const aaConfigPath = resolveConfigPath('aa', inputs.aaPath)
    const mergedAAContent = mergeAAConfig(aaConfigPath, newCommands)
    const aaValidation = validateAADiff(aaConfigPath, mergedAAContent)
    if (!aaValidation.valid) {
      return { success: false, error: aaValidation.error || 'AA diff validation failed', buildId }
    }
    const usingDefaultAA = !inputs.aaPath || inputs.aaPath.trim().length === 0
    // ... write to outDir + build dir, push to configSources ...
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// CE, TAB, LM — same pattern: resolveConfigPath → merge → validateXxxDiff(resolvedPath, merged) → write → configSources
```

#### 5. Build Result Metadata

**Enhanced BuildResult**:
```typescript
interface BuildResult {
  success: boolean
  error?: string
  buildId?: string
  // ... existing fields
  configSources?: {
    aa?: { path: string; isDefault: boolean }
    ce?: { path: string; isDefault: boolean }
    tab?: { path: string; isDefault: boolean }
    lm?: { path: string; isDefault: boolean }
  }
}
```

**Drop `aaGenerated`, `ceGenerated`, `tabGenerated`, `lmGenerated`.** Use `configSources` as the single source of truth: a plugin was generated iff it appears in `configSources`. Build report and UI should derive "generated" from presence in `configSources`.

#### 6. UI Updates

**File**: `src/screens/BuildScreen.tsx`

**Split layout**:

1. **Top — Plugin checkboxes**: One checkbox per plugin (AA, CE, TAB, LM). Checked = generate that plugin; unchecked = skip it. Only checked plugins are included in the build.

2. **Bottom — Path overrides**: The existing path UI (file pickers). For each **checked** plugin, if a path is provided, use that custom file as the base; if no path, use the bundled default. Paths apply only to checked plugins; unchecked plugins ignore paths.

3. **Build button**: Always enabled (no disabled state). On submit, validate: if no plugins are checked, or `outDir` is not set, show a validation message (e.g. "Select at least one plugin", "Choose an output directory") and do not invoke the build IPC. Invalid submission = validation feedback only.

4. **Build Status Display**:
   - Show which config sources were used (default vs custom) in build result via `configSources`
   - Display paths clearly in build report

**Layout**:
```
[ ] AdvancedAchievements    [ ] ConditionalEvents    [ ] TAB    [ ] LevelledMobs
     (or vertical checkboxes per plugin)

--- Path overrides (existing file pickers) ---
AA:   [Browse...] [path display]
CE:   [Browse...] [path display]
TAB:  [Browse...] [path display]
LM:   [Browse...] [path display]

[Build]   (always enabled)
```

## Default Config File Content

### AdvancedAchievements Default

**Source**: `reference/plugin config files/to be bundled/advancedachievements-config.yml`

**Key Characteristics**:
- Full plugin config with all standard sections
- `Commands` section contains example placeholder (`yourAch1`)
- Generator will completely replace `Commands` section
- All other sections preserved (Custom counters, settings, etc.)

**Note**: The `Custom` section includes counters referenced by CE generator:
- `Custom.regions_discovered`
- `Custom.hearts_discovered`
- `Custom.nether_regions_discovered`
- `Custom.nether_hearts_discovered`
- `Custom.villages_discovered`
- `Custom.total_discovered`

### ConditionalEvents Default

**Source**: `reference/plugin config files/to be bundled/conditionalevents-config.yml`

**Key Characteristics**:
- Full plugin config with `Config`, `Messages`, and `Events` sections
- `Events` section contains example events (`event1` through `event7`)
- Generator will merge owned events (`first_join`, `region_heart_discover_once`, `*_discover_once`)
- Non-owned events preserved

### TAB Default

**Source**: `reference/plugin config files/to be bundled/tab-config.yml`

**Key Characteristics**:
- Full TAB plugin config with `header-footer`, `scoreboard` (including `scoreboards`), and `conditions`
- Generator replaces `header-footer.header` and `header-footer.footer` with server name and top explorers
- Generator replaces `scoreboard.scoreboards` with conditional overworld/nether/end scoreboards based on region data
- Generator adds `conditions.top-explorers-title` and `conditions.top-explorer-1` through `top-explorer-5` with computed total count
- If `region-name`, `village-name`, or `heart-region` are missing from `conditions`, generator adds them from the reference template (per TAB Plugin Integration Spec — "Missing Static Conditions")
- All other TAB settings (permissions, MySQL, proxy-support, layout, etc.) preserved

**Note**: The default may have a minimal `conditions` section (e.g. only `nick`). The generator merges in the static WorldGuard conditions and top-explorer conditions as needed.

### LevelledMobs Default

**Source**: `reference/plugin config files/to be bundled/levelledmobs-rules.yml`

**Key Characteristics**:
- Full LevelledMobs config with `custom-rules` array structure
- Generator merges owned rules (villages rule and region-band rules) into `custom-rules`
- Owned rules are identified by:
  - Villages rule: `worldguard-regions` is an array (multiple village IDs)
  - Region-band rules: `worldguard-regions` is a string (single region ID) AND `use-preset` matches pattern `lvlstrategy-(easy|normal|hard|severe|deadly)`
- Non-owned rules (any rule not matching the above patterns) are preserved
- Generator adds villages rule first (if present), then region-band rules (sorted by `custom-rule` name)

**Note**: The generator preserves all non-owned custom rules, so users can maintain their own custom LevelledMobs rules alongside generated ones.

## Risks & Mitigations

### Risk 1: Plugin Version Compatibility

**Risk**: If plugin authors change config format, bundled defaults may become incompatible.

**Mitigation**:
- Add version comment header to bundled files indicating target plugin version
- Document in UI which plugin versions are supported
- Provide clear error messages if config parsing fails (likely indicates version mismatch)
- Consider versioning bundled templates if major changes occur

**Action**: Add comment header to **bundled template** files only (in `reference/plugin config files/to be bundled/` or the copies in `electron/assets/templates/`). **Strip this header from generated output** — the files written to outDir / build dir (e.g. `{server}-advancedachievements-config.yml`) must not include it. Implement as part of this work; add headers to templates, and ensure the merge/output step removes them from generated files.

```yaml
# MC Plugin Manager - Bundled Default Template
# Target Plugin Version: AdvancedAchievements 6.x / ConditionalEvents x.x / TAB 4.x / LevelledMobs x.x
# Last Updated: 2024-XX-XX
# 
# This file serves as a template. The generator will replace/merge
# owned sections while preserving all other content.
```

### Risk 2: Custom Commands Lost (AA)

**Risk**: AA generator replaces entire `Commands` section. Users with custom commands in existing configs may lose them when switching to defaults.

**Mitigation**:
- This risk exists whether using defaults or custom files — generator always replaces `Commands`
- UI should clearly explain this behavior
- Users who need to preserve custom commands should:
  1. Use custom file option
  2. Manually merge their custom commands after generation (outside tool scope)
  
**Action**: Add help text in UI explaining that `Commands` section is always regenerated.

### Risk 3: Missing Custom Counters

**Risk**: If server has custom AA counters beyond the standard set, they may not exist in bundled default.

**Mitigation**:
- Bundled default includes all counters referenced by CE generator
- Users can add additional counters to bundled default after first use
- Better solution: Use custom file that already has their counters configured

**Action**: Document that users with extensive custom counters should use custom file option.

### Risk 4: User Confusion About Sources

**Risk**: Users may not realize they're using defaults vs custom files.

**Mitigation**:
- Clear UI indicators showing source type
- Build reports explicitly list config sources
- Default mode clearly labeled with helpful tooltips

### Risk 5: File Not Found at Runtime

**Risk**: Bundled files may not be accessible at runtime (packaging issues, path resolution).

**Mitigation**:
- Comprehensive error handling with clear messages
- Fallback validation during app startup (optional: verify bundled files exist)
- Use absolute paths resolved from `app.getAppPath()` for reliability
- Include verification in build/packaging tests

### Risk 6: TAB Default Minimal Structure

**Risk**: TAB bundled default is minimal; if TAB plugin changes its schema or owned-section layout, the bundled file may need updating.

**Mitigation**:
- Same as Risk 1: version comment in header, document supported TAB versions, clear errors on parse/merge failure
- Per TAB Plugin Integration Spec, generator adds static conditions (`region-name`, `village-name`, `heart-region`) from reference when missing, so the default need not include them

## Testing Strategy

### Unit Tests

1. **Path Resolution**:
   - Test `resolveConfigPath` with provided path (aa, ce, tab, lm)
   - Test `resolveConfigPath` without provided path (should use default for each type)
   - Test error handling for missing custom files
   - Test error handling for missing bundled defaults (including TAB and LM)

2. **Generator Integration**:
   - Verify generators work with bundled default paths (AA, CE, TAB, LM)
   - Verify generators work with custom paths (regression)
   - Verify merge behavior identical for both paths

### Integration Tests

1. **Build Flow**:
   - Build with one plugin checked (AA only, CE only, TAB only, LM only) using bundled defaults
   - Build with all four checked using bundled defaults
   - Build with custom files (regression)
   - Build with mixed (e.g. AA and CE checked + defaults, TAB and LM checked + custom paths)
   - Submit with no plugins checked → validation error, no IPC call
   - Submit with no outDir → validation error, no IPC call

2. **UI Flow**:
   - Toggle checkboxes; verify only checked plugins are generated
   - Path overrides: when checked, provide path → custom base; no path → default
   - Build button always enabled; invalid submit shows validation message
   - Verify build result displays `configSources` (path, isDefault) for each generated plugin

### Manual Testing Checklist

- [ ] Build with bundled defaults produces valid configs (AA, CE, TAB, LM)
- [ ] Build with TAB bundled default produces valid TAB config
- [ ] Build with LM bundled default produces valid LM config
- [ ] Build with custom files still works (regression)
- [ ] Plugin checkboxes control which configs are generated; path overrides work when provided
- [ ] Build button always enabled; invalid submit (no plugins checked / no outDir) shows validation message
- [ ] Build reports use `configSources` (path, isDefault); no `*Generated` flags
- [ ] Error messages are clear when files are missing
- [ ] Bundled files are included in packaged app (Windows build)
- [ ] Bundled files are accessible at runtime (verify paths)
- [ ] Packager output verification (four templates present) runs as part of build/packaging tests

## Migration Considerations

### Existing Users

**No Breaking Changes**: 
- Existing workflows continue to work (custom file selection still available)
- Users who prefer current workflow can continue using it
- New users get improved default experience

**Optional Migration**:
- Users can use bundled defaults by checking the desired plugins and not providing paths
- No data migration required
- No server profile changes needed

### Backward Compatibility

- All existing server profiles continue to work
- Build settings remain compatible
- Build history remains valid

## Documentation Updates

### User Documentation

1. **Build Screen Help**:
   - Explain bundled defaults feature
   - Explain when to use custom files vs defaults
   - Document what happens to custom commands/events (AA), custom header/footer/scoreboard (TAB), and custom rules (LM)

2. **FAQ**:
   - "Why do I need to select config files?" → Answer: You don't, defaults work
   - "What if I have custom commands in AA?" → Use custom file option
   - "How do I add custom counters to AA?" → Use custom file option
   - "What if I have custom header/footer or scoreboard in TAB?" → Use custom file option
   - "What if I have custom LevelledMobs rules?" → Use custom file option (non-owned rules are preserved)

### Developer Documentation

1. **Adding/Updating Bundled Templates**:
   - Process for updating default config files
   - When to update (plugin version changes, new features)
   - Testing requirements

## Future Enhancements

### Potential Extensions

1. **Template Versioning**: Track plugin versions and allow users to select template versions
2. **Template Editor**: Allow users to customize bundled defaults within the app
3. **Multiple Templates**: Provide multiple template variants (minimal, full-featured, etc.)
4. **Auto-Update**: Fetch updated templates from a source (with user approval)

## Acceptance Criteria

- [ ] Bundled default config files (AA, CE, TAB, LM) included in app distribution
- [ ] Pre-packager copy step populates `electron/assets/templates/`; packaging tests verify templates in packager output
- [ ] Plugin checkboxes (AA, CE, TAB, LM) control which configs are generated; path overrides use custom file when provided
- [ ] Build works with one or more plugins using bundled defaults (no paths)
- [ ] Build button always enabled; invalid submit (no plugins checked / no outDir) shows validation message, no IPC call
- [ ] Build reports use `configSources` only (no `*Generated`); default vs custom clear
- [ ] Custom file override works correctly for AA, CE, TAB, and LM
- [ ] Diff validation runs for each generated plugin using resolved path
- [ ] Version headers on templates only; stripped from generated output
- [ ] All existing functionality preserved (regression tests pass)
- [ ] Error handling provides clear guidance
- [ ] Documentation updated

## Implementation Notes

### Priority

**Medium-High**: Significant UX improvement with low technical risk.

### Estimated Effort

- Asset bundling + packaging: 1-2 hours (copy step, packager inclusion)
- Path resolution logic: 2-3 hours (include TAB and LM in `resolveConfigPath`; requires `app` from electron)
- IPC handler updates: 3-4 hours (generateAA/CE/TAB/LM, path resolution, diff validation, configSources; drop *Generated)
- UI updates: 5-7 hours (plugin checkboxes, path overrides, validate-on-submit, build always enabled)
- Packaging tests: 1-2 hours (verify templates in packager output)
- Other testing: 3-4 hours (path resolution, build flows, UI)
- Documentation: 1-2 hours

**Total**: ~16-24 hours

### Dependencies

- No external dependencies required
- Requires testing on packaged Electron app (Windows)

### Related Work

- TAB plugin integration — TAB is now included in bundled defaults; same pattern as AA/CE
- LevelledMobs generator — LM is now included in bundled defaults; same pattern as other generators
- Config validation improvements (could validate bundled files at startup)

---

**Document Version**: 1.3  
**Last Updated**: 2026-01-26  
**Author**: Enhancement Proposal
