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
block, and citation), a card/block kind filter, and topic/case-area/tags
filter fields, over every persisted `EvidenceLibraryEntry`. Each result also
carries **Edit** and **Delete**
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

### Argument Library browser and Contributions Feed tagging

The `/cards/argument-library` panel (`panels/ArgumentLibraryPanel.tsx`)
renders the Common Argument Library itself — topic folders, split into
case-area subgroups, plus cross-cutting tag collections — built from
`state/evidenceLibraryEntries.ts`'s `buildCombinedPersistedArgumentLibrary`.
That function now composes **two** persisted sources into one library: this
evidence-library repository, and every `state/contributions.ts` Contributions
Feed submission (`/cards/contributions`) that was tagged with a `topic` and
`caseArea`. This closes follow-up (a) under the "📚 Common Argument Library"
bullet in TODO.md — "wiring a `topic`/`caseArea`/`tags` field into wherever
submitted cards are eventually persisted beyond the existing evidence-library
store."

A Contributions Feed submission's `topic`/`caseArea`/`tags` fields are
optional; `lib/argument-library.ts`'s `contributionToLibraryCard` excludes a
submission missing `topic` or `caseArea` rather than guessing a fallback
(there's no reasonable default for either), and falls back to `"Untagged"`
for `argBlock` and `0` for `wordCount` — a contribution carries no card body
to measure a real word count from, unlike a dedicated evidence-library entry.

## On-page card reuse check

A "Check this page" box implements the first slice of the "On Page Card
Reuse Search" idea in TODO.md's Product Feature Ideas list — pasting a page
URL shows whether anyone has already cut a card from it, so a contributor
can skip duplicate research. This is the reuse check a browser extension
would eventually run automatically against the current tab's URL; no
extension exists in this repo yet, so the panel is the only caller today.

The submission form's new optional Source URL field is how an entry's
`sourceUrl` gets recorded in the first place — it's blank by default, and
existing entries persisted before this field was added simply have no
`sourceUrl` and never match a reuse check.

`lib/shared-evidence-library.ts`'s `normalizeSourceUrl` strips the scheme, a
leading `www.`, any query string/fragment, and a trailing slash before
comparing two URLs, so `https://www.example.com/article/?utm_source=x` and
`http://example.com/article` are treated as the same page.
`findEntriesBySourceUrl` finds every entry cut from the same normalized
page, and `checkPageForExistingCards` wraps that into a
`{ url, alreadyCut, matches }` result; `state/evidenceLibraryEntries.ts`'s
`checkPersistedPageForExistingCards` composes the pure check against the
persisted repository, gated to "live" entries the same way
`searchPersistedEvidenceLibrary` is (see below).

## Peer-review gating

A search only ever returns "live" entries — see
[`review-queue.md`](./review-queue.md#gating-the-shared-evidence-library) for
how starting a [Review Queue](./review-queue.md) review on an entry's id
holds it back from `searchPersistedEvidenceLibrary`'s results until that
review reaches `published`. `EvidenceLibraryPanel` renders any such
held-back entries in a separate "Pending review" section (still editable and
deletable) so a contributor doesn't lose track of a submission that's
mid-review.

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
panels/EvidenceLibraryPanel.tsx (search form: text, kind, topic, case area, tags)
  → buildEvidenceSearchFormQuery({ text, kind, topic, caseArea, tags }) — lib/shared-evidence-library.ts (pure)
      narrows the raw filter-field values (trims topic/case area, parses
      comma-separated tags) into an EvidenceSearchQuery, omitting any
      blank field so it doesn't narrow the search
  → searchPersistedEvidenceLibrary(query)  — state/evidenceLibraryEntries.ts,
                                           filters to isEntryLive entries,
                                           then reuses
                                           lib/shared-evidence-library.ts's
                                           pure searchEvidenceLibrary
  → listPendingReviewEntries()           — entries isEntryLive excludes
  → panels/EvidenceLibraryPanel.tsx      — renders results (and pending
                                           entries) as the query changes

isEntryLive(id) — state/evidenceLibraryEntries.ts
  → getPeerReview(id)                    — state/peerReviews.ts
  → isCardLive(review)                   — lib/peer-review.ts (pure)

panels/EvidenceLibraryPanel.tsx ("Check this page" box)
  → checkPersistedPageForExistingCards(url) — state/evidenceLibraryEntries.ts,
                                             filters to isEntryLive entries,
                                             then reuses
                                             lib/shared-evidence-library.ts's
                                             pure checkPageForExistingCards
      → findEntriesBySourceUrl(entries, url) — lib/shared-evidence-library.ts (pure)
          → normalizeSourceUrl(url)          — lib/shared-evidence-library.ts (pure)
  → buildPageReuseCheckSummaryText(result) — lib/shared-evidence-library.ts (pure)
  → panels/EvidenceLibraryPanel.tsx        — renders the summary plus any matching entries
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
introduced; only the new `buildEvidenceSearchFormQuery` (narrowing the
panel's five raw filter fields into an `EvidenceSearchQuery`) is new, and is
Vitest-covered in
`packages/debate-card-search/test/shared-evidence-library.test.ts`. The
panel calls the persisted search with an explicit (possibly empty) `text`
field alongside optional `kind`/`topic`/`caseArea`/`tags` filters; the
`text`+`kind` combined shape is covered in
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts`. The
submission form's only new logic is `computeWordCount` (a plain whitespace
tokenizer, Vitest-covered in
`packages/debate-card-search/test/shared-evidence-library.test.ts`), which
stamps `wordCount` from the submitted body text rather than asking the
submitter to count it themselves — this is also the field the Topic Coverage
Dashboard's `missing`/`thin`/`covered` classification scores against, so a
card submitted here now feeds that dashboard directly.

## Known gaps

- No real search index (e.g. Typesense) — search is the existing in-memory
  keyword-overlap heuristic over whatever is persisted to localStorage.
- The "Check this page" box's reuse-check logic
  (`checkPageForExistingCards`/`findEntriesBySourceUrl`/`normalizeSourceUrl`)
  now also has a real caller beyond this page: the
  `extension/card-reuse-checker` browser extension deep-links into this
  route's `?checkUrl=` param to run the same check automatically against
  the active tab's URL. See
  [`on-page-card-reuse-search.md`](./on-page-card-reuse-search.md) for the
  full writeup and the extension's own known gaps.
- No tag rename/merge tool — the Tags field's autocomplete only suggests
  reusing an existing tag while typing; renaming or merging a tag already
  applied to existing entries would mean rewriting every entry that carries
  it, and isn't implemented.
- A Contributions Feed submission tagged for the Argument Library gets no
  tag-autocomplete affordance of its own (that only exists on the dedicated
  `/cards/library` form's Tags field) — it's a plain comma-separated text
  input.
