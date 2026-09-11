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
