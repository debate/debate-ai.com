# Shared Evidence Library

A free-text/kind search panel over the team-wide evidence repository — cut
cards and reusable analytic blocks — so a contributor can quickly find
existing evidence or a block before researching a duplicate.

- **Route:** `/cards/library`
- **Nav:** the global dock's Settings menu → **Evidence Library**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

A search box (matched against an entry's full-text body, argument block, and
citation) plus a card/block kind filter, over every persisted
`EvidenceLibraryEntry`:

| Field | Source |
| --- | --- |
| Argument / kind | `entry.argBlock`, `entry.kind` (`card` or `block`) |
| Topic / case area | `entry.topic`, `entry.caseArea` |
| Body | `entry.text` |
| Citation | `entry.cite` (blank for a `block`) |
| Tags | `entry.tags` |
| Relevance | `relevanceScore`, shown only while a text query is active |

## Data flow

```
state/evidenceLibraryEntries.ts (localStorage: evidenceLibraryEntries)
  → searchPersistedEvidenceLibrary({ text, kind }) — reuses
                                           lib/shared-evidence-library.ts's
                                           pure searchEvidenceLibrary directly
  → panels/EvidenceLibraryPanel.tsx      — renders results as the query changes
```

Every search/ranking rule already existed and was Vitest-covered before this
panel — `searchPersistedEvidenceLibrary`, `searchEvidenceLibrary`, and
`buildEvidenceSearchSummaryText` are used directly, with no new lib/state
logic introduced. The panel calls the persisted search with an explicit
(possibly empty) `text` field alongside an optional `kind` filter; that exact
combined shape is covered in
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts`.

## Known gaps

- No submission UI yet — the repository only fills in once something calls
  `saveEvidenceLibraryEntry` some other way (e.g. a future card/block submit
  flow).
- No topic/case-area/tag filter controls in the panel itself — only free
  text and kind are exposed; the underlying `searchEvidenceLibrary` already
  supports `topic`, `caseArea`, and `tags`.
- No real search index (e.g. Typesense) — search is the existing in-memory
  keyword-overlap heuristic over whatever is persisted to localStorage.
