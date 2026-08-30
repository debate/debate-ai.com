# User Settings

Gives a signed-in user a real settings page for the `debateStyle`/`fontSize`
preferences `packages/debate-round/src/state/settings.ts` already reads
throughout the flow editor, synced to their account instead of staying
stuck in one browser's localStorage — the first slice of idea #17 ("User
Settings — account-linked debate preferences") in `TODO.md`'s Product
Feature Ideas list. A second slice (follow-up (2)) extended the same
`user_settings` row and `/api/settings` route with the color-theme/
light-dark preference `components/theme-dropdown.tsx` previously kept in
`localStorage`/a cookie only, so it now also follows a signed-in user
across devices.

- **Route:** `/settings` (app preferences); the color-theme/light-dark
  picker itself stays in the dock's `ThemeDropdown`/`useThemeState`
  (`components/theme-dropdown.tsx`) — this slice only makes that existing
  picker account-aware, rather than duplicating a second theme picker on
  `/settings`.
- **Nav:** the dock's gear-icon menu → "Preferences" (previously that menu
  only linked to Features/Tools/Theme/Account — it never exposed app
  preferences); the color-theme/light-dark picker is the dock's existing
  palette icon.
- **Package:** [`debate-round`](../../packages/debate-round/README.md)
  (panel + validation + the shared `/api/settings` fetch client),
  `apps/debate-ai.com` (`/api/settings`, `user_settings` D1 table,
  `components/theme-dropdown.tsx`)

## What it shows

A form with two pickers — Debate style and Font size, using the same
option lists as the local `settings` singleton — and a Save button. A note
above the form says whether changes are syncing to the signed-in account or
applying to this browser only.

Saving always applies immediately to the local `settings` singleton
(`applyUserSettingsToLocalStore`), exactly like the pre-existing
localStorage-only behavior, so a signed-out user's experience is unchanged.
When signed in, the panel additionally loads the account's saved values on
mount and pushes a save to `/api/settings` — a failed account sync is
reported inline but never blocks the local apply.

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

round/user-settings-client.ts (fetch — shared by both settings surfaces)
  → fetchUserSettings()   — GET /api/settings; null on 401 (signed out)
  → saveUserSettings()    — PUT /api/settings; throws on failure

panels/UserSettingsPanel.tsx
  → apps/debate-ai.com/app/settings/page.tsx  — mounts the panel as a route

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

apps/debate-ai.com/app/api/settings/route.ts
  → lib/database/schema.ts `userSettings` table (one row per `user.id`,
    cascade-deleted with the account; `colorTheme`/`themeMode` columns
    added by drizzle/0009_add_theme_settings.sql)
  → GET  — current user's row, or the matching DEFAULT_USER_SETTINGS/
    DEFAULT_THEME_SETTINGS value for any unset field
  → PUT  — validates via normalizeUserSettingsPatch AND
    normalizeThemeSettingsPatch (a caller can patch either or both concerns
    in one request), then upserts (insert ... onConflictDoUpdate on userId)
```

Both API handlers require a session (401 without one) — unlike
`app/api/doc/documents/route.ts`, there is no anonymous/local D1 row for
settings, since the client already has a local-only fallback that needs no
server round-trip.

Vitest-covered in `packages/debate-round/test/userSettings.test.ts` and
`packages/debate-round/test/themeSettings.test.ts` (validation for every
valid/invalid `debateStyle`/`fontSize`/`colorTheme`/`themeMode` value,
partial patches, malformed bodies, and `applyUserSettingsToLocalStore`'s
local-store round-trip). The fetch client, `useThemeState`'s sync wiring,
and the D1-backed route are not unit-tested, matching every other
fetch-client/D1-route pair in this repo (e.g. `round/judge-decision-
client.ts`, `app/api/evidence-reuse-check/route.ts`) —
`apps/debate-ai.com` has no vitest project wired up at all (see
`vitest.config.ts`'s `projects` list).

## Known gaps

- No optimistic-concurrency handling: if the same account edits settings
  from two tabs/devices at once, the last PUT to land wins (no version
  check), matching every other single-row-per-owner upsert in this repo
  (e.g. `app/api/doc/documents/[id]/route.ts`). This is more reachable now
  than before this slice — a theme change from `useThemeState` and a
  `debateStyle`/`fontSize` change from `UserSettingsPanel` both PUT the
  same row, so two tabs open to each could race — but neither client reads
  back the other's fields before its own PUT, so a race only ever loses
  the losing tab's own edited field(s), never corrupts the row.
- `ThemeDropdown` (the standalone exported component in
  `theme-dropdown.tsx`, distinct from `useThemeState` the hook) is dead
  code — unused anywhere in the app, which actually renders `CategoryDock`'s
  own theme picker built on `useThemeState` — and was not updated with the
  account-sync wiring above; it still only reads/writes localStorage.
