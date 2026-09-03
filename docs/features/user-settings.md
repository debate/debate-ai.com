# User Settings

Gives a signed-in user a real settings page for the `debateStyle`/`fontSize`
preferences `packages/debate-round/src/state/settings.ts` already reads
throughout the flow editor, synced to their account instead of staying
stuck in one browser's localStorage — the first slice of idea #17 ("User
Settings — account-linked debate preferences") in `TODO.md`'s Product
Feature Ideas list. A second slice (follow-up (2)) extended the same
`user_settings` row and `/api/settings` route with the color-theme/
light-dark preference `components/theme-dropdown.tsx` previously kept in
`localStorage`/a cookie only. A third slice ("integrate tools into user
settings") added a `favoriteTools` field to the same row, a star toggle on
every `/tools` card, a favorites strip, and gave the settings page itself
pickers for `colorTheme`/`themeMode` (previously synced only through the
dock's separate picker) plus a "Favorite tools" management list — so a
signed-in user's preferences and starred tools both follow them across
devices, and are all reachable from one page.

- **Route:** `/settings` (app preferences, theme, and favorite tools). The
  dock's `ThemeDropdown`/`useThemeState` (`components/theme-dropdown.tsx`)
  is still the primary day-to-day color-theme/light-dark picker — `/settings`
  now has its own Color theme/Light-dark-mode pickers too (not just a
  passive sync target), so either surface can change them.
- **Nav:** the dock's gear-icon menu → "Preferences" (previously that menu
  only linked to Features/Tools/Theme/Account — it never exposed app
  preferences); the color-theme/light-dark picker is also the dock's
  existing palette icon; favorite tools can additionally be starred
  directly from `/tools`.
- **Package:** [`debate-round`](../../packages/debate-round/README.md)
  (panel + validation + the shared `/api/settings` fetch client),
  `apps/debate-ai.com` (`/api/settings`, `user_settings` D1 table,
  `components/theme-dropdown.tsx`, `lib/hooks/useFavoriteTools.ts`,
  `components/tools/FavoriteToolButton.tsx`/`FavoritesController.tsx`,
  `components/settings/FavoriteToolsSettings.tsx`, `app/tools/tool-groups.ts`)

## What it shows

A form with four pickers — Debate style, Font size, Color theme, and
Light/dark mode (the same option lists their other pickers use) — a
Save button, and a "Reset to defaults" button. A note above the form says
whether changes are syncing to the signed-in account or applying to this
browser only. Below the form, a "Favorite tools" section lists every tool
you've starred on `/tools` (icon, label, a link, and a remove button), or a
prompt to go star one if you haven't yet.

Saving always applies immediately to the local `settings` singleton
(`applyUserSettingsToLocalStore`) and, for the theme fields, the same
`localStorage`/cookie/DOM-class/`next-themes` writes
`theme-dropdown.tsx`'s `useThemeState` performs — exactly like the
pre-existing localStorage-only behavior, so a signed-out user's experience
is unchanged. When signed in, the panel additionally loads the account's
saved values on mount and pushes a save to `/api/settings` — a failed
account sync is reported inline but never blocks the local apply. Favorite
tools are separate from the Save button: starring/unstarring (from either
`/tools` or the Settings list) applies and syncs immediately, the same way
`theme-dropdown.tsx`'s dock picker does.

## Data flow

```
state/userSettings.ts (pure — no fetch, no localStorage writes except via
                        applyUserSettingsToLocalStore)
  → normalizeUserSettingsPatch(input)     — validates an untrusted patch
                                             against DEBATE_STYLE_OPTIONS/
                                             FONT_SIZE_OPTIONS (read from
                                             the local `settings` singleton)
  → applyUserSettingsToLocalStore(patch)  — writes a valid patch into the
                                             local `settings` singleton

state/themeSettings.ts (pure — no fetch, no localStorage/DOM writes)
  → THEME_NAMES/THEME_MODES                — canonical option lists;
                                              `theme-dropdown.tsx` re-exports
                                              THEME_NAMES as `themeNames`
                                              instead of keeping its own copy
  → normalizeThemeSettingsPatch(input)     — validates an untrusted patch
                                              against THEME_NAMES/THEME_MODES

state/favoriteTools.ts (pure — no fetch, no localStorage writes)
  → isValidToolHref/isValidFavoriteToolsList  — shape-only validation (an
                                                 in-app path, deduped, capped
                                                 at MAX_FAVORITE_TOOLS) —
                                                 this package doesn't know
                                                 the app's tool catalog
  → normalizeFavoriteToolsPatch(input)        — validates an untrusted patch
  → serializeFavoriteTools/parseFavoriteTools — JSON column round-trip,
                                                 tolerating malformed input

round/user-settings-client.ts (fetch — shared by every settings surface)
  → fetchUserSettings()   — GET /api/settings; null on 401 (signed out)
  → saveUserSettings()    — PUT /api/settings; throws on failure

panels/UserSettingsPanel.tsx
  → apps/debate-ai.com/app/settings/page.tsx  — mounts the panel, plus
    FavoriteToolsSettings below it, as the /settings route

components/theme-dropdown.tsx's useThemeState()
  → on mount: fetchUserSettings(); when signed in and a saved colorTheme/
    themeMode exists, applies it (localStorage + cookie + DOM class for
    colorTheme, next-themes' setTheme() for themeMode), overriding the
    local-only value read first
  → on change (handleThemeChange/toggleLightDark): applies locally first
    (unchanged from before this slice), then best-effort saveUserSettings()
    when signed in — a failed sync is silently swallowed, matching
    UserSettingsPanel's "local apply is never blocked by a sync failure"
    convention, just without the inline status badge since this is a
    background dropdown action rather than an explicit form Save

lib/hooks/useFavoriteTools.ts (app-layer — mirrors useThemeState's
                                local-first + best-effort-sync shape)
  → on mount: reads localStorage, then fetchUserSettings(); a signed-in
    user's saved favoriteTools overrides the local-only value read first
  → toggleFavorite/removeFavorite: applies to localStorage immediately,
    dispatches a same-tab `favorite-tools-changed` window event (every
    other mounted instance re-reads and stays in sync), then best-effort
    saveUserSettings({ favoriteTools }) when signed in
  → components/tools/FavoriteToolButton.tsx   — the star toggle rendered on
    every /tools card and every favorites-strip chip
  → components/tools/FavoritesController.tsx  — shows/hides the /tools
    favorites strip and its chips (no data passed as props — see its own
    header comment for why, mirrors ToolsSearch's DOM-attribute filtering),
    and prunes any stale favorite against ALL_TOOLS on load, same as
    FavoriteToolsSettings.tsx below
  → components/settings/FavoriteToolsSettings.tsx — lists/unpins favorites
    on /settings, resolving each href via app/tools/tool-groups.ts's
    ALL_TOOLS (the one place that knows the tool catalog)

apps/debate-ai.com/app/api/settings/route.ts
  → lib/database/schema.ts `userSettings` table (one row per `user.id`,
    cascade-deleted with the account; `colorTheme`/`themeMode` columns
    added by drizzle/0009_add_theme_settings.sql; `favoriteTools` added by
    drizzle/0010_add_favorite_tools.sql, stored as a JSON-array text column)
  → GET  — current user's row, or the matching DEFAULT_USER_SETTINGS/
    DEFAULT_THEME_SETTINGS/DEFAULT_FAVORITE_TOOLS value for any unset field
  → PUT  — validates via normalizeUserSettingsPatch AND
    normalizeThemeSettingsPatch AND normalizeFavoriteToolsPatch (a caller
    can patch any subset of the three concerns in one request), serializes
    a valid favoriteTools list before merging it in, then upserts
    (insert ... onConflictDoUpdate on userId)
```

Both API handlers require a session (401 without one) — unlike
`app/api/doc/documents/route.ts`, there is no anonymous/local D1 row for
settings, since the client already has a local-only fallback that needs no
server round-trip.

Vitest-covered in `packages/debate-round/test/userSettings.test.ts`,
`packages/debate-round/test/themeSettings.test.ts`, and
`packages/debate-round/test/favoriteTools.test.ts` (validation for every
valid/invalid `debateStyle`/`fontSize`/`colorTheme`/`themeMode`/
`favoriteTools` value, partial patches, malformed bodies,
`applyUserSettingsToLocalStore`'s local-store round-trip, and
`serializeFavoriteTools`/`parseFavoriteTools`'s JSON round-trip). The fetch
client, `useThemeState`'s and `useFavoriteTools`' sync wiring, and the
D1-backed route are not unit-tested, matching every other fetch-client/
D1-route pair in this repo (e.g. `round/judge-decision-client.ts`,
`app/api/evidence-reuse-check/route.ts`) — `apps/debate-ai.com` has no
vitest project wired up at all (see `vitest.config.ts`'s `projects` list).

## Known gaps

- No optimistic-concurrency handling: if the same account edits settings
  from two tabs/devices at once, the last PUT to land wins (no version
  check), matching every other single-row-per-owner upsert in this repo
  (e.g. `app/api/doc/documents/[id]/route.ts`). This is more reachable now
  than before this slice — a theme change from `useThemeState`, a
  favorite-star toggle from `useFavoriteTools`, and a `debateStyle`/
  `fontSize`/`colorTheme`/`themeMode` change from `UserSettingsPanel` can
  all PUT the same row from different tabs — but no client reads back
  another's fields before its own PUT, so a race only ever loses the
  losing tab's own edited field(s), never corrupts the row. `favoriteTools`
  is the field most exposed to this: it's a whole-list replace (see
  `state/favoriteTools.ts`), so two tabs each starring a *different* tool
  in quick succession can have the second PUT's list silently drop the
  first tab's addition, rather than merging them.
- `ThemeDropdown` (the standalone exported component in
  `theme-dropdown.tsx`, distinct from `useThemeState` the hook) is dead
  code — unused anywhere in the app, which actually renders `CategoryDock`'s
  own theme picker built on `useThemeState` — and was not updated with the
  account-sync wiring above; it still only reads/writes localStorage.
- `favoriteTools` validation is shape-only (`isValidToolHref`): the shared
  `debate-round` package has no way to check a starred `href` against the
  real `/tools` catalog, since that catalog (`app/tools/tool-groups.ts`) is
  app-specific, so `/api/settings` itself never rejects a stale href. This is
  no longer a dead end, though: both `FavoriteToolsSettings` (`/settings`)
  and `FavoritesController` (the `/tools` favorites strip) resolve each
  favorite against `ALL_TOOLS` and now both call
  `useFavoriteTools().pruneUnknown(validHrefs)` on load — backed by the pure
  `filterKnownFavoriteTools` in `state/favoriteTools.ts` — persisting the
  cleaned-up list locally and, when signed in, best-effort syncing the
  removal to the account, the same way any other favorites change does. A
  stale favorite is now pruned on the first visit to *either* page, rather
  than only `/settings`.
- The "standing tool-panel/nav UI-polish audit" idea #17 follow-up (4) named
  by prior slices is still open — this slice's star toggle/favorites strip
  overlaps with it but doesn't close it. A later slice (see
  `docs/features/flow-tools-menu.md`) added a "Tools for this round" menu
  to the round workspace and audited the `/tools` catalog for undiscoverable
  routes (finding none); a further slice (also documented in
  `flow-tools-menu.md`'s Known gaps) migrated four panels' hand-rolled
  "no data yet" placeholders to the shared `EmptyState` primitive. A later
  slice migrated 16 more `debate-round` panels (`AiVersusRoundPanel`,
  `JudgeDecisionPanel`, `PrepNoteNotificationsPanel`,
  `PracticeRoundSimulatorPanel`, `AccountNotificationsPanel`,
  `StrategyPanel`, `WordCountRoundsPanel`, `PrepNotesPanel`,
  `FlowAnnotationsPanel`, `CoachingProgramsPanel`, `DrillSetsPanel`,
  `VulnerabilityChartsPanel`, `ArgumentTreePanel`,
  `OpponentTeamProfilesPanel`, `CoachingSessionsPanel`,
  `FlowSummariesPanel`, and `PreRoundBriefingsPanel`) off the same
  hand-rolled `EmptyState`-shaped markup — see the Tracker Status entry
  above. The "bring weaker panel UIs up to the shared `debate-ui` primitive
  conventions" half of follow-up (4) remains open more broadly — each pass
  so far has searched for one specific pattern (undiscoverable routes,
  duplicated empty states), not exhaustively compared every panel against
  every shared primitive (e.g. `PanelShell`/`PanelSection`/`StatTile`/
  `MeterBar`/`Pill`/`PanelRow` adoption is still unaudited).
