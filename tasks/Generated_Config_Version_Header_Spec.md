# Generated Config Version Header — Specification

**Status: Draft (not implemented)**

## Purpose

Add a **single-line YAML comment** at the top of each **generated plugin config file** so that:

- Operators can see at a glance that a file was produced by MC Plugin Manager and **which generation** it is (monotonic counter per server profile × plugin).
- Support and parity work can correlate an on-disk file with an app **build report** via **`build-id`**.
- The rolling counter **increments on every successful emit** for that plugin (no checkbox; see [Decision: no “apply version” toggle](#decision-no-apply-version-toggle)).

**Out of scope for this spec (later work):** structured “what changed” summaries, full text diffs, or changelog bullets in the header.

---

## Problem Statement

1. **No on-file provenance**: Deployed YAML looks like any hand-edited config; there is no standard stamp tying it to the tool or a specific build.
2. **No per-artifact generation index**: Users cannot tell whether a file was regenerated once or many times without comparing hashes or trusting external notes.
3. **Build reports exist but are separate**: `BuildReport` already has `buildId` and `timestamp`, but nothing in the emitted config points back to that artifact without opening the app’s build history.

---

## Goals

| Goal | Detail |
|------|--------|
| **Per profile, per plugin** | Each `ServerProfile` maintains independent counters for `aa`, `ce`, `tab`, `lm`, `mc`, `cw`. |
| **Auto-increment** | On each **successful** write of that plugin’s output for this build, bump that plugin’s counter by 1 and embed the new value in the header. |
| **Stable, parseable header** | One comment line, fixed prefix, `key=value` segments (see [Header format](#header-format)). |
| **Include `build-id`** | Use the existing build identifier (`build-${Date.now()}` pattern today) so the line matches `saveBuildReport(serverId, buildId, …)`. |
| **Diff validation** | Validators that compare “only owned sections changed” must **ignore** the version header line so it does not cause false failures (see [Diff validation](#diff-validation)). |

---

## Non-goals

- **BookGUI** multi-file output: not covered in v1; can be a follow-up (single shared counter vs per-file).
- **Semantic “what changed”** in the header or report extensions (separate initiative).
- **User-facing checkbox** to skip or force bump (explicitly rejected; see below).

---

## Decision: no “apply version” toggle

The counter **always increments** when that plugin’s file is **successfully written** in a build where that plugin was selected. Routine regenerations will advance the number; that is acceptable: the counter means **“emit serial”** for that profile × plugin, not “semantic release version.”

---

## Header format

### Line shape

- **Exactly one full-line comment** as **line 1** of the written file.
- Prefix (machine-discoverable): `# mc-plugin-manager:`
- Followed by **semicolon-separated** `key=value` pairs.
- Values must not contain `;` unescaped; use safe tokens only (see keys below).

### Required keys

| Key | Meaning | Example |
|-----|---------|---------|
| `generator-version` | 1-based integer, **zero-padded to 3 digits** for stable sorting in plain text | `007` |
| `generated-at` | ISO 8601 UTC timestamp when the file was written | `2026-03-22T16:30:00.000Z` |
| `profile` | Server profile **id** (stable `ServerId`, not display name) | `charidh-main` |
| `plugin` | Plugin id matching `PluginType` | `tab` |

### Optional keys

| Key | Meaning | When omitted |
|-----|---------|--------------|
| `build-id` | Same string as `BuildReport.buildId` for this run | Never omitted if a build id exists for the current build (it always should during IPC build). |

### Example

```yaml
# mc-plugin-manager: generator-version=007; generated-at=2026-03-22T16:30:00.000Z; profile=charidh; plugin=tab; build-id=build-1742662200123
header-footer:
  enabled: true
```

### Notes

- **YAML**: A leading `#` line is a comment; TAB and other plugins should ignore it.
- **Padding**: Display `generator-version` as three digits (`001`…`999`). If the counter exceeds 999, either pad to width 4+ in a later revision or cap/document overflow behavior (v1: implement padding with minimum width 3, grow if needed, or use unpadded integer — **implementer choice**; spec recommends **at least 3-digit zero-pad** until 1000).

---

## State: where counters live

### Server profile

Extend `ServerProfile` (shared types) with an optional map, for example:

```ts
generatorVersions?: Partial<Record<PluginType, number>>
```

- Keys only for plugins that have been successfully emitted at least once, **or** initialize missing keys to `0` on first write and then store `1`.
- **Persistence**: Saved with the rest of the profile when the build completes successfully (same path as today’s `saveServerProfile` in the build handler).

### Counter semantics

- **Initial**: First successful write for `plugin` P → stored value becomes `1`, header shows `generator-version=001`.
- **Increment**: Immediately before or after write, as long as **atomicity** is preserved: if `writeFileSync` throws, the profile must **not** persist a bumped counter for that plugin (see [Concurrency / failure](#concurrency--failure)).

---

## When to bump and write the header

### Bump + prepend when **all** are true

1. User selected generation for plugin **P** (`generateAA`, … `generateCW` as today).
2. Build produced **final string content** for **P** (merge/generate path succeeded).
3. **Diff validation** for **P** passed (for plugins that validate).
4. **File write** to `outputPath` / `buildPath` succeeded.

### Do **not** bump when

- Plugin not selected.
- Build skipped or failed for that plugin before write.
- Validation failed (no write).

### BookGUI

- **v1**: No version header on individual guide YAML files unless product decides otherwise; document as follow-up.

---

## Where to implement (recommended)

1. **Central hook**: After content is finalized in `runPluginBuild` (`electron/build/buildPluginConfig.ts`), call a small helper e.g. `prependGeneratorVersionHeader(content, { plugin, profileId, buildId, nextVersion })` that returns the final string to write.
2. **Counter bump**: In `electron/ipc/handlers/buildHandlers.ts`, after each successful `runPluginBuild` for **P**, set `profile.generatorVersions[P] = (profile.generatorVersions[P] ?? 0) + 1` (in memory), pass `nextVersion` into the hook, then `saveServerProfile` once at end of build with all updated counters (or save per-plugin if simpler — prefer **one save** after all plugins to avoid partial state).
3. **Timestamp / build-id**: Build handler already has `buildId` and `timestamp`; pass `timestamp` as `generated-at` for consistency with `BuildReport.timestamp` (or use `new Date().toISOString()` at write time — **spec prefers** alignment with report timestamp for the same build when practical).

### Plugins affected (YAML configs)

| Plugin | Output file(s) |
|--------|------------------|
| `aa` | `AdvancedAchievements/config.yml` |
| `ce` | `ConditionalEvents/config.yml` |
| `tab` | `TAB/config.yml` |
| `lm` | `LevelledMobs/rules.yml` |
| `mc` | `MyCommand/commands/commands.yml` |
| `cw` | `CommandWhitelist/config.yml` |

---

## Diff validation

For `validateAADiff`, `validateCEDiff`, `validateTABDiff`, `validateLMDiff`:

- **Strip** the first line if it matches the prefix `# mc-plugin-manager:` before parsing YAML or doing deep equality on “non-owned” sections.
- Alternatively: strip all consecutive leading lines matching that prefix (v1: single line only).

`mc` / `cw` do not use these validators today; if added later, same rule applies.

---

## Bundled templates / `copy-templates`

- **Bundled reference files** under `reference/plugin config files/to be bundled/` remain **without** this header (they are templates, not generator output).
- If `copy-templates.js` strips other headers, it must **not** rely on the new line unless we deliberately add a template-only marker (not recommended).
- Generated output always gets the header at **write time** in the app, not in repo templates.

---

## Build report (optional enhancement)

Not required for v1, but recommended small addition:

- Under `BuildReport`, optional `generatorVersionsSnapshot?: Partial<Record<PluginType, number>>` **after** the build, so the report JSON shows the counter values that were written.

---

## Testing

1. **Unit**: `prependGeneratorVersionHeader` produces expected line; handles empty content edge case (should still be valid YAML after comment).
2. **Integration**: Mock profile with `generatorVersions.tab = 2`, run TAB build, assert file starts with `generator-version=003` and `build-id` matches.
3. **Validator**: TAB/AA/CE/LM diff validation passes when only the header line differs from a baseline without header (regression test).

---

## Implementation checklist

- [ ] Add `generatorVersions?: Partial<Record<PluginType, number>>` to `ServerProfile` in `src/types/index.ts` (and any duplicate definitions if present).
- [ ] Implement `prependGeneratorVersionHeader` (e.g. `electron/utils/generatorVersionHeader.ts`).
- [ ] Integrate into `runPluginBuild` or immediately after content generation in `buildPluginConfig.ts` / `buildHandlers.ts`.
- [ ] Bump counters in memory per successful plugin write; persist profile once per build.
- [ ] Update `diffValidator.ts` to strip the version line for AA, CE, TAB, LM.
- [ ] Add unit tests for header helper and validator strip behavior.
- [ ] Document in user-facing docs or build screen tooltip only if product wants (“Files include a generator stamp on line 1”).

---

## Open questions (resolve during implementation)

1. **Counter overflow past 999**: widen padding vs integer only in comment.
2. **Profile save timing**: single save at end of build vs per-plugin (affects crash mid-build recovery).
3. **Identical rebuild**: counter still increments even if content byte-identical — confirmed desired per [Decision](#decision-no-apply-version-toggle).

---

## References

- `electron/ipc/handlers/buildHandlers.ts` — `buildId`, `saveBuildReport`, `saveServerProfile`
- `electron/build/buildPluginConfig.ts` — `runPluginBuild`, per-plugin writes
- `electron/diffValidator.ts` — owned-section validation
- `src/types/index.ts` — `ServerProfile`, `BuildReport`, `PluginType`
