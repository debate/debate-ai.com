# Speech Documents Cloud Save

Syncs `/speech-documents`' send-log history to a signed-in user's account,
closing the last outstanding piece of idea #17's ("User Settings —
account-linked debate preferences") "link the user DB to flows, docs, and
debates in SQL" ask: flows
([`flow-cloud-save.md`](flow-cloud-save.md)), rounds
([`round-cloud-save.md`](round-cloud-save.md)), word-count-round history,
judge-decision history, and the Reason Editor's own document content
(`documents`/`/api/doc/documents`) were all already account-linked — the
Speech Documents send log was the one exception, stuck in per-browser
IndexedDB.

- **Nav:** no new UI surface — `/speech-documents` gained a one-line
  sync-status caption under its existing description, matching
  `JudgeDecisionPanel`'s "Decision history is synced to your account."
  convention
- **Package:** `debate-editor` (`isValidSpeechSendLogEntry`
  validator, exported from its headless `/engine` entry point next to the
  existing `speechSendLogStore`), `apps/debate-ai.com`
  (`/api/speech-send-log`, `saved_speech_send_log` D1 table, `lib/
  speech-send-log-client.ts`, `lib/hooks/useSpeechSendLogSync.ts`)

## What it does

`speechSendLogStore` (`packages/debate-editor/src/editor/
speech-send-log.ts`) already recorded every card/selection sent into the
designated speech doc, in IndexedDB, cross-tab-synced via
`BroadcastChannel` — but never past one browser. `useSpeechSendLogSync`
(`apps/debate-ai.com/lib/hooks/useSpeechSendLogSync.ts`) layers a
one-time account merge plus ongoing sync on top, the same local-first shape
as `useJudgeDecisions`/`useWordCountRounds`: the store keeps working
exactly as before when signed out, and every mutation still applies
locally first.

On mount, a module-level `ensureRemoteMerged()` (deduped across multiple
mounts, mirroring `useJudgeDecisions`) fetches the account's synced entries
via `GET /api/speech-send-log`. An entry the account has but this browser
doesn't is adopted locally (`speechSendLogStore.add`); an entry this
browser has but the account doesn't is best-effort pushed up
(`PUT /api/speech-send-log/[entryId]`). Neither direction overwrites an
`id` both sides already have — a send-log entry is generated once and never
edited afterward, so there's nothing to reconcile beyond filling gaps.

Unlike `useJudgeDecisions` (synchronous `localStorage`), the store is
async and has a caller this hook doesn't control — `speech-doc-send.ts`'s
`insertSpeechSlice` calls `speechSendLogStore.add` directly on every real
send, in-window or cross-tab. Rather than plumbing an account-push call
into every one of those call sites, the sync hook instead subscribes to
the store directly (`speechSendLogStore.subscribe`) and diffs every fired
entry list against a module-level `knownSyncedIds` set, pushing anything
new. This also means a send made in a tab that never mounts
`SpeechSendLogPanel` still gets synced, as long as some tab has the hook
mounted.

`removeEntry`/`clearAll` (returned by the hook, used by the panel's
existing per-entry Trash2 button and "Clear history" button) delete
locally first, then best-effort delete the same id(s) from the account via
`DELETE /api/speech-send-log/[entryId]`.

## Known gaps

- No optimistic-concurrency handling, matching every other single-owner
  D1 sync in this repo (`flow-cloud-save.md`'s, `user-settings.md`'s
  documented gap) — not reachable in practice here, since an entry is
  generated once and never edited, only added or removed.
- An entry adopted from the account during the merge is appended via
  `speechSendLogStore.add`, which places it at the end of local insertion
  order rather than re-sorting by `sentAt` — the same accepted minor
  ordering gap as `useJudgeDecisions`'s merge. Only visible if a device
  goes offline, sends do actually happen elsewhere, and it reconnects with
  entries to adopt out of order.
- `MAX_SAVED_SPEECH_SEND_LOG_BYTES` (200,000, matching
  `MAX_SAVED_JUDGE_DECISION_BYTES`) caps one entry's synced JSON size; a
  card/selection larger than that sends locally as always but fails to
  sync, silently (best-effort, same as every other write here).
