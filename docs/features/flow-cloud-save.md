# Flow Cloud Save

Lets a signed-in user save an individual flow to their account and load it
back on any device they sign in on — the "flows" half of idea #17's
follow-up (3) ("design and migrate specific already-localStorage-only
stores that make sense as account-linked data onto D1, most notably
`useFlowStore`'s `rounds`/`flows`") in `TODO.md`'s Product Feature Ideas
list. `rounds` are not migrated by this slice — see Known gaps.

- **Nav:** `FlowHistoryDialog` (opened from the "Debate Round History"
  action) gained a "Saved to account" tab alongside "Rounds"; each flow
  chip under a round in the "Rounds" tab also gained a small cloud-upload
  icon
- **Package:** [`debate-round`](../../packages/debate-round/README.md)
  (dialog + validation + fetch client), `apps/debate-ai.com` (`/api/flows`,
  `saved_flows` D1 table)

## What it does

Clicking a flow's cloud icon in the "Rounds" tab PUTs that one flow (the
whole `Flow` object — its `Box` tree plus `speechDocs`/`sharedSpeeches`) to
the account, keyed by the flow's local `id`; re-clicking it after an edit
upserts the same row rather than duplicating it. The "Saved to account" tab
lists every flow saved this way (label + last-saved time, without needing
to fetch each row's full data) with a Load button (fetches the full flow
and either replaces the local flow of the same `id` or appends it, then
switches to it) and a Remove button (deletes the cloud copy only — the
local flow is untouched).

A signed-out user sees a "Sign in to save flows to your account" message in
the "Saved to account" tab instead of a fetch attempt; the per-flow cloud
icon still exists but its save PUT fails with a handled inline error state
(no local behavior is ever blocked by this — everything works exactly as
before this slice for a signed-out user, matching `user-settings`'
precedent).

## Data flow

```
state/savedFlows.ts (pure — no fetch)
  → isValidFlow(value)          — structural validator for an untrusted
                                   Flow (required fields + recursive Box
                                   tree, capped at 200 levels deep)
  → deriveFlowLabel(flow)       — "Speech N" / truncated content fallback,
                                   mirrors FlowHistoryDialog's own label logic

round/saved-flows-client.ts (fetch)
  → listSavedFlows()   — GET /api/flows; null on 401 (signed out)
  → fetchSavedFlow(id) — GET /api/flows/:clientId; null on 401/404
  → saveFlowToAccount(flow)  — PUT /api/flows/:clientId; throws on failure
  → deleteSavedFlow(id)      — DELETE /api/flows/:clientId; throws on failure

dialogs/FlowHistoryDialog.tsx
  → "Rounds" tab's per-flow cloud icon    → saveFlowToAccount
  → "Saved to account" tab                → listSavedFlows / fetchSavedFlow /
                                             deleteSavedFlow

apps/debate-ai.com/app/api/flows/route.ts
  → GET  — list current user's saved-flow summaries (clientId/label/
    updatedAt only — no data blob), newest first

apps/debate-ai.com/app/api/flows/[clientId]/route.ts
  → lib/database/schema.ts `saved_flows` table (one row per (user, flow),
    unique on (user_id, client_id), cascade-deleted with the account)
  → GET     — the full saved Flow for this clientId, or 404
  → PUT     — validates via isValidFlow (clientId must match flow.id, and
    the serialized flow must be under 2 MB), derives the label server-side,
    then upserts (insert ... onConflictDoUpdate on (userId, clientId))
  → DELETE  — removes the row
```

All three handlers require a session (401 without one) — same as
`/api/settings` and unlike `app/api/doc/documents/route.ts`'s anonymous-row
mode, since a saved flow only exists once explicitly synced to an account;
there is no local-only fallback that needs a matching anonymous D1 row.

Vitest-covered in `packages/debate-round/test/savedFlows.test.ts` (28
cases: valid/malformed flows including every required field individually
missing, malformed `Box` descendants at every nesting depth, the 200-level
recursion cap, and every `deriveFlowLabel` branch). The fetch client and
the D1-backed routes are not unit-tested, matching every other fetch-client/
D1-route pair in this repo (`round/user-settings-client.ts`,
`app/api/settings/route.ts`) — `apps/debate-ai.com` has no vitest project
wired up (see `vitest.config.ts`'s `projects` list).

## Known gaps

- `rounds` (the tournament/debaters/judges wrapper around a set of flows)
  are not migrated by this slice — only individual flows. Modeling a saved
  round (and its relationship to its saved flows) needs its own schema
  design, per idea #17's follow-up (3) note in `TODO.md`.
- No bulk "save this round's flows" action — each flow is saved one at a
  time via its own cloud icon.
- No optimistic-concurrency handling: the same account editing and saving
  the same flow from two tabs/devices at once has the last PUT win, same
  as `user-settings`'s documented gap.
- Saved-flow storage isn't currently surfaced or capped per account beyond
  the 2 MB per-flow size limit enforced in the PUT route.
