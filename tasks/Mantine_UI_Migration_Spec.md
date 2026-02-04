# Mantine UI Migration — Specification

## Purpose

Migrate the MC Plugin Manager frontend from ad-hoc inline styles and raw HTML form elements to **Mantine** (v7) so that:

- UI is consistent, accessible, and maintainable.
- Styling is centralized via theme and components instead of repeated inline objects.
- Future screens and features can be built on a shared design system.

This spec defines scope, setup, component mapping, and a phased migration order.

---

## Scope

- **In scope**: All renderer UI in `src/` (App, screens, shared layout). Mantine is used only in the React/Vite renderer; Electron main process and config generation logic are unchanged.
- **Out of scope**: Changing app behavior, API contracts, or Electron preload/main code. This is a UI/library migration only.

### Current UI Surface

| Area | Files | Patterns to replace |
|------|--------|----------------------|
| App shell | `App.tsx` | Container, layout |
| Server list | `ServerProfilesScreen.tsx` | Title, text input, buttons, list/cards, loading |
| Server detail | `ServerDetailScreen.tsx` | Back button, title, stats grid, tabs, content area |
| Import | `ImportScreen.tsx` | Buttons, file inputs, result alerts, cards |
| Onboarding | `OnboardingScreen.tsx` | Form inputs, number inputs, select, buttons, alerts |
| Build | `BuildScreen.tsx` | Checkboxes, collapsible, path inputs, Browse buttons, validation alert, result banner, build report (grids, lists), past builds list |
| Global | `index.css` | Reset, body, #root, button/input inheritance |

---

## Core Principles

1. **Incremental migration**: Introduce Mantine at the root, then migrate screen-by-screen so the app stays runnable after each step.
2. **One source of truth**: Use Mantine theme (and optional CSS variables) for colors, spacing, and typography; avoid duplicating magic values in components.
3. **Preserve behavior**: No change to state logic, IPC calls, or user flows; only replace presentational markup and styles.
4. **Electron-friendly**: Rely on Mantine’s default DOM/CSS; no assumptions about a browser environment beyond what Electron’s renderer provides.

---

## Mantine Setup

### 1) Dependencies

- Add packages (use Mantine v7; compatible with React 18 and Vite 5):

  - `@mantine/core` – components and theme
  - `@mantine/hooks` – optional; use if adopting `useDisclosure`, `useForm`, etc.

- Peer dependency (required by Mantine):

  - `react-dom`

Existing stack: React 18, Vite 5, TypeScript 5 — no conflict.

### 2) Provider and global styles

- In `main.tsx` (or `App.tsx`), wrap the app in `MantineProvider`.
- Use `MantineProvider`’s `theme` prop to set primary color, fontFamily, defaultRadius, etc., so the app looks coherent and “tool-like” rather than generic.
- Enable `withNormalizeCSS` so Mantine’s reset applies; coordinate with existing `index.css` (either remove redundant reset in `index.css` or keep only body/#root/electron-specific rules that don’t conflict).

### 3) Vite

- No special Vite config is required for Mantine v7; standard Vite + React setup is sufficient.
- If tree-shaking is a concern, import only needed components (e.g. `import { Button } from '@mantine/core'`) and avoid barrel imports that pull the whole library.

### 4) TypeScript

- Mantine v7 ships with TypeScript types; no extra `@types` needed. Ensure `moduleResolution` and JSX settings in `tsconfig.json` remain compatible with the existing project.

---

## Component Mapping

Map current patterns to Mantine components so migration is consistent across screens.

| Current pattern | Mantine component(s) | Notes |
|-----------------|----------------------|--------|
| Page container / max-width | `Container`, `Stack` | Use `Container` for max-width and padding, `Stack` for vertical sections. |
| Headings | `Title`, `Text` | Replace raw `<h1>`/`<h2>` with `Title order={1|2}` or `Text` for subtitles. |
| Paragraph / hint | `Text size="sm" c="dimmed"` | Replace inline `color: '#666'` and small font. |
| Primary button | `Button` | Replace inline padding/background/cursor; use `variant="filled"` (default). |
| Secondary / ghost button | `Button variant="light"` or `variant="default"` | e.g. “Back”, “Browse”. |
| Disabled loading button | `Button loading={isBuilding}` | Removes need for manual disabled + opacity. |
| Text input (single line) | `TextInput` | Placeholder, value, onChange; use for server name, path displays (read-only via `readOnly`). |
| Number input | `NumberInput` | For onboarding X/Y/Z coordinates. |
| Checkbox | `Checkbox` | BuildScreen plugin list; use `label` prop for accessibility. |
| Tabs | `Tabs` | ServerDetailScreen Import / Onboarding / Build. |
| Collapsible section | `Collapse` + `UnstyledButton` or `Accordion` | BuildScreen “Custom config file overrides”. |
| Success/error message | `Alert` with `color="green"` / `color="red"` | Import result, build result, validation errors. |
| Card / panel | `Paper` or `Card` | Stats block, build report, past builds, import sections. |
| Stats grid (label + value) | `SimpleGrid` + `Text` | Server detail stats, build report region counts and computed counts. |
| List of items | `Stack` + `Button` (unstyled or variant) or `List` | Past builds list; server list. |
| Spacing between sections | `Stack gap="md"` / `gap="lg"` | Replace `marginBottom: '2rem'` etc. with consistent gap. |
| Flex row (e.g. input + button) | `Group` | Path row, server name + Create button. |
| Required field indicator | `Text span c="red"` or `InputLabel` with required indicator | Output directory “*”. |

### Optional (later)

- **Notifications**: `@mantine/notifications` for toast-style feedback instead of (or in addition to) inline alerts.
- **Modals**: If you add confirmation dialogs, use `Modal` from `@mantine/core`.

---

## Theming and CSS Strategy

- **Theme**: Define a single theme in `MantineProvider` (e.g. `theme={{ primaryColor: 'blue', defaultRadius: 'sm' }}`). Optionally create a `theme.ts` that re-exports `createTheme` or a custom theme object for reuse.
- **Colors**: Use semantic names where possible (e.g. `theme.colors.blue[6]` for primary, Mantine’s `red`/`green` for error/success). Replace hardcoded hexes in BuildScreen and other screens with theme-driven props (e.g. `Alert color="red"`).
- **index.css**: After migration, keep only:
  - Any Electron-specific or `#root` rules that don’t conflict with Mantine’s normalize.
  - Optional global overrides (e.g. font-family) if not fully driven by Mantine theme.
- Remove redundant resets that `withNormalizeCSS` already provides, to avoid fighting the library.

---

## Phased Migration Order

Execute in order so the app always runs and the diff stays reviewable.

1. **Phase 1 – Foundation**
   - Add `@mantine/core` (and optionally `@mantine/hooks`).
   - Wrap app in `MantineProvider` in `main.tsx` (or `App.tsx`), with a minimal theme and `withNormalizeCSS`.
   - Adjust `index.css` so it doesn’t conflict (remove or reduce reset; keep body/root if needed).

2. **Phase 2 – App shell**
   - Update `App.tsx` to use `Container` and/or `Stack` for layout so the shell uses Mantine spacing and width.

3. **Phase 3 – ServerProfilesScreen**
   - Replace layout, title, text input, buttons, and server list with Mantine components. Establishes patterns (e.g. `Group`, `Stack`, `Button`, `TextInput`, `Paper`/cards) for other screens.

4. **Phase 4 – ServerDetailScreen**
   - Replace back button, title, stats grid, and tabs with Mantine (`Tabs`, `SimpleGrid`, `Paper`, `Title`, `Text`). Keep tab content as-is for now (they’re full screens).

5. **Phase 5 – ImportScreen**
   - Replace buttons, file-path display, result message, and section layout with Mantine (`Button`, `TextInput` read-only, `Alert`, `Stack`/`Paper`).

6. **Phase 6 – OnboardingScreen**
   - Replace form layout, inputs (including number inputs and select for region ID), buttons, and save status with Mantine components.

7. **Phase 7 – BuildScreen**
   - Replace plugin checkboxes, collapsible overrides, output dir row, validation alert, build button, result banner, build report (grids and lists), and past builds list. This is the largest screen; consider extracting subcomponents (e.g. `BuildReportCard`) during the migration to keep files readable.

8. **Phase 8 – Cleanup**
   - Remove unused inline style objects and any dead CSS from `index.css`. Optionally introduce a small set of shared constants or theme overrides if anything still needs to be centralized.

---

## Acceptance Criteria

- [ ] App runs under Electron and in browser (Vite dev) with no console errors from Mantine.
- [ ] All existing user flows work: create server, select server, import overworld/nether, edit onboarding, run build, view result and report, switch past builds.
- [ ] No visual regressions that would block a release (layout and hierarchy preserved or improved; colors/spacing consistent).
- [ ] No remaining raw `<button>`/`<input>` for form-like UI except where Mantine doesn’t provide a substitute (e.g. file input may remain native if Mantine is not used for it).
- [ ] Global styles live in `index.css` or Mantine theme only; no one-off inline style objects for layout/spacing/colors that duplicate theme values.
- [ ] Documentation: README or a short “UI” note updated to mention Mantine and how to run the app.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-------------|
| Bundle size increase | Use tree-shaking; import only needed components; measure bundle before/after. |
| Normalize vs existing CSS | Run with `withNormalizeCSS` and fix any layout/override issues in Phase 1. |
| Electron renderer quirks | Test file dialogs, focus, and keyboard nav after each phase in Electron. |
| Over-migration | Limit Phase 1 to provider + minimal layout; migrate screen-by-screen so each step is shippable. |

---

## References

- [Mantine v7 docs](https://mantine.dev/)
- [Mantine + Vite](https://mantine.dev/guides/vite/)
- [MantineProvider and theme](https://mantine.dev/theming/mantine-provider/)
- Current UI: `src/App.tsx`, `src/screens/*.tsx`, `src/index.css`
