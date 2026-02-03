# Advanced Achievements Custom Section — Dynamic Generation Specification

## Purpose

Extend the MC Plugin Manager to dynamically generate the **Custom** section of AdvancedAchievements config. The Custom section contains milestone-based achievements for counting discoveries (villages, regions, hearts). Currently these are static in the bundled config with hardcoded totals (e.g., "59 villages"). This spec makes the milestone tiers dynamic based on actual counts from `regions-meta.yml`.

---

## Scope

- **Input**: `profile.regions` from regions-meta (to count villages, regions, hearts) and bundled tier templates with reward definitions.
- **Output**: Merged `advancedachievements-config.yml` with dynamically generated Custom achievement tiers.
- **Owned**: The following Custom subcategories only:
  - `villages_discovered`
  - `regions_discovered`
  - `hearts_discovered`
- **Preserved**: All other Custom subcategories (`votes`, `nether_regions_discovered`, `nether_hearts_discovered`, `total_discovered`, etc.) and all other sections of the config.

---

## Core Concepts

### 1) Tier Templates

Each achievement category has a **tier template** defining the milestone structure. Tiers are either:
- **Fixed**: A specific number (e.g., `1`, `10`, `20`)
- **Dynamic**: A computed value (`"half"` or `"all"`)

**Villages template**:
```
[1, 10, 20, "half", 40, 50, 60, "all"]
```

**Regions template**:
```
[2, "half", "all"]
```

**Hearts template**:
```
[1, "half", "all"]
```

### 2) Dynamic Tier Calculation

- **`"half"`**: `Math.floor(total / 2)`
- **`"all"`**: The actual total count from regions-meta

### 3) Tier Filtering Rules

When generating tiers for a given total:

1. **Drop tiers ≥ total**: Any fixed tier that equals or exceeds the total is removed.
2. **Drop "too close" tiers**: If the highest remaining fixed tier is within 4 of the total (i.e., `total - tier ≤ 4`), drop it. This prevents anticlimactic back-to-back achievements like "60... and now 63!".
3. **Calculate dynamic tiers**: Compute `"half"` and `"all"` values from the total.
4. **Collision handling**: If `"half"` equals a fixed tier, keep both (they'll have different rewards). If `"half"` equals `"all"` (total ≤ 2), only emit `"all"`.

---

## Generation Examples

### Example: 67 Villages

- half = floor(67/2) = **33**
- all = **67**
- Fixed tiers: 1, 10, 20, 40, 50, 60
- Check "too close": 67 - 60 = 7 > 4, keep 60

**Result**: `1, 10, 20, 33, 40, 50, 60, 67`

### Example: 63 Villages

- half = floor(63/2) = **31**
- all = **63**
- Fixed tiers: 1, 10, 20, 40, 50, 60
- Check "too close": 63 - 60 = 3 ≤ 4, **drop 60**

**Result**: `1, 10, 20, 31, 40, 50, 63`

### Example: 33 Regions

- half = floor(33/2) = **16**
- all = **33**
- Fixed tiers: 2
- Check "too close": 33 - 2 = 31 > 4, keep 2

**Result**: `2, 16, 33`

### Example: 5 Villages (edge case)

- half = floor(5/2) = **2**
- all = **5**
- Fixed tiers: 1 (all others ≥ 5 are dropped)
- Check "too close": 5 - 1 = 4 ≤ 4, **drop 1**

**Result**: `2, 5` (just half and all)

---

## Tier Reward Templates

Each tier position in the template has an associated **reward template** from the bundled config. The rewards include:

- `Message`: Text shown to player (may reference count, e.g., "You discovered X villages!")
- `Name`: Internal name with count suffix (e.g., `villages_discovered_67`)
- `DisplayName`: Title for the achievement
- `Type`: `normal` or `rare`
- `Reward`: Experience, Items, Commands

### Message Templates

Messages need dynamic text substitution:
- `"You discovered {count} villages!"` → `"You discovered 67 villages!"`
- `"You discovered half of all the villages!"` → stays as-is (it's descriptive)
- `"You discovered all the villages!"` → stays as-is

### Name Field

The `Name` field must include the actual tier count:
- Template: `villages_discovered_{count}`
- Output: `villages_discovered_67`

### Reward Preservation

Rewards from the bundled template are preserved exactly. The generator does not modify reward amounts, items, or commands — only the tier count and count-dependent text.

---

## Counting from Regions-Meta

Counts are derived from `profile.regions`:

```typescript
const villageCount = regions.filter(r => r.kind === 'village').length
const regionCount = regions.filter(r => r.kind === 'region').length
const heartCount = regions.filter(r => r.kind === 'heart').length
```

**World filtering**: For v1, count all entries regardless of `world`. Nether regions/hearts have their own separate Custom categories (`nether_regions_discovered`, `nether_hearts_discovered`) which are not in scope for this spec.

---

## Bundled Template Structure

The bundled `advancedachievements-config.yml` serves as the template. Each tier in the Custom section defines:

```yaml
villages_discovered:
  1:                              # Tier count (will become dynamic)
    Message: You discovered a village!
    Name: villages_discovered_1   # Count suffix will be updated
    DisplayName: Village Wanderer
    Type: normal
    Reward:
      Experience: 50
      Item: diamond 1
  # ... more tiers
  67:                             # "all" tier
    Message: You discovered all the villages!
    Name: villages_discovered_67
    DisplayName: Village Legend
    Type: rare
    Reward:
      Experience: 300
      Item:
        - diamond 32
        - emerald 64
      Command:
        Execute:
          - ce call get_book_mending player:PLAYER
```

### Template Tier Mapping

The generator maps template tiers to output tiers:

| Template Position | Villages | Regions | Hearts |
|-------------------|----------|---------|--------|
| First fixed | 1 | 2 | 1 |
| Second fixed | 10 | — | — |
| Third fixed | 20 | — | — |
| "half" | 30 (template) | 15 (template) | 15 (template) |
| Fourth fixed | 40 | — | — |
| Fifth fixed | 50 | — | — |
| Sixth fixed | 60 | — | — |
| "all" | 67 (template) | 30 (template) | 30 (template) |

When generating, the "half" tier's rewards come from the template's "half" position (30 for villages, 15 for regions/hearts), and the "all" tier's rewards come from the template's final tier.

---

## Merge Algorithm

1. Parse the bundled `advancedachievements-config.yml` as the template.
2. Parse the user's base config (or use bundled if none).
3. Count villages, regions, hearts from `profile.regions`.
4. For each owned category (`villages_discovered`, `regions_discovered`, `hearts_discovered`):
   a. Get the tier template for this category.
   b. Apply filtering rules to determine which tiers to emit.
   c. For each output tier:
      - Find the corresponding template tier (by position/role).
      - Copy the reward structure.
      - Update `Name` field with actual count.
      - Update `Message` if it contains count placeholders.
5. Replace the owned categories in `Custom` with generated content.
6. Preserve all other `Custom` subcategories and all other config sections.
7. Serialize to YAML.

---

## Diff Validator

### `removeOwnedAACustomSections(config)`

For `config.Custom`:
- Remove keys: `villages_discovered`, `regions_discovered`, `hearts_discovered`
- Preserve all other keys (`votes`, `nether_regions_discovered`, etc.)

Do not modify `Commands` or any other top-level section.

### `validateAACustomDiff(originalPath, generatedContent)`

1. Parse original and generated configs.
2. Clean both with `removeOwnedAACustomSections()`.
3. Deep-compare cleaned configs.
4. Return `{ valid: true }` or `{ valid: false, error, differences }`.

---

## Integration with Existing aaGenerator

The existing `aaGenerator.ts` handles the `Commands` section. This new functionality:

1. **Extends** `aaGenerator.ts` with new exports:
   - `generateAACustom(regions, templateConfig)` → Custom section object
   - `mergeAACustom(existingConfig, generatedCustom)` → merged config

2. **Build workflow**: After generating `Commands`, also generate `Custom` if regions are available.

3. **Validation**: Extend `validateAADiff` to also check Custom section ownership.

---

## Data Requirements

- **`profile.regions`**: Required. Array of region records with `kind` field.
- **Bundled template**: The `to be bundled/advancedachievements-config.yml` file provides reward templates.

---

## Edge Cases

### No regions imported

- Cannot count, so skip Custom generation entirely.
- Preserve existing Custom section as-is.

### Zero count for a category

- If `villageCount === 0`, do not emit `villages_discovered` at all.
- Same for regions and hearts.

### Very low counts

- If total ≤ 1: Only emit the "all" tier at count 1.
- If total === 2: Emit half=1 and all=2 (if both would be different).

### Half equals a fixed tier

- If half calculation lands on an existing fixed tier (e.g., half=20 when 20 is a fixed tier), keep both. They have different reward structures (milestone vs. half-way celebration).

### Half equals all

- If `floor(total/2) === total` (only possible if total ≤ 1), emit only "all".

---

## Implementation Checklist

### Phase 1: Tier Generation Logic

- [x] Define tier templates as constants (villages, regions, hearts).
- [x] Implement `calculateTiers(template, total)` → array of tier numbers.
- [x] Implement filtering: drop ≥ total, drop "too close" to total.
- [x] Implement dynamic calculation: half and all.
- [x] Unit tests for tier calculation with various totals.

### Phase 2: Custom Section Generator

- [x] Implement `generateAACustomCategory(categoryTemplate, tiers, total)` → category object.
- [x] Handle Name field count substitution.
- [x] Handle Message count substitution where applicable.
- [x] Implement `generateAACustom(regions, templateConfig)` → full Custom section.

### Phase 3: Merge and Validation

- [x] Merged into existing `mergeAAConfig` (now accepts optional `newCustom` parameter).
- [x] Updated `removeOwnedAASections(config)` to handle Custom categories.
- [x] `validateAADiff` now validates Custom section ownership.

### Phase 4: Build Integration

- [x] Update build handler to call Custom generation after Commands.
- [x] Ensure bundled template is accessible at build time.
- [ ] Update build report with Custom generation stats (deferred - not critical).

### Phase 5: Testing

- [x] Test with various region counts (67 villages, 33 regions, 33 hearts).
- [x] Test edge cases (low counts, zero counts).
- [x] Test tier filtering ("too close" rule).
- [ ] Validate diff checker catches unowned changes (manual testing).

---

## Implementation Status

**Status: ✅ Complete**

All core implementation phases are complete. The generator:
- Calculates tiers dynamically based on actual region counts
- Filters fixed tiers ≥ total and drops highest fixed tier if within 4 of total
- Computes `half` = floor(total/2) and `all` = total dynamically
- Preserves reward templates from bundled config while updating Name and Message fields
- Integrates with existing AA build workflow
- Validates that only owned sections (Commands + Custom categories) change via diff validator

---

## Open Decisions

- **Nether categories**: `nether_regions_discovered` and `nether_hearts_discovered` are out of scope. Future work could add these with separate nether region counting.
- **Custom tier editing UI**: Future enhancement to allow users to add/edit/remove tiers and customize rewards. This spec only covers dynamic count adjustment.
- **Message text variations**: Some messages say "half of all" which may not be exactly half. Acceptable for v1; future work could make messages fully templated.

---

## Reference Files

- **Bundled template**: `reference/plugin config files/to be bundled/advancedachievements-config.yml`
- **Existing generator**: `electron/aaGenerator.ts`
- **Regions-meta schema**: `reference/regions-meta-schema.md`
