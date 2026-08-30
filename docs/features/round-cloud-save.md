# Round Cloud Save

Lets a signed-in user save a whole round (the tournament/debaters/judges
wrapper around a set of flows) to their account and load it back on any
device they sign in on — idea #17's follow-up (3)/(b) ("migrate rounds
themselves... needs its own schema design for how a saved round should
reference its saved flows") in `TODO.md`'s Product Feature Ideas list, the
"rounds" half of the same follow-up
[`flow-cloud-save.md`](flow-cloud-save.md) closed the "flows" half of.

- **Nav:** `FlowHistoryDialog`'s "Rounds" tab gained a cloud-upload icon
  next to each round's existing "Edit round details" button, plus "Save all
  rounds" and "Save flows not in a round" buttons above the list; its
  "Saved to account" tab gained a "Rounds" section below the existing
  "Flows" section
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

The "Rounds" tab's "Save all rounds" button (only rendered once at least
one local round exists) saves every local round — and, transitively, every
flow any of them references — to the account in one action, so a user
doesn't have to click each round's own cloud icon individually. It first
collects the deduplicated set of flows across all rounds
(`state/bulkRoundSave.ts`'s `collectFlowsForRounds` — a flow shared by more
than one round, or listed twice within the same round's `flowIds`, is only
ever `PUT` once) and saves those, then saves every round; both passes
update the same per-flow/per-round cloud-icon status the individual save
buttons already render, so a round's or flow's icon updates in place
exactly as if it had been saved on its own. Best-effort per item — one
flow or round failing to save doesn't stop the others — and a short
summary ("Saved 6 rounds." / "Saved 4, 2 failed.") appears next to the
button once the pass finishes.

The "Rounds" tab's "Save flows not in a round" button (only rendered once
at least one locally-available flow exists that no round references)
closes the remaining half of the same gap: a flow never attached to any
round had no bulk path at all before this, only its own per-flow cloud
icon. It collects that set via `state/bulkRoundSave.ts`'s
`collectUnreferencedFlows` (every local flow whose id no round's `flowIds`
lists) and saves each one, showing the count in its own label (e.g. "Save
flows not in a round (3)") and its own best-effort summary once the pass
finishes — a separate action from "Save all rounds" since it covers a
disjoint set of flows and touches no round.

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
state/bulkRoundSave.ts (pure — no fetch)
  → collectFlowsForRounds(rounds, flows)     — dedups the flows referenced by
                                                any round in `rounds`, in
                                                first-referencing-round order
  → collectUnreferencedFlows(rounds, flows)  — every local flow no round
                                                references, in `flows`' own
                                                order
  → summarizeBulkSaveOutcomes(outcomes)      — { savedCount, errorCount } from
                                                a per-item (round or flow)
                                                outcome map

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
  → "Rounds" tab's per-round cloud icon      → saveFlowToAccount (per referenced
                                                flow) then saveRoundToAccount
  → "Rounds" tab's "Save flows not in a round" → saveFlowToAccount (per
                                                  collectUnreferencedFlows result)
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
120-character truncation) and `packages/debate-round/test/
bulkRoundSave.test.ts` (18 cases: `collectFlowsForRounds`'s empty-input,
single-round, cross-round dedup, within-round duplicate-id dedup, and
missing-local-flow-skip cases; `collectUnreferencedFlows`'s no-rounds,
no-flows, referenced/unreferenced split across one and several rounds,
all-referenced, order-preservation, and missing-local-flow cases;
`summarizeBulkSaveOutcomes`'s empty/mixed/all-saved/all-error counts). The
fetch client, the D1 route, and the dialog's
save/load/remove wiring are not unit-tested, matching every other
fetch-client/D1-route/UI trio in this repo — `apps/debate-ai.com` still has
no vitest project wired up (`vitest.config.ts`'s `projects` list is still
`["packages/*"]` only).

## Known gaps

- Closed: a later, unrelated merge (`7ace3bf`, "Move CardMirror's General/
  Appearance/Accessibility settings to /settings") resolved a stale merge
  conflict by resurrecting a dead, pre-`saved_rounds` `rounds` table/route
  pair from an earlier abandoned branch and deleting this feature's actual
  `savedRounds` schema export and `/api/rounds/[clientId]/route.ts` — every
  save/load/delete-round-to-account call started 404ing, and `GET
  /api/rounds` silently listed from the wrong (unused, always-empty) table,
  even though three further feature slices ("Save all rounds", "Save flows
  not in a round", the round delete button) shipped on top of the by-then
  already-broken client in the following days without anyone rerunning a
  live save/load smoke check against the actual API route. The same commit
  also generated an orphaned, never-journaled migration
  (`0011_curious_human_cannonball.sql`) that overwrote `meta/0011_snapshot.
  json` with the wrong (post-regression) schema shape, corrupting
  `drizzle-kit generate`'s diff baseline for any future migration. Restored
  `savedRounds`/`SavedRoundRow` in `schema.ts`, restored both route files
  verbatim, removed the resurrected `rounds` table, restored the correct
  `0011_snapshot.json`, and regenerated a properly journaled
  `0012_add_editor_preferences.sql` for the one legitimate schema change
  the orphaned file carried (the `editor_preferences` column the CardMirror-
  settings-in-`/settings` feature needs) — `drizzle-kit generate` now
  reports exactly that single-column diff against the corrected baseline.
  No data loss: `saved_rounds` itself was never dropped by the regression,
  only the app's ability to read/write it.
- Saving a round cascade-saves its flows, but there's no reverse indicator
  in the "Flows" section of the cloud tab showing which flows got saved as
  a side effect of a round save (they just appear there like any
  individually-saved flow).
- "Save all rounds" and "Save flows not in a round" both save every item
  unconditionally, even one already saved and unchanged since — there's no
  per-round/per-flow dirty tracking to skip an item that doesn't need
  re-saving, so a large round or flow list means a full re-`PUT` of
  everything on every click.
- No optimistic-concurrency handling, matching `flow-cloud-save.md`'s and
  `user-settings.md`'s documented gap.
- Closed: `FlowHistoryDialog`'s "Rounds" tab now has a delete (Trash2)
  button on each round row, wired to the store's `deleteRound(id)` behind a
  confirm prompt. Deleting a round only removes it from this browser — any
  cloud-saved copy of the round is untouched (same split as the "Saved to
  account" tab's own remove button, in reverse), and the round's flows are
  never deleted, only unreferenced (they remain reachable, and become
  eligible for "Save flows not in a round" if not already cloud-saved).
  Fixed a latent bug found while adding this: `createRound` generated a
  round's `id` from a bare `Date.now()`, so two rounds created within the
  same millisecond collided — `updateRound`/`deleteRound` would then match
  every round sharing that id instead of just one. `createRound` now
  advances past any id already in use. Vitest-covered in
  `packages/debate-round/test/flowStoreRounds.test.ts` (`createRound`/
  `updateRound`/`deleteRound`, including the id-collision regression case
  and confirming `deleteRound` never touches `flows`).
