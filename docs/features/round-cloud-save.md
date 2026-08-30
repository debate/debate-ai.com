# Round Cloud Save

Lets a signed-in user save a whole round (the tournament/debaters/judges
wrapper around a set of flows) to their account and load it back on any
device they sign in on — idea #17's follow-up (3)/(b) ("migrate rounds
themselves... needs its own schema design for how a saved round should
reference its saved flows") in `TODO.md`'s Product Feature Ideas list, the
"rounds" half of the same follow-up
[`flow-cloud-save.md`](flow-cloud-save.md) closed the "flows" half of.

- **Nav:** `FlowHistoryDialog`'s "Rounds" tab gained a cloud-upload icon
  next to each round's existing "Edit round details" button; its "Saved to
  account" tab gained a "Rounds" section below the existing "Flows" section
- **Package:** [`debate-round`](../../packages/debate-round/README.md)
  (dialog + validation + fetch client), `apps/debate-ai.com` (`/api/rounds`,
  `saved_rounds` D1 table)

## What it does

A `Round` (`packages/debate-core/src/types/flow.ts`) only ever references
its flows indirectly, via `flowIds: number[]` — the local `Flow.id`s in
`useFlowStore`'s `flows` array. A saved round keeps that same indirection
rather than embedding the flows themselves, so saving a round to the
account also saves each of its flows that exist locally (reusing the same
per-flow save call `flow-cloud-save.md` documents) before saving the round
— otherwise a round loaded on another device would have no flows to
resolve `flowIds` against.

Clicking a round's cloud icon in the "Rounds" tab therefore: saves every
flow the round currently references (best-effort — a flow that fails to
save doesn't block the others or the round itself), then PUTs the round
itself, keyed by its local `id`; re-clicking it after an edit upserts the
same row rather than duplicating it.

The "Saved to account" tab's new "Rounds" section lists every round saved
this way (label + last-saved time) with a Load button and a Remove button
(deletes the cloud copy only — the local round and its flows are
untouched). Loading a saved round upserts it into the local rounds list
(replacing the local round of the same `id` if one exists, or appending
it), resolves its `flowIds` against the account's saved flows — merging in
whichever of them aren't already present locally, and simply skipping any
that were never saved to the account — then switches to the round's flows,
same as clicking a round in the "Rounds" tab.

A signed-out user sees the same "Sign in to save flows to your account"
message in the "Saved to account" tab as before (it now covers both
sections); the per-round cloud icon still exists but its save fails with a
handled inline error state, matching `flow-cloud-save.md`'s precedent.

## Data flow

```
state/savedRounds.ts (pure — no fetch)
  → isValidRound(value)          — structural validator for an untrusted
                                    Round (required fields + shape checks on
                                    every optional field when present)
  → deriveRoundLabel(round)      — formatted title, or "Tournament - Round
                                    Level" fallback

round/saved-rounds-client.ts (fetch)
  → listSavedRounds()    — GET /api/rounds; null on 401 (signed out)
  → fetchSavedRound(id)  — GET /api/rounds/:clientId; null on 401/404
  → saveRoundToAccount(round)  — PUT /api/rounds/:clientId; throws on failure
  → deleteSavedRound(id)       — DELETE /api/rounds/:clientId; throws on failure

dialogs/FlowHistoryDialog.tsx
  → "Rounds" tab's per-round cloud icon  → saveFlowToAccount (per referenced
                                            flow) then saveRoundToAccount
  → "Saved to account" tab's Rounds section → listSavedRounds / fetchSavedRound /
                                               deleteSavedRound

apps/debate-ai.com/app/api/rounds/route.ts
  → GET  — list current user's saved-round summaries (clientId/label/
    updatedAt only — no data blob), newest first

apps/debate-ai.com/app/api/rounds/[clientId]/route.ts
  → lib/database/schema.ts `saved_rounds` table (one row per (user, round),
    unique on (user_id, client_id), cascade-deleted with the account)
  → GET     — the full saved Round for this clientId, or 404
  → PUT     — validates via isValidRound (clientId must match round.id, and
    the serialized round must be under 200 KB), derives the label
    server-side, then upserts (insert ... onConflictDoUpdate on
    (userId, clientId))
  → DELETE  — removes the row
```

All three handlers require a session (401 without one) — same as
`/api/flows` and `/api/settings` — since a saved round only exists once
explicitly synced to an account; there is no local-only fallback that
needs a matching anonymous D1 row.

Vitest-covered in `packages/debate-round/test/savedRounds.test.ts` (32
cases: every required field individually missing, every optional field's
shape when present and malformed, every `status`/`winner` value including
an unknown one, and every `deriveRoundLabel` branch including the
120-character truncation). The fetch client, the D1 route, and the dialog's
save/load/remove wiring are not unit-tested, matching every other
fetch-client/D1-route/UI trio in this repo — `apps/debate-ai.com` still has
no vitest project wired up (`vitest.config.ts`'s `projects` list is still
`["packages/*"]` only).

## Known gaps

- Saving a round cascade-saves its flows, but there's no reverse indicator
  in the "Flows" section of the cloud tab showing which flows got saved as
  a side effect of a round save (they just appear there like any
  individually-saved flow).
- No bulk "save all my rounds" action — each round is still saved one at a
  time via its own cloud icon.
- No optimistic-concurrency handling, matching `flow-cloud-save.md`'s and
  `user-settings.md`'s documented gap.
- There is still no UI for deleting a *local* round (`useFlowStore`'s
  `deleteRound` exists but has no caller anywhere in the app) — only the
  cloud copy can be removed from this dialog.

## Removed: a second, broken round-persistence path

A pre-existing, unrelated commit (`9c6373c`, merged before this feature's own
idea #17 slices) had already added a *different* round-persistence path: a
`rounds` D1 table (`id`/`title`/`format`/`data`, no `saved_rounds`-style
`(user, client_id)` upsert key), a `useRoundsCloudSync` hook that
auto-pushed every round/flow change to `/api/rounds` with a 500ms debounce,
a `RoundSyncStatus` badge mounted on `/debate`, and a `/api/rounds/[id]`
route. Nobody reconciled the two when this feature's own `/api/rounds` (list)
and `/api/rounds/[clientId]` routes landed alongside it — the result was a
broken build (`vinext`/Next.js rejects two dynamic segments with different
slug names, `[id]` vs `[clientId]`, under the same `/api/rounds` path) and,
independent of that, a hook that could never have worked: there was no
`POST /api/rounds` handler for it to call, and its `GET /api/rounds`
hydration read `{ id, title, format }` while the real route (this feature's)
returns `{ clientId, label, updatedAt }`. Its `rounds`/duplicate
`user_settings` migration (`0007_rapid_dragon_man.sql`) was also never
registered in `drizzle/meta/_journal.json` or any snapshot, so
`drizzle-kit generate` had no record of it existing.

Since this feature's opt-in, per-round cloud-save UI already covers the same
need — deliberately, per the "no auto-sync" rationale in
`flow-cloud-save.md` — the dead path was deleted outright rather than
reconciled: `lib/hooks/useRoundsCloudSync.ts`,
`components/layout/RoundSyncStatus.tsx`, `app/api/user/settings/`,
`app/api/rounds/[id]/`, the old `rounds`/first `user_settings` table
definitions in `lib/database/schema.ts`, and the orphaned
`0007_rapid_dragon_man.sql`/`0010_worthless_raza.sql` migration files (the
latter was this feature's own `saved_rounds` migration — also never
registered in the journal; replaced with a freshly `drizzle-kit generate`d
`0011_careful_cardiac.sql` that is). `app/tools/MySavedItems.tsx` (which
lists a signed-in user's saved rounds via `GET /api/rounds`) was fixed to
read the real `{ clientId, label, updatedAt }` shape instead of the dead
path's `{ id, title, updatedAt }` — it had been silently rendering
"Untitled Round" for every saved round.
