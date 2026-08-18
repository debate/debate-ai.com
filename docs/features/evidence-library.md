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
`EvidenceLibraryEntry`. Each result also carries **Edit** and **Delete**
actions: Edit loads the entry back into the submission form (now labeled
"Editing entry …") for revision, and — since editing asks for the editor's
contributor ID — saving records the edit as a scored `CardRevisionRecord`
feeding the Revision Incentives leaderboard (see
[`revision-incentives.md`](./revision-incentives.md)); Delete removes the
entry outright. A `card` result whose citation is stale (no parseable year,
or `STALE_EVIDENCE_THRESHOLD_YEARS`+ years old) also carries a "Stale
evidence" badge, via `getEvidenceStaleness` (see
[`revision-incentives.md`](./revision-incentives.md)).

| Field | Source |
| --- | --- |
| Argument / kind | `entry.argBlock`, `entry.kind` (`card` or `block`) |
| Topic / case area | `entry.topic`, `entry.caseArea` |
| Body | `entry.text` |
| Citation | `entry.cite` (blank for a `block`) |
| Tags | `entry.tags` |
| Relevance | `relevanceScore`, shown only while a text query is active |

The submission form's Tags field also suggests existing tags as the
contributor types: `lib/argument-library.ts`'s `suggestTags` ranks the
persisted tag corpus (via `state/evidenceLibraryEntries.ts`'s
`listPersistedTags`) against the in-progress fragment after the last comma,
prefix matches first, excluding tags already added to the field. Clicking a
suggestion appends it and leaves a trailing `", "` to keep typing — this
closes follow-up (c), "a tag-autocomplete/tag-management affordance," under
the "📚 Common Argument Library" bullet in TODO.md.

## Data flow

```
panels/EvidenceLibraryPanel.tsx (submission form)
  → computeWordCount(text)                — lib/shared-evidence-library.ts (pure)
  → saveEvidenceLibraryEntry(entry)        — state/evidenceLibraryEntries.ts (new entry)
  → saveEvidenceLibraryEntryRevision(entry, contributorId) — state/evidenceLibraryEntries.ts (edit)
      → buildEvidenceEntryRevision(before, after, contributorId) — lib/shared-evidence-library.ts (pure)
          → deriveCardSnapshotFromEntry(entry) — lib/shared-evidence-library.ts (pure)
      → saveRevisionRecord(record)         — state/revisionHistory.ts
  → deleteEvidenceLibraryEntry(id)         — state/evidenceLibraryEntries.ts (delete)
state/evidenceLibraryEntries.ts (localStorage: evidenceLibraryEntries)
  → searchPersistedEvidenceLibrary({ text, kind }) — reuses
                                           lib/shared-evidence-library.ts's
                                           pure searchEvidenceLibrary directly
  → panels/EvidenceLibraryPanel.tsx      — renders results as the query changes
```

Editing an entry derives a Revision Incentives `CardSnapshot` for the entry's
before and after state via `deriveCardSnapshotFromEntry` — reusing
`llm-card-scoring.ts`'s `scoreClarity`/`scoreUsability` for `qualitySignals`
and parsing a 4-digit year out of the citation for `evidenceYear`/
`citationCompleteness` — rather than asking the editor to separately rate
the card. `saveEvidenceLibraryEntryRevision` only records a revision when it
overwrites an existing entry id; a brand-new submission never does.

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
- No real search index (e.g. Typesense) — search is the existing in-memory
  keyword-overlap heuristic over whatever is persisted to localStorage.
- No tag rename/merge tool — the Tags field's autocomplete only suggests
  reusing an existing tag while typing; renaming or merging a tag already
  applied to existing entries would mean rewriting every entry that carries
  it, and isn't implemented.
