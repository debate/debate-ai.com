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

## `migrations/` — the tracked YouTube channel list in SQL

- `0001_youtube_channels.sql` creates `youtube_channels` if missing and seeds
  every handle in `src/youtube/channel-config.ts`. Adding a channel means adding
  it to **both**; the app's `youtube-channels-seed.test.ts` fails on drift.
- Applied by `.github/scripts/migrate-d1.ts` (registered in
  `PACKAGE_MIGRATION_DIRS`), once per database — so a channel added later needs
  a new `0002_…sql` seed file, not an edit to `0001`.

## `src/caselist/` — the openCaselist sync

- **The downloads page is client-rendered.** A plain GET of
  `/{slug}/downloads` returns the React shell with no archive links in it, which
  is why `fetchCaselistDownloads` tries the API, then the page, then a probe of
  the bucket's generated URLs, and reports which one answered. Do not "simplify"
  that to one source.
- **Nothing hardcodes a caselist.** `hspolicy26`, `hsld26`, `hspf26`,
  `ndtceda26` and `nfald26` all serve the same markup and the same bucket
  layout; a new season is a bump of `CURRENT_SEASON`. If you find yourself
  writing a slug into a parser, it belongs in `caselist-config.ts`.
- **DOCX conversion is `debate-card-parser`'s, not ours.** `caselist-archive.ts`
  owns only what is specific to a bulk archive — scale, provenance and partial
  failure. Don't grow a second DOCX parser here.
- **`collectDocxEntries` is the wrong tool for these archives.** It caps an
  upload at 100 files and buffers every entry at once; a season dump is
  thousands of documents and hundreds of megabytes. `loadCaselistArchive`
  streams instead. Keep it that way.
- **Provenance degrades to `null`, never to a guess.** The school, team and side
  read out of an entry path are what an ingested card is credited to.
- An archive is recorded as synced only after its ingest succeeds, so a failed
  run retries exactly that archive.

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
- **Large data goes in `bulk-storage.ts`, not `localStorage`.** Flows, rounds
  and flow history live in IndexedDB (mirrored into the browser extension's
  unlimited storage when installed); `localStorage` is for small preferences.
  Writes never throw and never surface a quota error. Its key list and message
  type are duplicated in the extension's bridge — change both together. See
  `content/docs/architecture/offline-storage.md` in `debate-help-docs`.
- **Single-object stores join through a codec.** `flowEditorDisplaySettings`
  wraps `debate-flow`'s display object as one record
  (`flow-editor-settings-codec.ts`); `flowKeymap` wraps the keymap object as one
  record per rebound action (`flow-keymap-codec.ts`). `debate-flow` itself is
  untouched. The display collection's `redact` is an **allowlist**
  (`SYNCED_FLOW_DISPLAY_FIELDS`), so a new field stays on-device until listed.
