# Charidh config parity — task list

Working toward **100% parity** between generated plugin configs and live server configs.

**Compare roots**

- Generated: `parity-check/generated-config/`
- Live: `parity-check/live-config/`

Add new items under **Backlog** or in the relevant plugin section as you discover more differences. Check items off when generator output matches live (or live is intentionally updated to match generated).

---

## Global

- [ ] Re-run full diff after each batch of fixes (`git diff --no-index` or your preferred YAML-aware diff).
- [ ] Document any intentional live-only overrides (if live must diverge).

---

## AdvancedAchievements (`AdvancedAchievements/config.yml`) — **done**

Live `config.yml` was replaced with the generated file → **100% parity** (source of truth: generator).

- [x] Align empty-string serialization for `BookSeparator` (`''` vs `""`) if byte parity matters.
- [x] Confirm no other semantic drift (full file diff).

---

## CommandWhitelist (`CommandWhitelist/config.yml`) — **done**

Generated output matches live under `parity-check/` → **100% parity** (source of truth: generator + `generateCWConfig`). Live no longer uses `delhome` / `sethome` / `homes` / `home`.

- [x] `discord` only when invite is set; `lore` / `guidelore` only when `serverProfileHasLore` (`electron/cwGenerator.ts`).
- [x] Leading blank line on live is cosmetic only; YAML content matches generated.

---

## ConditionalEvents (`ConditionalEvents/config.yml`) — **done**

Generated `config.yml` is what runs on live → **100% parity** (source of truth: generator). Former live-only `Config` / `Messages` entries live in the bundled reference (`reference/plugin config files/to be bundled/conditionalevents-config.yml`).

The old live-only `join_log` player `message` (updates + `/discord`) is **not** carried forward; it was not needed.

- [x] `Config.use_minimessage`, `Config.item_meta_variable_enabled`, and `Messages.eventIsNotEnabled` (and peers) covered via bundled reference + generated output.
- [x] `join_log` stays metric-only; no extra broadcast line.
- [x] YAML parity vs generator output (deployed live).

---

## LevelledMobs (`LevelledMobs/rules.yml`) — **done**

Generated `rules.yml` matches live → **100% parity** (source of truth: generator).

- [x] Confirmed no drift vs live (full diff / deploy).

---

## MyCommand (`MyCommand/commands/commands.yml`) — **done**

Generated `commands/commands.yml` is what runs on live → **100% parity** (source of truth: generator). Bundled reference: `reference/plugin config files/to be bundled/mycommand-commands.yml`.

- [x] Command block order, `/help` copy and `&` color style, and layout match deployed generated output.
- [x] No live-only header or extra blank lines required for parity.

---

## TAB (`TAB/config.yml`) — **done**

Generated output matches live under `parity-check/` → **100% parity** (source of truth: generator + bundled TAB 5.x template). Bundled: `reference/plugin config files/to be bundled/tab-config.yml`. Merge: `designs.default` header/footer, no legacy `header`/`footer`, no `use-numbers`/`static-number`, owned conditions use `true`/`false`. Discord footer line only when invite is set (same source as MyCommand / CommandWhitelist). `diffValidator` strips `designs.default` header/footer for owned-section checks.

- [x] TAB 5.x structure (`designs`, `config-version`, `components`, `channel-name-suffix`, layout `display-condition`).
- [x] Charidh scoreboards, conditions, and counts aligned with live.
- [x] Optional YAML formatting differences vs hand-edited live (indent / quoting) do not affect parity.

---

## Backlog (add todos here)

-
