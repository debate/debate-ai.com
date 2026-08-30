# User Settings

Gives a signed-in user a real settings page for the `debateStyle`/`fontSize`
preferences `packages/debate-round/src/state/settings.ts` already reads
throughout the flow editor, synced to their account instead of staying
stuck in one browser's localStorage — the first slice of idea #17 ("User
Settings — account-linked debate preferences") in `TODO.md`'s Product
Feature Ideas list.

- **Route:** `/settings`
- **Nav:** the dock's gear-icon menu → "Preferences" (previously that menu
  only linked to Features/Tools/Theme/Account — it never exposed app
  preferences)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)
  (panel + validation), `apps/debate-ai.com` (`/api/settings`, `user_settings`
  D1 table)

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

round/user-settings-client.ts (fetch)
  → fetchUserSettings()   — GET /api/settings; null on 401 (signed out)
  → saveUserSettings()    — PUT /api/settings; throws on failure

panels/UserSettingsPanel.tsx
  → apps/debate-ai.com/app/settings/page.tsx  — mounts the panel as a route

apps/debate-ai.com/app/api/settings/route.ts
  → lib/database/schema.ts `userSettings` table (one row per `user.id`,
    cascade-deleted with the account)
  → GET  — current user's row, or DEFAULT_USER_SETTINGS for any unset field
  → PUT  — validates via the same normalizeUserSettingsPatch, then
    upserts (insert ... onConflictDoUpdate on userId)
```

Both API handlers require a session (401 without one) — unlike
`app/api/doc/documents/route.ts`, there is no anonymous/local D1 row for
settings, since the client already has a local-only fallback that needs no
server round-trip.

Vitest-covered in `packages/debate-round/test/userSettings.test.ts`
(validation for every valid/invalid `debateStyle`/`fontSize` value, partial
patches, malformed bodies, and `applyUserSettingsToLocalStore`'s
local-store round-trip). The fetch client and the D1-backed route are not
unit-tested, matching every other fetch-client/D1-route pair in this repo
(e.g. `round/judge-decision-client.ts`, `app/api/evidence-reuse-check/
route.ts`) — `apps/debate-ai.com` has no vitest project wired up at all
(see `vitest.config.ts`'s `projects` list).

## Known gaps

- Only `debateStyle`/`fontSize` are covered. The color-theme/light-dark
  preference (`components/theme-dropdown.tsx`, currently localStorage/
  cookie-only) is a natural next field for this same table but is out of
  scope here — see idea #17's follow-up (2) in `TODO.md`.
- No optimistic-concurrency handling: if the same account edits settings
  from two tabs/devices at once, the last PUT to land wins (no version
  check), matching every other single-row-per-owner upsert in this repo
  (e.g. `app/api/doc/documents/[id]/route.ts`).
