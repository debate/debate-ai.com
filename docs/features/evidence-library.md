# Shared Evidence Library

A submission form plus a free-text/kind search panel over the team-wide
evidence repository — cut cards and reusable analytic blocks — so a
contributor can add a new entry, or quickly find an existing one before
researching a duplicate.

- **Route:** `/cards/library`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t library` in Ctrl/Cmd-Shift-Space's command palette)
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

A "Check this page" box implements the "On Page Card Reuse Search" idea in
TODO.md's Product Feature Ideas list — pasting a page URL shows whether
anyone has already cut a card from it, so a contributor can skip duplicate
research.

The submission form's optional Source URL field is how an entry's
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
`searchPersistedEvidenceLibraryWithIndex` is (see below). This local check
only sees entries saved in the current browser's own `localStorage`, so it
can't answer "has anyone on the team cut this" across devices — see the
shared index below.

### Shared, server-backed reuse index + browser extension

Closes follow-up (a) under TODO.md idea #7 — "an actual browser extension
that calls this same check automatically against the current tab's URL."
`app/api/evidence-reuse-check/route.ts` is a small D1-backed API route (a
dedicated `evidence_reuse_index` table — `id`/`sourceUrl`/`normalizedUrl`/
`cite`/`argBlock`/`topic`/`contributorId`, **not** a full server-side mirror
of `EvidenceLibraryEntry`) exposing:

- `GET ?url=` — whether that URL has already been cut by anyone on the
  team, plus matches, matched by the same `normalizeSourceUrl` normalization
  as the local check.
- `POST { id, sourceUrl, cite, argBlock, topic, contributorId }` — registers
  a cut card's source URL into the shared index, upserted by `id` so
  re-registering the same entry (e.g. after an edit) doesn't duplicate.

`lib/evidence-reuse-check-client.ts`'s `checkRemotePageForExistingCards`/
`registerRemoteReuseEntry` are the fetch-based clients against that route.
`EvidenceLibraryPanel`'s "Check this page" box now calls the remote check
alongside the existing local one (rendered as a separate "Team-wide check"
section, degrading gracefully to a note if the request fails), and the
submission form registers a submitted entry's `sourceUrl` into the shared
index automatically (best-effort — a network failure doesn't block the
local save).

`apps/browser-extension` is a dependency-free Manifest V3 extension (no
bundler, not part of this repo's `bun`/`turbo` workspaces — see its own
[README](../../apps/browser-extension/README.md)) whose popup calls the same
`GET /api/evidence-reuse-check` route against the active tab's URL,
configurable to a non-production API base URL via an Options page.

## Real search index

Closes follow-up (c) named under the "📋 Shared Evidence Library" bullet in
TODO.md's Research Crowdsourcing Organizer Features list ("a real search
index (e.g. Typesense) once entries are persisted at scale"). Rather than
`searchEvidenceLibrary`'s existing keyword-overlap re-scan of every
candidate entry's full text on every call,
`lib/evidence-search-index.ts`'s `buildEvidenceSearchIndex` builds a real
token → postings-list inverted index over a set of entries once, and
`searchEvidenceLibraryWithIndex` ranks a query by looking its terms up
directly in that index — an entry sharing no term with the query is never
visited — weighting each match by TF-IDF (a term's frequency in the entry
times its inverse document frequency across the indexed corpus) instead of
a presence/absence keyword-overlap ratio, so a rarer, more distinctive term
outranks one nearly every entry shares. It's a drop-in alternative to
`searchEvidenceLibrary`: same `EvidenceSearchQuery` input and
`EvidenceSearchResult` output shape, and the same non-text filter semantics
(kind/topic/caseArea/tags).

`state/evidenceLibraryEntries.ts`'s `searchPersistedEvidenceLibraryWithIndex`
composes this against the persisted repository, added alongside —
`searchPersistedEvidenceLibrary` stays exported, unchanged, for any other
caller. Vitest-covered in
`packages/debate-card-search/test/evidence-search-index.test.ts` (index
construction, postings/term-frequency correctness, TF-IDF ranking including
a dedicated case showing a rarer term outranks a common one, every filter
combination, and candidate-set parity against `searchEvidenceLibrary` on a
shared fixture) and cases in
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts` (mirroring
`searchPersistedEvidenceLibrary`'s own test suite: peer-review gating,
empty-repository, kind filtering, empty-text-query).

`EvidenceLibraryPanel` now calls `searchPersistedEvidenceLibraryWithIndex`
instead of the original keyword-overlap search, closing this follow-up — the
panel's search box, kind filter, and topic/case-area/tags filters all read
from the indexed, TF-IDF-ranked search. That exact call shape
(`buildEvidenceSearchFormQuery`'s output fed into
`searchPersistedEvidenceLibraryWithIndex`) is Vitest-covered in
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts`.

### Cached across calls

Closes this bullet's remaining follow-up ("caching the index across calls
instead of rebuilding it on every search"). `searchPersistedEvidenceLibraryWithIndex`
no longer rebuilds `EvidenceSearchIndex` on every call —
`getCachedEvidenceSearchIndex` reuses the previously built index as long as
nothing it depends on could have changed. Which entries are "live" depends
on two independently-written stores (this store's own `EvidenceLibraryEntry`
records, and `state/peerReviews.ts`'s `CardReview` records — a review
transition can flip an entry's liveness with no write to this store at
all), so rather than a write-time counter on each store (which would only
catch writes made through that store's own functions), the cache instead
compares each store's raw persisted JSON string
(`state/peerReviews.ts`'s new `getPeerReviewsRawSnapshot`) against the
strings it was built from — a cheap fingerprint that catches any change to
either store's underlying data before doing the expensive tokenize-and-build
work again. Vitest-covered in
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts` (a repeat
call with nothing changed reuses the cached index; saving, deleting, and a
peer-review transition that flips an entry's live status each force a
rebuild whose results reflect the change) and
`packages/debate-card-search/test/peerReviews.test.ts` (`getPeerReviewsRawSnapshot`
changes on save/delete and stays stable across repeat calls with no
changes).

### Incremental indexing

Closes this bullet's last remaining "Known gap": a fingerprint change used
to trigger a full `buildEvidenceSearchIndex` re-tokenize-everything pass
over every live entry, even when a write only actually touched one of them.
`lib/evidence-search-index.ts` now exposes `addEntryToIndex`/
`removeEntryFromIndex`/`updateEntryInIndex`, each mutating an
`EvidenceSearchIndex` in place and touching only the postings lists the
affected entry itself contributes to or contributed to (tracked per-entry in
a new `entryTermsById` map on the index) — not the full vocabulary or any
other entry.

`getCachedEvidenceSearchIndex` now diffs the current live-entry set against
the exact entries (`cachedLiveEntriesById`) its cached index was last built
or updated from, by id and by content, and applies the incremental
functions only for entries that were actually added, removed, or edited:

- an id present before but not now → `removeEntryFromIndex`
- an id present now but not before → `addEntryToIndex`
- an id present in both, with different content → `updateEntryInIndex`
- an id present in both, with identical content → left untouched entirely

`buildEvidenceSearchIndex` itself is now only ever called for the very
first index build; every later fingerprint change is handled incrementally.
Vitest-covered in `packages/debate-card-search/test/evidence-search-index.test.ts`
(`addEntryToIndex` adds/replaces without duplicating postings,
`removeEntryFromIndex` drops only the removed entry's own terms while
leaving a shared term's other postings intact — including dropping a term
from the postings map entirely once its last entry is removed — and is a
no-op for an unindexed id, `updateEntryInIndex` drops stale terms and adds
new ones, and an index built purely via repeated `addEntryToIndex` calls
matches one built directly) and
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts` (each of
save/delete/peer-review-transition/edit now asserts `buildEvidenceSearchIndex`
is *not* called again and that the matching incremental function *is*,
alongside the existing result-correctness assertions).

## Peer-review gating

A search only ever returns "live" entries — see
[`review-queue.md`](./review-queue.md#gating-the-shared-evidence-library) for
how starting a [Review Queue](./review-queue.md) review on an entry's id
holds it back from `searchPersistedEvidenceLibraryWithIndex`'s results until
that review reaches `published`. `EvidenceLibraryPanel` renders any such
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
  → searchPersistedEvidenceLibraryWithIndex(query) — state/evidenceLibraryEntries.ts,
                                           filters to isEntryLive entries,
                                           then reuses
                                           lib/evidence-search-index.ts's
                                           pure buildEvidenceSearchIndex/
                                           searchEvidenceLibraryWithIndex
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

panels/EvidenceLibraryPanel.tsx ("Check this page" box, shared index)
  → checkRemotePageForExistingCards(url)   — lib/evidence-reuse-check-client.ts
      → GET /api/evidence-reuse-check?url= — app/api/evidence-reuse-check/route.ts (D1)
  → panels/EvidenceLibraryPanel.tsx        — renders the "Team-wide check" section

panels/EvidenceLibraryPanel.tsx (submission form, entry.sourceUrl set)
  → registerRemoteReuseEntry(entry)        — lib/evidence-reuse-check-client.ts
      → POST /api/evidence-reuse-check     — app/api/evidence-reuse-check/route.ts (D1 upsert)

apps/browser-extension/popup.js (active tab's URL)
  → checkPageForExistingCards(pageUrl, apiBase) — apps/browser-extension/api.js
      → GET ${apiBase}/api/evidence-reuse-check?url= — app/api/evidence-reuse-check/route.ts (D1)
```

Editing an entry derives a Revision Incentives `CardSnapshot` for the entry's
before and after state via `deriveCardSnapshotFromEntry` — reusing
`llm-card-scoring.ts`'s `scoreClarity`/`scoreUsability` for `qualitySignals`
and parsing a 4-digit year out of the citation for `evidenceYear`/
`citationCompleteness` — rather than asking the editor to separately rate
the card. `saveEvidenceLibraryEntryRevision` only records a revision when it
overwrites an existing entry id; a brand-new submission never does.

Every search/ranking rule already existed and was Vitest-covered before this
panel wired to it — `searchPersistedEvidenceLibraryWithIndex`,
`searchEvidenceLibraryWithIndex`, and `buildEvidenceSearchSummaryText` are
used directly, with no new search logic introduced; only the
`buildEvidenceSearchFormQuery` helper (narrowing the panel's five raw filter
fields into an `EvidenceSearchQuery`) is new, and is Vitest-covered in
`packages/debate-card-search/test/shared-evidence-library.test.ts`. The
panel calls the persisted indexed search with an explicit (possibly empty)
`text` field alongside optional `kind`/`topic`/`caseArea`/`tags` filters;
that exact call shape is covered in
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts`. The
submission form's only new logic is `computeWordCount` (a plain whitespace
tokenizer, Vitest-covered in
`packages/debate-card-search/test/shared-evidence-library.test.ts`), which
stamps `wordCount` from the submitted body text rather than asking the
submitter to count it themselves — this is also the field the Topic Coverage
Dashboard's `missing`/`thin`/`covered` classification scores against, so a
card submitted here now feeds that dashboard directly.

## Tag rename/merge

Closes this bullet's "No tag rename/merge tool" Known gap. The Common
Argument Library browser (`/cards/argument-library`,
`panels/ArgumentLibraryPanel.tsx`) — where the tag collections themselves
are visible — now has a "Rename/merge tag" form: pick an existing tag from a
dropdown (populated from the library's own `tagCollections`), type a new
name, and every persisted record carrying the old tag — evidence-library
entry or Contributions Feed submission alike — is rewritten to carry the new
one instead.

`lib/argument-library.ts`'s `renameTagAcrossCards` (generic over any
`LibraryCard[]`) does the rewrite: a card not carrying the old tag is
returned as the exact same object reference (so an unaffected card never
looks "changed"), and a card that already carries the target tag name has
its old tag simply dropped rather than ending up with a duplicate — a
rename into an already-used name is a merge. It throws if either tag,
trimmed, is blank, or if the two tags are the same (nothing to rename).
`renameTagInList` is the single-card-list version it builds on.

`state/evidenceLibraryEntries.ts`'s `renameTagAcrossPersistedEntries(oldTag,
newTag)` applies this against the real persisted repository, writing back
only when at least one entry actually changed (an all-no-op rename never
touches `localStorage`, so `getCachedEvidenceSearchIndex`'s raw-JSON
fingerprint isn't invalidated for nothing), and returns how many entries
changed. The panel shows that count (or a "nothing changed" message when
the tag wasn't used) after each rename.

A rename now spans **both** persisted tag stores. The browser composes its
tag collections from the evidence-library repository *and* the Contributions
Feed (via `buildCombinedPersistedArgumentLibrary`, see above), so a tag
listed there may come from either one; renaming in only one used to strand
the other's copy under the old name. `state/contributions.ts`'s
`renameTagAcrossPersistedContributions(oldTag, newTag)` mirrors
`renameTagAcrossPersistedEntries` against the Contributions Feed store
(reusing the same pure `renameTagInList` per contribution, same
write-back-only-when-changed and same blank/identical-tag throwing), and
`state/evidenceLibraryEntries.ts`'s
`renameTagAcrossCombinedPersistedStores(oldTag, newTag)` runs both and
returns `{ entriesChanged, contributionsChanged, totalChanged }`. The panel
calls that combined version and reports both counts (or a "nothing changed"
message when neither store carried the tag). Validation happens before
either store is written, so a blank or identical tag pair throws with both
stores untouched.

Vitest-covered in `packages/debate-card-search/test/argument-library.test.ts`
(`renameTagInList`/`renameTagAcrossCards`: rename across multiple cards
leaving others untouched by reference, merge-dedup into an existing tag,
no-op when the tag is unused, and throwing on a blank or identical
old/new tag) and
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
(`renameTagAcrossPersistedEntries`: rewrite-and-persist, merge, a true
no-write no-op, and throwing on a blank new tag;
`renameTagAcrossCombinedPersistedStores`: both stores rewritten with
per-store counts, one store changed while the other carries nothing, a
both-stores no-op, and a throw leaving both stores untouched) and
`packages/debate-card-search/test/contributions.test.ts`
(`renameTagAcrossPersistedContributions`: rewrite-and-persist, merge-dedup,
a true no-write no-op, and throwing on a blank or identical tag pair).

## Bulk tag editing across a filtered result set

Closes the "bulk tag editing across a filtered result set" follow-up named
under the "📋 Shared Evidence Library" bullet in TODO.md's Product Feature
Ideas list. The "Rename/merge tag" tool above rewrites one tag name into
another across the *whole* repository; this instead adds or removes one tag
across whichever specific entries a contributor has narrowed down with the
panel's own search/filter boxes and then hand-picked, without touching
anything else.

`EvidenceLibraryPanel`'s results list now has a per-entry checkbox plus a
"Select all N filtered results" checkbox above the list. Checking at least
one entry reveals a small toolbar: a tag input and "Add tag to selected"/
"Remove tag from selected" buttons. Selection is scoped to the entries
currently on screen — it's cleared whenever the search text, kind, topic,
case area, or tags filter changes, so a stale selection can never silently
reach an entry that's since scrolled out of the filtered view — and it's
cleared again after a bulk edit applies.

`lib/argument-library.ts`'s `applyBulkTagEditToCards(cards, ids, op, tag)` is
the pure rewrite, generic over any `LibraryCard[]` like
`renameTagAcrossCards`: only cards whose `id` is in `ids` are touched, and
each of those is returned as a new object only if the edit actually changes
its tag list (adding a tag already present, or removing one that's absent,
is a no-op for that card and doesn't count toward `changedCount`); every
card outside the selection comes back as the exact same object reference.
It throws if the tag, trimmed, is blank.

`state/evidenceLibraryEntries.ts`'s `bulkEditTagsForPersistedEntries(ids, op,
tag)` applies this against the real persisted repository, writing back only
when at least one entry actually changed — mirroring
`renameTagAcrossPersistedEntries`'s write-only-on-change convention, so an
all-no-op bulk edit (e.g. adding a tag every selected entry already carries)
never touches `localStorage` and never invalidates
`getCachedEvidenceSearchIndex`'s raw-JSON fingerprint for nothing. Returns
the number of entries changed.

Vitest-covered in
`packages/debate-card-search/test/argument-library.test.ts`
(`applyBulkTagEditToCards`: adding a tag to only the selected cards while
leaving others untouched by reference, skipping a card that already carries
the tag being added, removing a tag from only the selected cards that carry
it, throwing on a blank tag, and a no-op when no ids are selected) and
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
(`bulkEditTagsForPersistedEntries`: add-and-persist scoped to the selected
ids, remove across a selection, a true no-write no-op when nothing selected
changes, and throwing on a blank tag).

## Duplicate-tag merge suggestions

Closes the "nothing merges two casings already in use" half of this
bullet's tag-identity Known gap. The manual "Rename/merge tag" form above
requires a contributor to already know two casings of the same tag exist
(e.g. `warming` and `Warming`) before they think to merge them. The
Argument Library browser now surfaces that situation itself: a "Possible
duplicate tags" section lists every tag used under more than one exact
casing, with a "Merge … into …" button per variant that runs the same
`renameTagAcrossCombinedPersistedStores` call as the manual form.

`lib/argument-library.ts`'s `findTagCaseVariantGroups(collections)` scans a
library's `TagCollection[]` (already grouped by exact-string tag) for
tags whose lowercased form repeats, and groups those variants together.
Within a group, the casing carried by the most cards is treated as the
merge target and sorted first (a card-count tie breaks alphabetically); a
tag used under only one casing never appears in the result, so the section
is hidden entirely when there's nothing to merge. This only detects
casing differences already present in persisted data; a tag typed directly
into a submission form is normalized separately (see "Typed-tag
normalization" below).

Vitest-covered in
`packages/debate-card-search/test/argument-library.test.ts`
(`findTagCaseVariantGroups`: grouping case variants, most-used-first
ordering, an alphabetical tie-break, excluding single-casing tags,
multiple groups sorted by their own merge target, and an empty input).

## Tag autocomplete on the Contributions Feed

Closes this bullet's "a Contributions Feed submission tagged for the
Argument Library gets no tag-autocomplete affordance of its own" Known gap.
The Contributions Feed form (`/cards/contributions`,
`panels/ContributionsFeedPanel.tsx`) Tags field now has the same
suggestion row as the evidence-library form above, driven by the same
`parseTagsInput`/`suggestTags`/`applyTagSuggestion` helpers.

Its corpus is `state/evidenceLibraryEntries.ts`'s
`listCombinedPersistedTags()` — the union of `listPersistedTags()` (the
evidence repository) and `state/contributions.ts`'s `listContributionTags()`
(every distinct tag on a persisted contribution), deduped by exact string
and sorted. Suggesting across both stores is the point: a contribution and
an evidence entry filed under the same idea should land on the same tag
rather than two near-duplicates that the browser then shows as separate
collections. A contribution's tags count toward the corpus even when it
carries no `topic`/`caseArea` (and so is excluded from the library itself).

Vitest-covered in
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
(`listCombinedPersistedTags`: empty stores, the deduped union across both,
and a contribution excluded from the library still contributing its tags)
and `packages/debate-card-search/test/contributions.test.ts`
(`listContributionTags`: empty store, contributions carrying no tags, and
the deduped sorted list).

## Typed-tag normalization

Closes the "a tag typed directly into a submission form ... still creates a
new casing instead of being normalized to an existing one" half of the
tag-identity Known gap below.

`lib/argument-library.ts`'s `normalizeTagsToKnownCasing(tags, knownTags)`
rewrites each of `tags` to whichever casing already appears in `knownTags`,
when a case-insensitive match exists (a tag with no match is left
unchanged). Both submission forms — `EvidenceLibraryPanel`'s
(`/cards/library`) and `ContributionsFeedPanel`'s (`/cards/contributions`)
— run their comma-split tag list through this before saving, using the same
`knownTags`/corpus each form's autocomplete already reads
(`listPersistedTags()`/`listCombinedPersistedTags()`). So a contributor who
types `warming` by hand, without touching the autocomplete dropdown, still
lands on `Warming` if that's the casing already in use — the same outcome
autocomplete already gave a contributor who picked a suggestion.

Vitest-covered in
`packages/debate-card-search/test/argument-library.test.ts`
(`normalizeTagsToKnownCasing`: rewriting a typed tag to its existing
casing, leaving an unmatched tag unchanged, leaving an already-correct
casing unchanged, normalizing several tags independently, resolving a
tie by first-encountered casing when `knownTags` itself carries more than
one, and both empty-input cases).

## Known gaps

- A real inverted-index/TF-IDF search now exists, `EvidenceLibraryPanel` is
  wired to it, the built index is cached across calls, and a cache
  invalidation now updates that index incrementally instead of rebuilding it
  (see "Real search index" above) — no further follow-up remains open on
  this bullet.
- Two separate browser extensions now call the reuse check, and neither
  supersedes the other: `extension/card-reuse-checker` deep-links into this
  route's `?checkUrl=` param to run the *local* check against the active
  tab's URL (see
  [`on-page-card-reuse-search.md`](./on-page-card-reuse-search.md)), while
  `apps/browser-extension` calls the *shared* `GET /api/evidence-reuse-check`
  route (see "Shared, server-backed reuse index + browser extension" above
  and its own [README](../../apps/browser-extension/README.md)). Folding them
  into one extension that does both checks is not done.
- The shared-index extension is check-only — it doesn't register a newly-cut
  card into the shared reuse index itself (only the web app's submission
  form does that today), and its `host_permissions` only pre-authorize
  `debate-ai.com` and `localhost:3000`.
- The tag rename/merge tool now rewrites both persisted tag stores (see
  "Tag rename/merge" above) and the Contributions Feed form now has the same
  tag autocomplete as the evidence-library form (see "Tag autocomplete on
  the Contributions Feed" above) — neither gap remains open.
- Tag identity is still exact-string everywhere: `warming` and `Warming` are
  two different tags, in the library's collections and in a rename, if
  they're both already in persisted data before either form's normalization
  runs. Autocomplete *matching* is case-insensitive, a typed tag is now
  normalized to an existing casing at submit time (see "Typed-tag
  normalization" above), and the Common Argument Library browser surfaces
  and merges any case variants that still slip in — e.g. two separate
  contributors coining different casings for a genuinely new tag in the
  same window, before either casing became "known" to the other's form —
  (see "Duplicate-tag merge suggestions" above). No follow-up remains open
  on this bullet.
