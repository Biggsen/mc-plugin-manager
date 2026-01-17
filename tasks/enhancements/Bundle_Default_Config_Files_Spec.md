# Bundle Default Config Files — Enhancement Specification

**Status: 📋 Proposed**

## Purpose

Bundle default template config files for AdvancedAchievements and ConditionalEvents plugins directly within the application bundle. This eliminates the requirement for users to manually select existing config files on every build, improving UX and reducing friction.

## Problem Statement

### Current Workflow Issues

1. **Repetitive File Selection**: Users must select existing config files (`advancedachievements-config.yml` and `conditionalevents-config.yml`) for every build, even though these files need to conform to specific structural requirements for the generators to work correctly.

2. **Structural Dependencies**: The generators (`mergeAAConfig`, `mergeCEConfig`) require existing config files with specific sections:
   - **AA**: Must have a `Commands` section (will be completely replaced)
   - **CE**: Must have an `Events` section (owned events merged into it)

3. **User Confusion**: Users may not understand why they need to provide config files when the generators will replace/merge specific sections anyway.

4. **Maintenance Burden**: Users must maintain compatible template files externally, which creates an unnecessary dependency.

### Why Defaults Exist

The `reference/plugin config files/defaults/` directory already contains properly structured default config files:
- `advancedachievements-config.yml` — Full AA config with `Commands` section placeholder
- `conditionalevents-config.yml` — Full CE config with `Events` section placeholder

These files represent minimal viable templates that satisfy the generator's structural requirements.

## Proposed Solution

### Core Concept

Bundle default config templates as application assets. Use them automatically when users don't explicitly provide custom existing config files. Allow users to override with custom files when needed.

### Behavior Changes

1. **Default Behavior (New)**: 
   - If no existing config path is provided for AA/CE, use bundled defaults
   - Build succeeds without requiring file selection
   - UI clearly indicates "Using bundled defaults"

2. **Override Behavior (Preserved)**:
   - Users can still provide custom existing config files via file picker
   - Custom files take precedence when provided
   - UI clearly indicates "Using custom file: [path]"

3. **File Selection (Updated)**:
   - File selection becomes **optional** for AA and CE (required only for TAB currently)
   - UI provides clear visual distinction between default and custom mode

## Implementation Details

### File Structure

```
electron/
  assets/
    templates/
      advancedachievements-config.yml    (copied from reference/defaults)
      conditionalevents-config.yml       (copied from reference/defaults)
```

**Alternative**: Store in `src/assets/templates/` if bundling through Vite is preferred.

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
```

**Proposed**: No changes needed. Generators continue to accept file paths. Path resolution happens at caller level.

#### 3. Path Resolution Logic

**New Function**: `resolveConfigPath(type: 'aa' | 'ce', userProvidedPath?: string): string`

```typescript
function resolveConfigPath(type: 'aa' | 'ce', userProvidedPath?: string): string {
  // If user provided path, validate and use it
  if (userProvidedPath && userProvidedPath.trim().length > 0) {
    if (!existsSync(userProvidedPath)) {
      throw new Error(`${type.toUpperCase()} config file not found: ${userProvidedPath}`)
    }
    return userProvidedPath
  }
  
  // Otherwise, use bundled default
  const appPath = app.getAppPath()
  const defaultPath = path.join(appPath, 'electron', 'assets', 'templates', 
    type === 'aa' 
      ? 'advancedachievements-config.yml'
      : 'conditionalevents-config.yml'
  )
  
  if (!existsSync(defaultPath)) {
    throw new Error(`Bundled ${type.toUpperCase()} default config not found at: ${defaultPath}`)
  }
  
  return defaultPath
}
```

#### 4. IPC Handler Updates

**File**: `electron/ipc.ts` — `build-configs` handler

**Current Flow**:
```typescript
if (inputs.aaPath && inputs.aaPath.trim().length > 0) {
  if (!existsSync(inputs.aaPath)) {
    return { success: false, error: `AA config file not found: ${inputs.aaPath}` }
  }
  const mergedAAContent = mergeAAConfig(inputs.aaPath, newCommands)
  // ...
}
```

**Updated Flow**:
```typescript
// AA generation (optional)
if (inputs.generateAA !== false) {  // Default true, or check checkbox
  try {
    const aaConfigPath = resolveConfigPath('aa', inputs.aaPath)
    const mergedAAContent = mergeAAConfig(aaConfigPath, newCommands)
    // Track whether using default or custom
    const usingDefaultAA = !inputs.aaPath || inputs.aaPath.trim().length === 0
    // ... rest of generation
  } catch (error) {
    return { success: false, error: error.message }
  }
}
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
  }
}
```

#### 6. UI Updates

**File**: `src/screens/BuildScreen.tsx`

**Changes**:
1. **File Selection UI**:
   - Make AA/CE file pickers **optional** (add checkboxes: "Use bundled defaults" vs "Use custom file")
   - Default to "Use bundled defaults" checked
   - Show file path input only when "Use custom file" is selected
   - Add visual indicator showing which mode is active

2. **Build Status Display**:
   - Show which config sources were used (default vs custom) in build result
   - Display paths clearly in build report

3. **Layout Updates**:
   ```
   AdvancedAchievements
   [✓] Use bundled defaults
   [ ] Use custom file: [Browse...] [path display]
   
   ConditionalEvents
   [✓] Use bundled defaults
   [ ] Use custom file: [Browse...] [path display]
   
   TAB (still required)
   [Browse...] [path display]
   ```

## Default Config File Content

### AdvancedAchievements Default

**Source**: `reference/plugin config files/defaults/advancedachievements-config.yml`

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

**Source**: `reference/plugin config files/defaults/conditionalevents-config.yml`

**Key Characteristics**:
- Full plugin config with `Config`, `Messages`, and `Events` sections
- `Events` section contains example events (`event1` through `event7`)
- Generator will merge owned events (`first_join`, `region_heart_discover_once`, `*_discover_once`)
- Non-owned events preserved

## Risks & Mitigations

### Risk 1: Plugin Version Compatibility

**Risk**: If plugin authors change config format, bundled defaults may become incompatible.

**Mitigation**:
- Add version comment header to bundled files indicating target plugin version
- Document in UI which plugin versions are supported
- Provide clear error messages if config parsing fails (likely indicates version mismatch)
- Consider versioning bundled templates if major changes occur

**Action**: Add comment header to default files:
```yaml
# MC Plugin Manager - Bundled Default Template
# Target Plugin Version: AdvancedAchievements 6.x
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

## Testing Strategy

### Unit Tests

1. **Path Resolution**:
   - Test `resolveConfigPath` with provided path
   - Test `resolveConfigPath` without provided path (should use default)
   - Test error handling for missing custom files
   - Test error handling for missing bundled defaults

2. **Generator Integration**:
   - Verify generators work with bundled default paths
   - Verify generators work with custom paths (regression)
   - Verify merge behavior identical for both paths

### Integration Tests

1. **Build Flow**:
   - Build with AA default only
   - Build with CE default only
   - Build with both defaults
   - Build with custom files (regression)
   - Build with mixed (default AA, custom CE)

2. **UI Flow**:
   - Toggle between default and custom modes
   - Verify file picker enables/disables correctly
   - Verify build result displays correct source information

### Manual Testing Checklist

- [ ] Build with bundled defaults produces valid configs
- [ ] Build with custom files still works (regression)
- [ ] UI clearly shows which mode is active
- [ ] Build reports indicate config sources correctly
- [ ] Error messages are clear when files are missing
- [ ] Bundled files are included in packaged app (Windows build)
- [ ] Bundled files are accessible at runtime (verify paths)

## Migration Considerations

### Existing Users

**No Breaking Changes**: 
- Existing workflows continue to work (custom file selection still available)
- Users who prefer current workflow can continue using it
- New users get improved default experience

**Optional Migration**:
- Users can switch to bundled defaults by simply not selecting files
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
   - Document what happens to custom commands/events

2. **FAQ**:
   - "Why do I need to select config files?" → Answer: You don't, defaults work
   - "What if I have custom commands in AA?" → Use custom file option
   - "How do I add custom counters to AA?" → Use custom file option

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

- [ ] Bundled default config files included in app distribution
- [ ] Build works without requiring AA/CE file selection
- [ ] UI clearly indicates default vs custom mode
- [ ] Build reports show config source information
- [ ] Custom file override works correctly
- [ ] All existing functionality preserved (regression tests pass)
- [ ] Error handling provides clear guidance
- [ ] Documentation updated

## Implementation Notes

### Priority

**Medium-High**: Significant UX improvement with low technical risk.

### Estimated Effort

- Asset bundling setup: 1-2 hours
- Path resolution logic: 2-3 hours
- IPC handler updates: 2-3 hours
- UI updates: 4-6 hours
- Testing: 3-4 hours
- Documentation: 1-2 hours

**Total**: ~15-20 hours

### Dependencies

- No external dependencies required
- Requires testing on packaged Electron app (Windows)

### Related Work

- TAB plugin integration (similar pattern may apply in future)
- Config validation improvements (could validate bundled files at startup)

---

**Document Version**: 1.0  
**Last Updated**: 2024-XX-XX  
**Author**: Enhancement Proposal
