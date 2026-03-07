# Unit Tests — Specification

**Status: Complete**

Core phases (Setup, Tier Calculation, Region Classification, Region Counts) are implemented. String formatters tests are deferred until after Refactor spec extraction; Config Generators and Diff Validator tests remain optional.

## Purpose

Introduce automated unit tests to catch regressions during refactoring and future development. The codebase currently has no test coverage; this spec establishes the testing infrastructure and defines initial test targets.

---

## Scope

- **In scope**: Vitest setup, unit tests for pure logic (tier calculation, region classification, string formatters, region counts), and snapshot/assertion tests for config generators.
- **Out of scope**: Full Electron IPC integration tests, E2E tests, React component tests (deferred).

---

## Test Framework

**Vitest** — chosen for:
- Native Vite integration (shared config, path resolution)
- Fast execution
- TypeScript support out of the box
- Snapshot testing built-in

### Dependencies

```json
"devDependencies": {
  "vitest": "^2.x"
}
```

### Scripts

```json
"scripts": {
  "test": "vitest",
  "test:run": "vitest run"
}
```

### Configuration

Create `vitest.config.ts` at project root:
- Use `tsconfig.json` paths for module resolution
- Include `electron/**/*.test.ts` and `src/**/*.test.ts`
- Exclude `node_modules`, `dist`, `dist-electron`

---

## Test Targets

### Phase 1: Tier Calculation (High Priority)

**File**: `electron/aaGenerator.ts` — `calculateTiers` (exported for testing)

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| 67 villages | `villagesTemplate`, 67 | `[1, 10, 20, 33, 40, 50, 60, 67]` |
| 63 villages (too-close rule) | `villagesTemplate`, 63 | `[1, 10, 20, 31, 40, 50, 63]` (60 dropped) |
| 33 regions | `regionsTemplate`, 33 | `[2, 16, 33]` |
| 5 villages (edge case) | `villagesTemplate`, 5 | `[2, 5]` |
| Zero total | any template, 0 | `[]` |
| Total 1 | `heartsTemplate`, 1 | `[1]` |
| Half equals all (total 2) | `heartsTemplate`, 2 | `[1, 2]` |

Reference: `AA_Custom_Achievements_Spec.md` — Generation Examples.

---

### Phase 2: Region Classification (High Priority)

**File**: `electron/regionParser.ts` — `classifyRegion` (must be exported)

| Test Case | regionId | regionData | world | startRegionId | Expected kind | discover.method | discover.recipeId |
|-----------|----------|------------|-------|---------------|---------------|-----------------|-------------------|
| Spawn | `spawn` | `{}` | overworld | — | system | disabled | none |
| Heart | `heart_of_monkvos` | `{}` | overworld | — | heart | on_enter | heart |
| Nether heart | `heart_of_nether_x` | `{}` | nether | — | heart | on_enter | nether_heart |
| First-join region | `cherrybrook` | `{}` | overworld | `cherrybrook` | region | first_join | region |
| Village (greeting) | `oak_village` | `{ flags: { greeting: "Welcome to the Village!" } }` | overworld | — | village | on_enter | region |
| Regular region | `desert_ruins` | `{ flags: { greeting: "" } }` | overworld | — | region | on_enter | region |
| Nether region | `nether_fortress` | `{}` | nether | — | region | on_enter | nether_region |

Note: `classifyRegion` is currently private. Export it for testing or extract to a separate testable module.

---

### Phase 3: String Formatters (Medium Priority)

**Target**: Shared utilities (to be extracted per Refactor spec). Until extraction, test the logic in-place or via generator output.

| Function | Input | Expected Output |
|----------|-------|-----------------|
| `snakeToTitleCase` | `cherrybrook` | `Cherrybrook` |
| `snakeToTitleCase` | `heart_of_monkvos` | `Heart Of Monkvos` |
| `formatRegionTitle` | `oak_village` | `Oak Village` |
| `sanitizeServerName` | `My Server 123!` | `my-server-123` |

---

### Phase 4: Region Counts (Medium Priority)

**File**: `electron/tabGenerator.ts` — `computeRegionCounts`

| Test Case | Regions | Expected Counts |
|-----------|---------|-----------------|
| Empty | `[]` | all zeros |
| Mixed | 2 villages, 3 overworld regions, 1 heart, 1 nether region, 1 system | villages: 2, overworldRegions: 3, overworldHearts: 1, netherRegions: 1, netherHearts: 0, total: 7 |
| Disabled excluded | 1 region (method: disabled), 1 village | total: 1 (village only) |

---

### Phase 5: Config Generators (Lower Priority)

**Approach**: Snapshot or structural assertion tests. Use fixture region arrays and bundled templates.

**AA Generator** (`generateAACommands`, `generateAACustom`):
- Fixture: 3 regions (1 village, 1 region, 1 heart)
- Assert: Commands section contains expected structure; Custom categories have correct tier counts

**CE Generator** (`generateOwnedCEEvents`):
- Fixture: 2 regions
- Assert: Events contain `*_discover_once` and `first_join` with expected structure

**TAB Generator** (`generateOwnedTABSections`):
- Fixture: `computeRegionCounts` output
- Assert: Header/footer and scoreboard sections present

**LM Generator** (`generateOwnedLMRules`):
- Fixture: regions with `regionBands`
- Assert: Custom rules array contains villages rule and region-band rules

---

### Phase 6: Diff Validator (Lower Priority)

**File**: `electron/diffValidator.ts`

- `validateAADiff`: Given identical configs (after removing owned sections), expect `valid: true`
- `validateAADiff`: Given config with unowned change, expect `valid: false` and error message
- Similar for CE, TAB, LM validators

---

## Test File Structure

```
electron/
  aaGenerator.test.ts
  regionParser.test.ts
  tabGenerator.test.ts
  utils/
    stringFormatters.test.ts   (after extraction)
src/
  utils/
    stringFormatters.test.ts   (if shared with renderer)
```

---

## Fixtures

Create `tests/fixtures/`:
- `regions-minimal.json` — minimal region array for generator tests
- `regions-meta-sample.yml` — sample regions-meta for import tests (optional, Phase 5+)

---

## Implementation Checklist

### Phase 1: Setup
- [x] Add `vitest` to devDependencies
- [x] Create `vitest.config.ts`
- [x] Add `test` and `test:run` scripts to `package.json`
- [x] Export `calculateTiers` from `aaGenerator.ts` (or move to testable module)

### Phase 2: Tier Calculation
- [x] Create `electron/aaGenerator.test.ts`
- [x] Implement all tier calculation test cases from Phase 1 table
- [x] Verify `test:run` passes

### Phase 3: Region Classification
- [x] Export `classifyRegion` from `regionParser.ts` (or extract to `regionClassifier.ts`)
- [x] Create `electron/regionParser.test.ts` (or `regionClassifier.test.ts`)
- [x] Implement classification test cases

### Phase 4: String Formatters
- [ ] After Refactor spec extracts utilities, add `stringFormatters.test.ts`
- [ ] Or add inline tests in generator test files as interim measure

### Phase 5: Region Counts
- [x] Create `electron/tabGenerator.test.ts`
- [x] Implement `computeRegionCounts` test cases

### Phase 6: Config Generators (Optional)
- [ ] Create `tests/fixtures/regions-minimal.json`
- [ ] Add snapshot or assertion tests for AA, CE, TAB, LM generators

### Phase 7: Diff Validator (Optional)
- [ ] Add tests for `validateAADiff`, `validateCEDiff`, etc.

---

## Success Criteria

- `npm run test:run` completes with all tests passing
- CI (if present) runs tests on every commit/PR
- Refactoring work can proceed with confidence that tier calculation and region classification behavior is preserved

---

## Related Specs

- **../Refactor_Spec.md**: Phase 4 (String Formatters) tests depend on extraction of shared string utilities. Can be deferred or tested in-place. Run tests after each refactor phase to catch regressions.
- **AA_Custom_Achievements_Spec.md**: Tier calculation tests align with examples in that spec.
