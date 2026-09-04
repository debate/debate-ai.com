# Revision Incentives

Rewards contributors for improving weak cards, strengthening citations, and refreshing stale
evidence, and ranks them by total reward points earned.

- **Route:** `/cards/revisions`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t revision` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

| Column | Source |
| --- | --- |
| Rank | Position in `buildRevisionIncentiveLeaderboard`'s sort order (total reward points, descending) |
| Contributor | `contributorId` |
| Revisions | Count of persisted revision records attributed to that contributor |
| Rewarded | Count of those revisions that earned a nonzero reward |
| Reward points | Sum of every revision's reward points |
| Weak cards improved | Count of revisions that improved a card that was weak beforehand |

A revision earns points from three signals (`lib/revision-incentives.ts`): a quality-score gain
(doubled if the card was weak beforehand), a meaningful citation-completeness gain, and citing
newer evidence than the prior snapshot — reusing the existing idea #11 `community-rating.ts`
quality scoring.

Independently of any revision, `lib/revision-incentives.ts`'s `computeEvidenceStaleness` flags a
citation year as stale once it's `STALE_EVIDENCE_THRESHOLD_YEARS` (3) years old or older — or has
no parseable year at all — as of the current year. `lib/shared-evidence-library.ts`'s
`getEvidenceStaleness`/`getStaleEvidenceEntries` compose that directly against an
`EvidenceLibraryEntry`'s parsed `evidenceYear`, and the Shared Evidence Library panel (see
[`evidence-library.md`](./evidence-library.md)) renders a "Stale evidence" badge on any stale
`card` result — so a contributor sees which cards need a refresh before submitting a revision,
not only after.

## Stale evidence digest

`RevisionIncentivesPanel` also renders a **Stale evidence digest** section above the leaderboard:
every persisted stale `card` entry, ranked most-urgent first (an undated citation before every
dated one — its evidence could be any age — then oldest-cited first, ties broken by argument
block name), each row showing its argument block, topic/case area, cite, and age, plus a link into
the Evidence Library to revise it. This is the proactive counterpart to the leaderboard below: it
surfaces which cards need a refresh *before* a revision happens, rather than only rewarding one
after the fact.

`lib/shared-evidence-library.ts`'s pure `buildStaleEvidenceDigest(entries, currentYear)` builds the
ranked list from `getStaleEvidenceEntries` directly; `state/evidenceLibraryEntries.ts`'s
`buildPersistedStaleEvidenceDigest(currentYear)` composes it against the persisted evidence library
store. When nothing is stale, the panel shows an empty-state message instead of the table.

## Before/after revision diff viewer

`RevisionIncentivesPanel` also renders a **Recent revisions** section below the leaderboard: the
20 most recently recorded revisions, newest first, each with a "View diff" toggle. Expanding a row
shows a word-level before/after comparison of that revision's argument block, cut text, and
citation — only the fields that actually changed are shown.

This is possible because `saveEvidenceLibraryEntryRevision` (`state/evidenceLibraryEntries.ts`)
now captures each side's plain diffable text — `lib/revision-text-diff.ts`'s
`buildEvidenceEntryTextSnapshot(entry)` — onto the persisted `CardRevisionRecord`'s new
`beforeText`/`afterText` fields, alongside the scored `CardSnapshot` `evaluateRevision` already
used. `state/revisionHistory.ts`'s `getRevisionTextDiff(record)` composes those two snapshots
through the pure `buildCardRevisionTextDiff`, which diffs `argBlock`, `text`, and `cite`
independently via a word-level LCS diff (mirroring `debate-round`'s `flow/flow-edit-diff.ts`
algorithm, reimplemented here since the two packages share no dependency). A revision recorded
before this field existed — or one built from a caller-supplied `CardRevision` with no source
entry to read text from — has no captured snapshot, so `getRevisionTextDiff` returns `null` and
the panel shows "No before/after text was captured for this revision" instead of a diff. A very
long card (beyond `MAX_DIFF_TOKENS`, 6000 tokens) falls back to a coarse whole-field removed/added
pair rather than risking an oversized word-by-word comparison.

## Data flow

```
panels/EvidenceLibraryPanel.tsx (Edit action, /cards/library)
  → saveEvidenceLibraryEntryRevision(entry, contributorId) — state/evidenceLibraryEntries.ts
      → buildEvidenceEntryRevision(before, after, contributorId) — lib/shared-evidence-library.ts (pure)
          → deriveCardSnapshotFromEntry(entry) — lib/shared-evidence-library.ts (pure)
      → buildEvidenceEntryTextSnapshot(entry) (before + after) — lib/revision-text-diff.ts (pure)
      → saveRevisionRecord(record)         — state/revisionHistory.ts (localStorage)
state/revisionHistory.ts (localStorage)
  → buildPersistedRevisionIncentiveLeaderboard()   — lib/revision-incentives.ts
  → listRecentRevisionHistory(20) + getRevisionTextDiff(record)
      → buildCardRevisionTextDiff(beforeText, afterText) — lib/revision-text-diff.ts (pure)
  → panels/RevisionIncentivesPanel.tsx (renders the leaderboard + recent-revisions diff viewer)
  → apps/debate-ai.com/app/cards/revisions/page.tsx (mounts the panel as a route)
```

Every scoring/aggregation rule already existed and was Vitest-covered; this feature is a
read-only composition and rendering layer over that store — it introduces one new function,
`buildPersistedRevisionIncentiveLeaderboard`, which composes the existing pure
`buildRevisionIncentiveLeaderboard` directly against the persisted revision-history store (see
`packages/debate-card-search/test/revisionHistory.test.ts`). The stale evidence digest is the
same pattern applied to `getStaleEvidenceEntries`: `buildStaleEvidenceDigest` (pure) composed
against the persisted evidence library store by `buildPersistedStaleEvidenceDigest`.

The Shared Evidence Library's Edit action (see
[`evidence-library.md`](./evidence-library.md)) is the real card-edit/save flow: editing an
existing `EvidenceLibraryEntry` derives a before/after `CardSnapshot` pair via
`deriveCardSnapshotFromEntry` (reusing `llm-card-scoring.ts`'s `scoreClarity`/`scoreUsability` for
`qualitySignals`, and a parsed citation year for `evidenceYear`/`citationCompleteness`) and records
it as a `CardRevisionRecord`, so this leaderboard now reflects real edits rather than only
caller-supplied snapshots.

## Cross-tab live update

`RevisionIncentivesPanel` now subscribes to the browser's `storage` event —
fired only in *other* same-origin tabs, never the one that made the write —
via `state/live-update.ts`'s `isRevisionIncentivesLiveUpdateStorageEvent`
(true for the panel's `"revisionHistory"` and `"evidenceLibraryEntries"` keys,
or a `null` key from `localStorage.clear()`). When it fires, the panel
rebuilds both its leaderboard (`buildPersistedRevisionIncentiveLeaderboard()`)
and its stale-evidence digest (`buildPersistedStaleEvidenceDigest()`), so a
revision recorded — or a card edited — in another tab shows up here without a
manual reload. This closes `shared-flow-sync.md`'s "Every other
localStorage-backed panel in this repo still has no cross-tab live-update
mechanism" Known gap for this panel. Vitest-covered in
`packages/debate-card-search/test/live-update.test.ts`.

## Known gaps

None open on this bullet.
