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
  → fetchUserSettings()    — GET /api/settings; null on 401 (signed out)
  → saveUserSettings()     — PUT /api/settings, whole-field replace; throws on failure
  → saveFavoriteToolOp()   — PUT /api/settings { addFavoriteTool | removeFavoriteTool };
    resolved against the row's current favoriteTools server-side instead of
    a client-computed list — see useFavoriteTools.ts below

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
    saveFavoriteToolOp({ addFavoriteTool | removeFavoriteTool }) when signed
    in — a single op, not a whole-list saveUserSettings({ favoriteTools })
    replace, so two tabs starring different tools in quick succession don't
    race each other's addition away (see Known gaps)
  → pruneUnknown: still a whole-list saveUserSettings({ favoriteTools })
    replace — a bulk cleanup pass, not a single star/unstar
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
    normalizeThemeSettingsPatch AND normalizeFavoriteToolsPatch AND
    normalizeFavoriteToolOpPatch (a caller can patch any subset of these in
    one request). An addFavoriteTool/removeFavoriteTool op reads the row's
    current favoriteTools first and resolves the op against it via
    applyFavoriteToolOp (read-then-write, like the editorPreferences merge
    below) before serializing; a plain favoriteTools array still replaces
    the whole list as before. Then upserts (insert ... onConflictDoUpdate
    on userId)
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
vitest project wired up at all (see `apps/debate-ai.com/vitest.config.ts`'s `projects` list).

## Cross-tab live update

Closes the "every other localStorage-backed panel in this repo still has no
cross-tab live-update mechanism" Known gap noted in
[`shared-flow-sync.md`](shared-flow-sync.md), for `UserSettingsPanel` — the
last panel that bullet's closed list didn't yet cover, since (unlike every
other panel closed so far) its `form` is a live, directly-editable draft
rather than a derived list/roster view.

The browser's `storage` event never fires in the tab that made the write,
only in other same-origin tabs — before this, saving `debateStyle`/
`fontSize`/`colorTheme`/`themeMode` here, picking a color theme from
`theme-dropdown.tsx`'s dock picker, or picking a font family (also read by
this panel, though it's local-only and never synced to `/api/settings`)
left every other open `UserSettingsPanel` tab showing stale values until a
manual reload.

`UserSettingsPanel.tsx` now subscribes to `window`'s `storage` event (see
`flow/live-update.ts`'s `isUserSettingsPanelLiveUpdateStorageEvent`,
covering `settings`, `color-theme`, `theme` — next-themes' own storage key
— and `fontFamily`) and, on a match, refreshes `fontFamily` unconditionally
(it isn't Save-gated; it always applies immediately, so there's nothing to
protect) plus each `form` field *individually* — but only a field whose
current value still matches `baselineRef` (what was last loaded or saved
here), so an in-progress, not-yet-saved edit on any field is never
overwritten by another tab's change. A refreshed `colorTheme` also reapplies
the `theme-*` class on `<html>` in this tab, since that's per-tab DOM state
a `storage` event alone doesn't update (`themeMode`'s equivalent DOM effect
is already handled by next-themes' own storage listener). Saving here also
updates `baselineRef` to the just-saved values, so a field isn't treated as
"dirty" forever after a successful Save.

`state/userSettings.ts` gained `refreshLocalUserSettingsFromStorage`, which
re-reads `localStorage`'s `"settings"` key into the local `settings`
singleton (via its existing `loadFromLocalStorage`) before returning its
`debateStyle`/`fontSize` values — unlike `readLocalUserSettings`, which only
reflects whatever the singleton last loaded, and would otherwise miss
another tab's `applyUserSettingsToLocalStore` write.

Vitest-covered: `packages/debate-round/test/live-update.test.ts` (every
backing-store key, the `null`-key clear-all case, and unrelated/substring-
matching keys staying ignored, mirroring every other panel's cases in that
file) and `packages/debate-round/test/userSettings.test.ts`
(`refreshLocalUserSettingsFromStorage` picking up a value written straight
to `localStorage`, unlike `readLocalUserSettings`). The per-field
"don't stomp an unsaved edit" behavior itself has no dedicated render
test — this repo has no component-render test for any `debate-round`
panel — matching how every prior cross-tab live-update slice in this repo
was verified via its pure predicate function plus typecheck/build, not a
new render test.

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
  losing tab's own edited field(s), never corrupts the row.
  **Update:** `favoriteTools` — previously the field most exposed to this,
  since it was a whole-list replace where two tabs each starring a
  *different* tool in quick succession could have the second PUT's list
  silently drop the first tab's addition — is now fixed: `toggleFavorite`/
  `removeFavorite` (`lib/hooks/useFavoriteTools.ts`) send a single
  `{ addFavoriteTool }`/`{ removeFavoriteTool }` op
  (`round/user-settings-client.ts#saveFavoriteToolOp`) instead of a
  client-computed list, and `/api/settings`'s PUT handler resolves it
  against the row's *current* stored value with a read-then-write
  (`state/favoriteTools.ts#applyFavoriteToolOp`), mirroring how
  `editorPreferences` already merges onto its existing stored map instead
  of replacing it — see this route's own docstring. This narrows, but (like
  `editorPreferences`) doesn't fully eliminate, the underlying no-version-
  check gap this bullet describes; a whole-list `favoriteTools` PUT is still
  accepted for legitimate bulk replaces (`pruneUnknown`'s stale-favorite
  cleanup), which stays subject to the general gap above.
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
  above. A further slice picked the next specific pattern this note
  suggested: it searched for hand-rolled progress-bar markup shaped like
  `MeterBar` (a `h-2 w-full overflow-hidden rounded-full` track with an
  inner width-percentage fill) and found two, `VulnerabilityChartsPanel`'s
  "Most Exposed Arguments" bars and `WordCountRoundsPanel`'s "Word-count
  trend" bars, both now rendered with the shared `MeterBar` primitive
  instead of duplicating its markup — see the Tracker Status entry above.
  Two other hits from that same search, `SpeechWordCounter`'s in-round word
  meter (`debate-timer`) and `SpeechHeaderBar`'s speech-progress scrubber
  (`debate-round`), were deliberately left as bespoke: both are core
  round-chrome widgets (a compact popover meter and a click-to-seek
  scrubber) rather than feature-panel content, with layout constraints
  (fixed `h-1.5`/`h-[5px]` heights, `SpeechHeaderBar`'s click handler) that
  `MeterBar` isn't shaped for. A further slice picked `PanelRow` next: it
  searched for hand-rolled list rows shaped like `PanelRow` (a bordered row
  with a title/subtitle block on the left and a trailing badge/button group
  on the right — before this slice only `SharedFlowSyncPanel` and
  `FlowEditLogPanel` used any of `PanelShell`/`PanelSection`/`StatTile`/
  `Pill`/`PanelRow`) and migrated six: `PrepNoteNotificationsPanel`,
  `AiVersusRoundPanel`, `WordCountRoundsPanel`, `VulnerabilityChartsPanel`,
  `PrepNotesPanel`, and `DrillSetsPanel` — see the Tracker Status entry
  above. Four other candidates the same search surfaced were deliberately
  left alone as not a clean fit for `PanelRow`'s shape:
  `AccountNotificationsPanel` (title+subtitle wrapped in one optional
  `<Link>`, which doesn't split across `PanelRow`'s separate `title`/
  `subtitle` props), `FlowAnnotationsPanel` (a leading row of wrapping
  chips that `PanelRow`'s `truncate` title styling would clip),
  `ArgumentTreePanel` (inline `marginLeft` tree indentation with no
  title/trailing split), and `WordLimitPresetsPanel` (a single inline edit
  control, not a title/trailing block). The "bring weaker panel UIs up to
  the shared `debate-ui` primitive conventions" half of follow-up (4)
  remains open more broadly — each pass so far has searched for one
  specific pattern (undiscoverable routes, duplicated empty states,
  duplicated progress bars, duplicated list rows), not exhaustively
  compared every panel against every shared primitive (e.g.
  `PanelShell`/`PanelSection`/`StatTile`/`Pill` adoption is still
  unaudited).
  A further slice re-ran the "duplicated empty states" search across every
  package instead of just `debate-round`/`debate-practice-drills` (the
  original pass's scope) and found the exact same hand-rolled
  `<div className="p-6 text-center text-sm text-muted-foreground">…</div>`
  shape still duplicated in 21 more panels across `debate-ui`,
  `debate-practice-drills`, `debate-team-collaboration`,
  `debate-contributor-progress`, and `debate-research-evidence` (several —
  `ArgumentLibraryPanel`, `ProgressUnlocksPanel`, `PrepRoomPanel`,
  `TopicCoverageDashboardPanel` — already imported `EmptyState`/`MeterBar`
  from the same `panel-shell` module for a different empty state in the
  same file, just missed this one), and migrated all of them to
  `EmptyState`, splitting each message on its first "…yet." sentence into
  `title`/`message` the same way prior slices did, or passing a
  single-sentence/dynamic message as `title` alone when there was no clean
  split (e.g. `FeaturesPanel`'s `No features match "{query}".`). Two
  packages' matching panels — `debate-speech-writer`'s `JudgeProfilesPanel`/
  `CoachMaterialsPanel` and `debate-videos`'s `StandingsPanel` — were left
  alone: neither package depends on `debate-round` or
  `debate-research-evidence` (the two packages whose `panel-shell.tsx`
  exports `EmptyState`), so closing those would first require adding a new
  cross-package dependency edge, which is out of scope for a markup-only
  migration. `packages/debate-ui/test/features-panel.test.tsx` gained a new
  case for `FeaturesPanel`'s empty-search state (previously untested);
  matching render-test coverage for the other migrated panels was not
  added, since none of the packages they live in (`debate-practice-drills`,
  `debate-team-collaboration`, `debate-contributor-progress`,
  `debate-research-evidence`) have any pre-existing component-render test
  for these specific panels to extend — each panel's own pure-logic
  functions are already covered by that package's state/lib test suite,
  unaffected by a markup-only change, matching how the prior EmptyState
  migration slices in `debate-round`/`debate-practice-drills` were also
  verified via typecheck/build rather than new render tests.
  A further slice started on the "`PanelShell`/`PanelSection` adoption is
  still unaudited" half named above, package by package: `debate-search-evidence`
  (npm package name `debate-research-evidence`) was picked next — its 7 panels
  (`ArgumentLibraryPanel`, `CardScoringPanel`, `ContributionsFeedPanel`,
  `EvidenceLibraryPanel`, `ReviewQueuePanel`, `RevisionIncentivesPanel`,
  `TopicCoverageDashboardPanel`) all hand-rolled a top-level `<h1>`-title-
  plus-description header and none used `PanelShell`/`PanelSection` yet, and
  the primitive was already one import away (the same `./ui/panels/panel-shell`
  module each panel already imported `EmptyState`/`MeterBar` from — no new
  cross-package dependency needed). All 7 were migrated onto `PanelShell`.
  Each panel's genuinely singular, non-repeated `<h2>`-titled sub-section was
  also migrated onto `PanelSection` where one existed: `CardScoringPanel`'s
  "Bulk import"/"My score trend", `ContributionsFeedPanel`'s dynamic
  "Flagged for review (N)"/"All contributions (N)" list header,
  `EvidenceLibraryPanel`'s "Check this page"/"Team reuse dashboard"/"Pending
  review (N)", `ReviewQueuePanel`'s "Reviewer workload", and
  `RevisionIncentivesPanel`'s "Stale evidence digest"/"Leaderboard"/"Recent
  revisions". A description containing embedded markup (a `<code>` tag, or
  `ContributionsFeedPanel`'s tooltip-carrying paragraph) was kept as a plain
  child element instead of forced through `PanelShell`/`PanelSection`'s
  `description` prop, which only accepts a plain string. `ArgumentLibraryPanel`
  and `TopicCoverageDashboardPanel` had no `<h2>`-titled sub-section to
  migrate (their bordered blocks use a plain `<div>` label, not a heading),
  so only their top-level header moved onto `PanelShell`; `TopicCoverageDashboardPanel`'s
  "Cross-topic comparison"/"Coverage trend" labels use the same non-`<h2>`
  shape and were deliberately left alone for the same reason. Of the
  remaining packages named in the "roughly 45 panel files" survey above,
  `debate-team-collaboration` had an open PR against this same follow-up at
  the start of this slice (checked first to avoid duplicating work), and
  `debate-speech-writer`'s two panels (`JudgeProfilesPanel`,
  `CoachMaterialsPanel`) are blocked the same way they are for the
  `EmptyState` gap above — neither `debate-round` nor
  `debate-research-evidence` is a dependency of that package, so `PanelShell`/
  `PanelSection` aren't reachable without first adding a new cross-package
  dependency edge, out of scope for a markup-only migration. `debate-round`,
  `debate-contributor-progress`, and `debate-practice-drills` are still
  unaudited — left for a further package-scoped slice each.
