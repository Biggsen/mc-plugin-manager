# Nether regions-meta Import — Specification

**Status: 📋 PENDING**

## Purpose

Extend the existing regions-meta import functionality to support **separate, independent imports** for nether regions. The current implementation assumes a single regions-meta file contains all worlds, but Region Forge exports separate files per world (`world: overworld`, `world: nether`, `world: end`). This spec adds UI and validation to support importing nether regions-meta files independently from overworld imports.

---

## Dependencies

- **regions-meta schema** (`reference/regions-meta-schema.md`): Defines the `regions-meta.yml` format. The schema already supports `world: nether` in the root field.
- **Existing regions-meta import** (`Regions_Meta_Import_Spec.md`): The base implementation is complete. This spec extends it for multi-world support.
- **regionParser.ts**: Contains `importRegionsMeta()` which already accepts a `world` parameter and maps world strings correctly.

---

## Scope

### In Scope

- **ImportScreen UI**: Add separate import sections/buttons for overworld and nether regions-meta imports.
- **Parser validation**: Enforce that the file's `world` field matches the requested world parameter (or make world parameter required and validate strictly).
- **IPC handler**: Ensure world parameter is properly validated and used.
- **Source tracking**: Display separate import status for `sources.overworld` vs `sources.nether`.
- **spawnCenter/onboarding handling**: Only overworld imports can set/update `spawnCenter` and `onboarding`. Nether/end imports skip these fields.

### Out of Scope

- **End world import**: End world support is deferred (can be added later using the same pattern).
- **Backward compatibility**: Existing overworld imports continue to work; this adds nether support without breaking changes.
- **LevelledMobs per-world**: `levelledMobs` data from nether imports will be merged into the shared `profile.regionsMeta.levelledMobs` (same as overworld). Per-world LevelledMobs is out of scope.

---

## Current vs New Behaviour

### Current (regions-meta import)

| Aspect | Behaviour |
|--------|-----------|
| **Import flow** | Single "Import regions-meta" button. File's `world` field is inferred; defaults to 'overworld' if not specified. |
| **World handling** | Parser accepts optional `world` parameter but uses file's `world` field if it differs (with warning). |
| **UI display** | Shows single import status, checks `sources.overworld || sources.nether || sources.end || sources.world`. |
| **spawnCenter/onboarding** | Merged from any regions-meta file (last import wins). |
| **Region replacement** | Replaces regions for the world specified in the file. |

### New (with nether support)

| Aspect | Behaviour |
|--------|-----------|
| **Import flow** | **Two separate buttons**: "Import Overworld regions-meta" and "Import Nether regions-meta". User explicitly selects which world they're importing. |
| **World handling** | `world` parameter is **required** in IPC call. Parser validates that file's `world` field matches the requested world. Error if mismatch. |
| **UI display** | Shows **separate import status** for overworld and nether. Each section displays its own `sources.overworld` or `sources.nether` info. |
| **spawnCenter/onboarding** | **Only overworld imports** can set/update `spawnCenter` and `onboarding`. Nether/end imports skip these fields entirely. |
| **Region replacement** | Same as current: replaces regions for the specific world being imported. Overworld and nether imports are **independent** (don't affect each other). |

---

## Design Decisions

### 1. Independent Imports

- **Decision**: Overworld and nether imports are **independent**.
- **Rationale**: Allows users to manage each world separately. Importing overworld doesn't affect nether regions, and vice versa.
- **Implementation**: Already handled by existing filter logic: `profile.regions = profile.regions.filter((r: any) => r.world !== result.world)`

### 2. spawnCenter and onboarding

- **Decision**: `spawnCenter` and `onboarding` are **shared/overworld-only**. Nether/end imports cannot set these fields.
- **Rationale**: Nether and end worlds don't have spawn centers or onboarding teleports in this use case. Only overworld imports should update these.
- **Implementation**: IPC handler checks `result.world === 'overworld'` before merging `spawnCenter` and `onboarding`.

### 3. World Parameter Validation

- **Decision**: `world` parameter is **required** in IPC calls. Parser validates file's `world` field matches the requested world. **Error** (not warning) on mismatch.
- **Rationale**: Prevents accidental imports (e.g., importing a nether file as overworld). User explicitly selects which world they're importing.
- **Implementation**: `importRegionsMeta(filePath, world)` requires `world` parameter. Parser throws error if `mappedWorld !== world`.

### 4. UI Structure

- **Decision**: Two separate import sections in `ImportScreen.tsx`: one for overworld, one for nether.
- **Rationale**: Clear separation makes it obvious which world is being imported. Each section shows its own import status.
- **Implementation**: Two `<div>` sections, each with its own button and status display.

---

## Implementation Details

### Phase 1: Parser Validation

**File**: `electron/regionParser.ts`

- [ ] Make `world` parameter **required** (remove `?` from type): `importRegionsMeta(filePath: string, world: 'overworld' | 'nether' | 'end')`
- [ ] Change validation from warning to **error** if `mappedWorld !== world`:
  ```typescript
  if (mappedWorld !== world) {
    throw new Error(`World mismatch: file contains world "${parsed.world}" (mapped to "${mappedWorld}") but import requested "${world}"`)
  }
  ```
- [ ] Remove the warning log that currently allows mismatches.

### Phase 2: IPC Handler Updates

**File**: `electron/ipc.ts`

- [ ] Ensure `world` parameter is **required** (not optional) in IPC handler signature.
- [ ] Update merge logic to **only set `spawnCenter` and `onboarding` for overworld imports**:
  ```typescript
  // Merge spawnCenter (only from overworld)
  if (result.spawnCenter && result.world === 'overworld') {
    profile.spawnCenter = result.spawnCenter
    result.source.spawnCenter = result.spawnCenter
  }
  
  // Merge onboarding (only from overworld)
  if (result.onboarding && result.world === 'overworld') {
    profile.onboarding = {
      ...profile.onboarding,
      ...result.onboarding,
      teleport: {
        ...profile.onboarding.teleport,
        ...result.onboarding.teleport,
        y: result.onboarding.teleport.y ?? profile.onboarding.teleport.y,
      },
    }
  }
  ```
- [ ] Verify that `levelledMobs` merging works for both overworld and nether (current behavior is fine).

### Phase 3: ImportScreen UI

**File**: `src/screens/ImportScreen.tsx`

- [ ] Replace single "Regions Meta" section with **two separate sections**:
  - "Overworld Regions Meta" section
  - "Nether Regions Meta" section
- [ ] Each section should have:
  - Title (e.g., "Overworld Regions Meta" / "Nether Regions Meta")
  - Import button (e.g., "Import overworld regions-meta" / "Import nether regions-meta")
  - Status display showing:
    - Imported filename from `server.sources.overworld?.originalFilename` or `server.sources.nether?.originalFilename`
    - Import timestamp
    - "Re-import" button text if already imported
- [ ] Create separate handler functions:
  - `handleImportOverworldRegionsMeta()` → calls `importRegionsMeta(server.id, 'overworld', filePath)`
  - `handleImportNetherRegionsMeta()` → calls `importRegionsMeta(server.id, 'nether', filePath)`
- [ ] Update import result display to show which world was imported (if needed for clarity).

### Phase 4: Preload Types

**File**: `electron/preload.ts`

- [ ] Verify `importRegionsMeta` signature already requires `world` parameter (should be: `world: 'overworld' | 'nether' | 'end'`).
- [ ] No changes needed if signature is already correct.

### Phase 5: Testing

- [ ] Test importing overworld regions-meta file (should work as before).
- [ ] Test importing nether regions-meta file (should import nether regions only).
- [ ] Test importing nether file with `world: overworld` parameter (should error).
- [ ] Test importing overworld file with `world: nether` parameter (should error).
- [ ] Test that nether import doesn't affect overworld regions.
- [ ] Test that overworld import doesn't affect nether regions.
- [ ] Test that nether import doesn't set/update `spawnCenter` or `onboarding`.
- [ ] Test that overworld import still sets/updates `spawnCenter` and `onboarding`.
- [ ] Test that `levelledMobs` from nether imports merges correctly with overworld data.

---

## Profile / Data Model

No changes to the data model. Existing structure already supports:

- `sources.overworld?: ImportedSource` — set by overworld imports
- `sources.nether?: ImportedSource` — set by nether imports
- `sources.end?: ImportedSource` — reserved for future end imports
- `profile.regions: RegionRecord[]` — contains regions from all worlds, filtered by `world` field
- `profile.spawnCenter?` — only set by overworld imports
- `profile.onboarding?` — only set by overworld imports
- `profile.regionsMeta?.levelledMobs?` — merged from all world imports

---

## Error Handling

### World Mismatch Error

**Scenario**: User selects "Import Nether regions-meta" but picks a file with `world: overworld`.

**Behavior**: Parser throws error: `World mismatch: file contains world "overworld" (mapped to "overworld") but import requested "nether"`

**UI**: Display error message in import result section.

### Missing World Parameter

**Scenario**: IPC handler called without `world` parameter (shouldn't happen with UI changes, but defensive).

**Behavior**: TypeScript compile error (if types are correct) or runtime error in IPC handler.

---

## Future Considerations

- **End world import**: Can be added later using the same pattern (add "Import End regions-meta" section).
- **Per-world LevelledMobs**: Currently merged into shared `regionsMeta.levelledMobs`. If per-world LevelledMobs is needed, would require data model changes (e.g., `regionsMeta.overworld.levelledMobs`, `regionsMeta.nether.levelledMobs`).

---

## Acceptance Criteria

- [ ] User can import overworld regions-meta file via "Import Overworld regions-meta" button.
- [ ] User can import nether regions-meta file via "Import Nether regions-meta" button.
- [ ] Importing overworld doesn't affect existing nether regions.
- [ ] Importing nether doesn't affect existing overworld regions.
- [ ] Importing nether file with wrong world parameter shows clear error.
- [ ] Nether imports don't set/update `spawnCenter` or `onboarding`.
- [ ] Overworld imports still set/update `spawnCenter` and `onboarding`.
- [ ] UI shows separate import status for overworld and nether.
- [ ] `levelledMobs` data merges correctly from both world imports.

---

## Estimated Effort

- **Parser validation**: ~30 minutes
- **IPC handler updates**: ~30 minutes
- **UI changes**: ~1-2 hours
- **Testing**: ~1 hour
- **Total**: ~2.5-3.5 hours
