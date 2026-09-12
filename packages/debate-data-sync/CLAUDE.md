# CLAUDE.md — `debate-data-sync`

Private. Bundled debate data assets — metadata, videos, schemas — plus the
scripts that sync them. Also defines shared record types such as
`OpponentTeamProfile`. Tests in `test/`.

## Two different kinds of content, two different rules

| Content | Rule |
| --- | --- |
| `data/`, `schemas/` | **Generated / bundled assets.** Excluded from coverage on purpose — they carry no logic. Do not hand-edit a synced file; change the sync script and re-run it. |
| `src/` | Real code: the sync scripts and the shared types |

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
