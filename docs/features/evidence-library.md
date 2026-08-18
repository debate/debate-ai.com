# Shared Evidence Library

A submission form plus a free-text/kind search panel over the team-wide
evidence repository — cut cards and reusable analytic blocks — so a
contributor can add a new entry, or quickly find an existing one before
researching a duplicate.

- **Route:** `/cards/library`
- **Nav:** the global dock's Settings menu → **Evidence Library**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

A submission form (kind, topic, case area, argument block, citation,
comma-separated tags, and a body text area with a live word-count readout),
plus a search box (matched against an entry's full-text body, argument
block, and citation) and a card/block kind filter, over every persisted
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
panels/EvidenceLibraryPanel.tsx (submission form)
  → computeWordCount(text)                — lib/shared-evidence-library.ts (pure)
  → saveEvidenceLibraryEntry(entry)        — state/evidenceLibraryEntries.ts
state/evidenceLibraryEntries.ts (localStorage: evidenceLibraryEntries)
  → searchPersistedEvidenceLibrary({ text, kind }) — reuses
                                           lib/shared-evidence-library.ts's
                                           pure searchEvidenceLibrary directly
  → panels/EvidenceLibraryPanel.tsx      — renders results as the query changes
```

Every search/ranking rule already existed and was Vitest-covered before this
panel — `searchPersistedEvidenceLibrary`, `searchEvidenceLibrary`, and
`buildEvidenceSearchSummaryText` are used directly, with no new search logic
introduced. The panel calls the persisted search with an explicit (possibly
empty) `text` field alongside an optional `kind` filter; that exact combined
shape is covered in
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts`. The
submission form's only new logic is `computeWordCount` (a plain whitespace
tokenizer, Vitest-covered in
`packages/debate-card-search/test/shared-evidence-library.test.ts`), which
stamps `wordCount` from the submitted body text rather than asking the
submitter to count it themselves — this is also the field the Topic Coverage
Dashboard's `missing`/`thin`/`covered` classification scores against, so a
card submitted here now feeds that dashboard directly.

## Known gaps

- No topic/case-area/tag filter controls in the search half of the panel —
  only free text and kind are exposed; the underlying `searchEvidenceLibrary`
  already supports `topic`, `caseArea`, and `tags`.
- No edit/delete affordance in the panel — `deleteEvidenceLibraryEntry` and
  overwrite-by-id already exist in `state/evidenceLibraryEntries.ts`, but
  nothing in the UI calls them yet.
- No real search index (e.g. Typesense) — search is the existing in-memory
  keyword-overlap heuristic over whatever is persisted to localStorage.
