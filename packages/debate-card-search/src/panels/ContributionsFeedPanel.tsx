/**
 * @fileoverview Contributions Feed panel — closes follow-up (a) named under
 * both the "Contribution Leaderboard" bullet ("a real submitted-contribution
 * flow (and a like/save/endorse UI) that actually calls
 * `saveContribution`/`recordPersistedLike`/`recordPersistedSave`/
 * `recordPersistedEndorsement`") and idea #11 "Community-Rated Summaries and
 * Highlights" ("a real like/save/endorse UI that calls the now-persisted
 * actions above") in TODO.md.
 *
 * Lets a contributor submit a new `AttributedContribution`, then renders
 * every persisted contribution via `state/contributions.ts`'s
 * `buildPersistedContributionFeed`, ranked by helpfulness score, with
 * Like/Save/Endorse actions wired to the already-persisted
 * `recordPersistedLike`/`recordPersistedSave`/`recordPersistedEndorsement`.
 * No new scoring logic is introduced here — this only wires the existing
 * idea #11 helpfulness scoring and Contribution Leaderboard persistence to a
 * per-contribution feed UI.
 *
 * A submitted contribution starts with a neutral `qualitySignals: [0.5]`
 * placeholder, since no automated quality scorer is wired into this
 * submission form yet — see follow-up (b) in TODO.md. An "Endorse" action
 * now records an endorsement via `recordPersistedEndorsementFromReviewer`,
 * which derives the endorsement's weight from the typed-in reviewer's own
 * persisted contribution history rather than a fixed placeholder — closing
 * idea #11's follow-up (b) ("a real reviewer-credibility system instead of
 * a caller-supplied weight per endorsement").
 *
 * Also surfaces each entry's `isPopularityOnlyOutlier` flag (computed by the
 * existing `community-rating.ts` scoring), closing the leaderboard-panel
 * half of idea #11's follow-up (c) — moderators can see which contributions
 * are popularity-driven directly in the feed.
 *
 * Every submission now stamps `submittedAt: Date.now()` and an optional
 * `argBlock`, closing a gap discovered while wiring the "🎯 Daily Quests and
 * Targets" quest board (`state/dailyQuests.ts`): `lib/daily-quests.ts`,
 * `state/dailyMissionResults.ts`, and `lib/group-challenges.ts` all key off
 * a contribution's `submittedAt`/`argBlock`, but nothing here ever set
 * them, so those features were permanently starved of real data. Existing
 * contributions saved before this change remain without those fields —
 * every downstream reader already treats them as optional/filterable
 * rather than required.
 *
 * The submission form now also takes optional `topic`/`caseArea`/`tags`
 * fields, closing follow-up (a) named under the "📚 Common Argument Library"
 * bullet in TODO.md ("wiring a `topic`/`caseArea`/`tags` field into wherever
 * submitted cards are eventually persisted beyond the existing
 * evidence-library store"). A submission that fills in both `topic` and
 * `caseArea` is picked up by `ArgumentLibraryPanel` via
 * `state/evidenceLibraryEntries.ts`'s `buildCombinedPersistedArgumentLibrary`.
 *
 * The submission form now also takes an optional "Content" body-text field,
 * stamping `AttributedContribution.wordCount` via `shared-evidence-library.ts`'s
 * `computeWordCount` — the same helper `EvidenceLibraryPanel` uses — closing
 * follow-up (a) named under the "📊 Topic Coverage Dashboard" bullet in
 * TODO.md ("an `argBlock`/word-count field wired into a real
 * card-submission flow beyond the existing `/cards/library` evidence-library
 * form"). A contribution that fills in both `topic` and `argBlock` alongside
 * this content field is now picked up by
 * `state/trackedArguments.ts`'s `buildPersistedTopicCoverageReport` as a
 * second real coverage-card source, alongside the evidence library.
 *
 * @module panels/ContributionsFeedPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  buildPersistedContributionFeed,
  recordPersistedEndorsementFromReviewer,
  recordPersistedLike,
  recordPersistedSave,
  saveContribution,
  type ContributionFeedEntry,
} from "../state/contributions"
import type { ContributionKind } from "../lib/community-rating"
import { computeWordCount } from "../lib/shared-evidence-library"

const KIND_OPTIONS: { value: ContributionKind; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "summary", label: "Summary" },
  { value: "highlight", label: "Highlight" },
  { value: "annotation", label: "Annotation" },
]

const KIND_VARIANT: Record<ContributionKind, "default" | "secondary" | "outline"> = {
  card: "default",
  summary: "secondary",
  highlight: "outline",
  annotation: "outline",
}

type ContributionDraft = {
  contributorId: string
  kind: ContributionKind
  argBlock: string
  topic: string
  caseArea: string
  tags: string
  content: string
}

const EMPTY_DRAFT: ContributionDraft = {
  contributorId: "",
  kind: "card",
  argBlock: "",
  topic: "",
  caseArea: "",
  tags: "",
  content: "",
}

/**
 * Renders the Contributions Feed: a form to submit a new contribution, plus
 * every persisted `AttributedContribution` ranked by helpfulness score, with
 * Like/Save/Endorse actions per entry.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function ContributionsFeedPanel() {
  const [feed, setFeed] = useState<ContributionFeedEntry[] | null>(null)
  const [draft, setDraft] = useState<ContributionDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [reviewerId, setReviewerId] = useState("")
  const [endorseError, setEndorseError] = useState<string | null>(null)

  useEffect(() => {
    setFeed(buildPersistedContributionFeed())
  }, [])

  const refresh = () => setFeed(buildPersistedContributionFeed())

  const handleSubmit = () => {
    const contributorId = draft.contributorId.trim()
    if (!contributorId) {
      setError("Contributor ID is required.")
      return
    }
    const argBlock = draft.argBlock.trim()
    const topic = draft.topic.trim()
    const caseArea = draft.caseArea.trim()
    const tags = draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    const content = draft.content.trim()
    saveContribution({
      id: `${draft.kind}-${contributorId}-${Date.now()}`,
      contributorId,
      kind: draft.kind,
      likes: 0,
      saves: 0,
      qualitySignals: [0.5],
      reviewerEndorsements: [],
      submittedAt: Date.now(),
      ...(argBlock ? { argBlock } : {}),
      ...(topic ? { topic } : {}),
      ...(caseArea ? { caseArea } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(content ? { wordCount: computeWordCount(content) } : {}),
    })
    setError(null)
    setDraft(EMPTY_DRAFT)
    refresh()
  }

  const handleLike = (id: string) => {
    recordPersistedLike(id)
    refresh()
  }

  const handleSave = (id: string) => {
    recordPersistedSave(id)
    refresh()
  }

  const handleEndorse = (id: string) => {
    const trimmedReviewerId = reviewerId.trim()
    if (!trimmedReviewerId) {
      setEndorseError("Reviewer ID is required to endorse.")
      return
    }
    setEndorseError(null)
    recordPersistedEndorsementFromReviewer(id, trimmedReviewerId)
    refresh()
  }

  if (feed === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading contributions feed…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Contributions Feed</h1>
        <p className="text-sm text-muted-foreground">
          Submit a contribution, then like, save, or endorse the community's cards, summaries,
          highlights, and annotations — ranked by blended helpfulness score.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contribution-contributor">Contributor ID</Label>
            <Input
              id="contribution-contributor"
              value={draft.contributorId}
              onChange={(e) => setDraft((prev) => ({ ...prev, contributorId: e.target.value }))}
              placeholder="alice"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <div className="flex flex-wrap gap-1">
              {KIND_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={draft.kind === option.value ? "default" : "outline"}
                  onClick={() => setDraft((prev) => ({ ...prev, kind: option.value }))}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contribution-argblock">Argument block (optional)</Label>
            <Input
              id="contribution-argblock"
              value={draft.argBlock}
              onChange={(e) => setDraft((prev) => ({ ...prev, argBlock: e.target.value }))}
              placeholder="Solvency"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contribution-topic">Topic (optional)</Label>
            <Input
              id="contribution-topic"
              value={draft.topic}
              onChange={(e) => setDraft((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="Resolved: ..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contribution-casearea">Case area (optional)</Label>
            <Input
              id="contribution-casearea"
              value={draft.caseArea}
              onChange={(e) => setDraft((prev) => ({ ...prev, caseArea: e.target.value }))}
              placeholder="Aff, Neg, DA, CP, K, T..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contribution-tags">Tags (optional, comma-separated)</Label>
            <Input
              id="contribution-tags"
              value={draft.tags}
              onChange={(e) => setDraft((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="warming, uniqueness"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contribution-content">Content (optional)</Label>
          <Textarea
            id="contribution-content"
            value={draft.content}
            onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="Paste the card, summary, or highlight text here..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">{computeWordCount(draft.content)} words</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Filling in both Topic and Case area also files this contribution into the Common
          Argument Library. Filling in both Argument block and Content also counts this
          contribution toward the Topic Coverage Dashboard.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit}>Submit contribution</Button>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="contribution-reviewer">Reviewer ID (for endorsing)</Label>
          <Input
            id="contribution-reviewer"
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
            placeholder="bob"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          An endorsement's weight is drawn from the reviewer's own contribution track record, not a
          fixed amount.
        </p>
        {endorseError && <p className="text-sm text-destructive">{endorseError}</p>}
      </div>

      {feed.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No contributions yet. Submit one above to start the feed.
        </div>
      ) : (
        <div className="space-y-2">
          {feed.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={KIND_VARIANT[entry.kind]} className="capitalize">
                  {entry.kind}
                </Badge>
                <span className="font-medium text-foreground">{entry.contributorId}</span>
                <span className="text-xs text-muted-foreground">
                  helpfulness {entry.helpfulnessScore}
                </span>
                {entry.isPopularityOnlyOutlier && (
                  <Badge variant="destructive">Popularity-only</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{entry.likes} likes</span>
                <span>{entry.saves} saves</span>
                <span>{entry.reviewerEndorsements.length} endorsements</span>
              </div>
              {(entry.topic || entry.caseArea || (entry.tags && entry.tags.length > 0)) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {entry.topic && <Badge variant="outline">{entry.topic}</Badge>}
                  {entry.caseArea && <Badge variant="outline">{entry.caseArea}</Badge>}
                  {entry.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleLike(entry.id)}>
                  Like
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleSave(entry.id)}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleEndorse(entry.id)}>
                  Endorse
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
