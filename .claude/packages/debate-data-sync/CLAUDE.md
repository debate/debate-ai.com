# CLAUDE.md — `debate-data-sync`

Private. Bundled debate data assets — metadata, videos, schemas — plus the
scripts that sync them. Also defines shared record types such as
`OpponentTeamProfile`. Tests in `test/`.

## Two different kinds of content, two different rules

| Content | Rule |
| --- | --- |
| `data/`, `schemas/` | **Generated / bundled assets.** Excluded from coverage on purpose — they carry no logic. Do not hand-edit a synced file; change the sync script and re-run it. |
| `src/` | Real code: the sync scripts, the shared types, and `state/` |

## Rules

- **`OpponentTeamProfile` and the other shared record types are cross-package
  API.** Several packages persist and render these records; changing a field
  name is a breaking change across `debate-round`, `debate-practice-drills` and
  the app's D1 schema. Grep before you rename.
- Sync scripts hit external services (YouTube, rankings sources). They are not
  idempotent no-ops — know what a run costs and what it overwrites before
  running one.
- Bundled data ships to the client. Don't add a field to a data asset that
  isn't meant to be public.

## `src/state/` is the account sync, and it is load-bearing

Beyond the shared record types, `src/state/` holds the sync every tool's
`localStorage` store rides on. Working in here:

- **`TOOL_RECORD_COLLECTIONS` is the whole contract.** A collection in that list
  syncs — `tool-record-auto-sync.ts` watches it and needs no per-package
  wiring. That also makes a bad entry silent: a duplicated `key` merges two
  tools' account rows, and a mistyped `idField` makes every record in that
  store fail validation, so the tool keeps working locally and simply never
  syncs. `test/tool-record-catalog.test.ts` is what catches both — don't add an
  entry without checking the owning store's actual id field.
- **Keep this layer framework-free.** The route, the client and the tests all
  import `toolRecordCollections.ts`, and `sign-in-prompt.ts` is imported by tool
  packages that have no DOM in their tests. No React, no `next/*`, and no
  `fetch` outside `tool-records-client.ts`.
- **Never let a sync failure block a local write.** A mirror call returns
  immediately and swallows its error; a store applies locally first, always.
- **Never advance a snapshot past a write that did not land.** That is the one
  bug the watcher cannot have — the record would be dropped with no error
  anywhere.
