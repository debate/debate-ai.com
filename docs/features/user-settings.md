# User Settings

The first real UI for `debate-round`'s `settingsGroups` registry
(`debateStyle`/`fontSize`, `packages/debate-round/src/state/settings.ts`),
which previously only ever changed through inline callers
(`CreateRoundDialog`, `SpeechHeaderBar`) with no dedicated page a user could
reach on its own. Also the first account-synced store outside the
`reason-editor` document persistence — a signed-in user's settings now
follow them across devices instead of staying stuck in one browser's
`localStorage`.

- **Route:** `/settings`
- **Nav:** the global dock's Settings menu → **Preferences**, and the
  `/tools` directory's Workspaces section
- **Package:** [`debate-round`](../../packages/debate-round/README.md)
  (`SettingsPanel`, `state/savedSettings.ts`, `state/settings-client.ts`,
  `hooks/useAccountSettings.ts`)
- **API:** `apps/debate-ai.com/app/api/settings/route.ts` (D1-backed via a
  new `user_settings` table, `apps/debate-ai.com/lib/database/schema.ts`)

## What it shows

Every group in `settingsGroups` (currently one group, "General", covering
Debate style and Font size) rendered as a form of Select controls, reading
and writing straight through the shared `settings` singleton so the page
stays in sync with every other caller of it in the app (e.g. changing the
debate style here also changes what `CreateRoundDialog` defaults to). A
badge at the top shows the current account-sync status: checking, synced,
"sign in to sync", or a soft failure that falls back to local-only.

## Account sync

- **GET `/api/settings`** returns `{ signedIn, data }` — `data` is `null`
  when signed out or nothing has been saved yet. Never an error: staying
  local-only is a normal, fully supported state.
- **PUT `/api/settings`** upserts the caller's whole settings map as one
  JSON blob (`{ data: { debateStyle: 1, fontSize: 14 } }`), requiring a
  session (401 otherwise) since there's no meaningful anonymous owner for
  the row.
- `useAccountSettings()` merges a remote value into the local `Settings`
  registry on mount (remote wins for any key both sides know about), then
  best-effort pushes the full local snapshot on every subsequent local
  change — local-first, so an offline or signed-out change is never lost or
  blocked, only left unsynced.
- Only each setting's primitive `value` is synced, not the whole `Setting`
  metadata object (name/options/etc.), since that's static, code-defined
  registry data rather than per-user state.

## Known gaps

- Only `"radio"`-typed settings are rendered (the only type this registry
  uses today); a `"toggle"` or `"slider"` setting added later would need a
  matching control added to `SettingsPanel`.
- The account-sync push isn't debounced. Fine for this registry's low
  change frequency (an occasional deliberate selection, not per-keystroke
  typing), but worth revisiting if a high-frequency setting is added.
