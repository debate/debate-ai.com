/**
 * @fileoverview Group Challenges panel — the "(a) a challenge-board/creation
 * UI in `debate-card-search` that reads/writes through this store" follow-up
 * named under the "Group Challenge Persistence" bullet in TODO.md.
 *
 * Lets a coach create a squad-scoped friendly challenge (title, goal —
 * either "reach N matching contributions" or "reach N recorded wins",
 * roster, and challenge window) and lists every persisted `GroupChallenge`
 * via `state/groupChallenges.ts`'s `buildGroupChallengesPanelView`, with a
 * "Remove" action per challenge that calls the already-persisted
 * `deleteGroupChallenge` — mirroring `CoachingProgramsPanel`'s
 * create-form-plus-roster convention.
 *
 * This only manages a challenge's config — it doesn't render
 * `computeGroupChallengeProgress`'s live standings, since those need
 * caller-supplied contributions/win events that aren't persisted in a form
 * this panel could read live yet. See the remaining follow-ups in TODO.md.
 *
 * @module panels/GroupChallengesPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import {
  buildGroupChallengesPanelView,
  deleteGroupChallenge,
  saveGroupChallenge,
} from "../state/groupChallenges"
import type { ChallengeGoal, GroupChallenge } from "../lib/group-challenges"
import type { ContributionKind } from "../lib/community-rating"

type GoalKind = ChallengeGoal["kind"]

const GOAL_KIND_OPTIONS: { value: GoalKind; label: string }[] = [
  { value: "contribution_target", label: "Contribution target" },
  { value: "win_target", label: "Win target" },
]

const CONTRIBUTION_KIND_OPTIONS: { value: ContributionKind | ""; label: string }[] = [
  { value: "", label: "Any kind" },
  { value: "card", label: "Card" },
  { value: "summary", label: "Summary" },
  { value: "highlight", label: "Highlight" },
  { value: "annotation", label: "Annotation" },
  { value: "argument", label: "Argument" },
  { value: "refutation", label: "Refutation" },
]

type ChallengeDraft = {
  title: string
  memberIds: string
  goalKind: GoalKind
  targetCount: string
  contributionKind: ContributionKind | ""
  argBlock: string
  startsAt: string
  endsAt: string
}

const EMPTY_DRAFT: ChallengeDraft = {
  title: "",
  memberIds: "",
  goalKind: "contribution_target",
  targetCount: "",
  contributionKind: "",
  argBlock: "",
  startsAt: "",
  endsAt: "",
}

function describeGoal(goal: ChallengeGoal): string {
  if (goal.kind === "win_target") {
    return `Reach ${goal.targetCount} recorded win${goal.targetCount === 1 ? "" : "s"}`
  }
  const parts: string[] = []
  if (goal.target.kind) parts.push(goal.target.kind)
  if (goal.target.argBlock) parts.push(`"${goal.target.argBlock}"`)
  const matching = parts.length > 0 ? ` (${parts.join(", ")})` : ""
  return `Reach ${goal.targetCount} matching contribution${goal.targetCount === 1 ? "" : "s"}${matching}`
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString()
}

/**
 * Renders the Group Challenges panel: a form to create a squad-scoped
 * friendly challenge with a contribution- or win-based goal, plus every
 * persisted `GroupChallenge` with its roster and window, each with a
 * "Remove" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function GroupChallengesPanel() {
  const [challenges, setChallenges] = useState<GroupChallenge[] | null>(null)
  const [draft, setDraft] = useState<ChallengeDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setChallenges(buildGroupChallengesPanelView())
  }, [])

  const refresh = () => setChallenges(buildGroupChallengesPanelView())

  const handleSubmit = () => {
    const title = draft.title.trim()
    const memberIds = draft.memberIds
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
    const targetCount = Number(draft.targetCount)
    const startsAt = draft.startsAt ? new Date(draft.startsAt).getTime() : NaN
    const endsAt = draft.endsAt ? new Date(draft.endsAt).getTime() : NaN

    if (!title || memberIds.length === 0) {
      setError("A challenge title and at least one squad member are required.")
      return
    }
    if (!Number.isFinite(targetCount) || targetCount <= 0) {
      setError("Target count must be a positive number.")
      return
    }
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
      setError("Start and end dates are required, and the end date must be after the start date.")
      return
    }

    const goal: ChallengeGoal =
      draft.goalKind === "win_target"
        ? { kind: "win_target", targetCount }
        : {
            kind: "contribution_target",
            targetCount,
            target: {
              ...(draft.contributionKind ? { kind: draft.contributionKind } : {}),
              ...(draft.argBlock.trim() ? { argBlock: draft.argBlock.trim() } : {}),
            },
          }

    saveGroupChallenge({ id: `${title}-${Date.now()}`, title, goal, memberIds, startsAt, endsAt })
    setError(null)
    setDraft(EMPTY_DRAFT)
    refresh()
  }

  const handleRemove = (id: string) => {
    deleteGroupChallenge(id)
    refresh()
  }

  if (challenges === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading group challenges…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Group Challenges</h1>
        <p className="text-sm text-muted-foreground">
          Create a squad-scoped friendly challenge, like completing a set of blocks or winning a
          rebuttal exercise.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="group-challenge-title">Challenge title</Label>
            <Input
              id="group-challenge-title"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Find 20 solvency cards this week"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-challenge-members">Squad roster (comma-separated IDs)</Label>
            <Input
              id="group-challenge-members"
              value={draft.memberIds}
              onChange={(e) => setDraft((prev) => ({ ...prev, memberIds: e.target.value }))}
              placeholder="alice, bob"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Goal type</Label>
          <div className="flex gap-1">
            {GOAL_KIND_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={draft.goalKind === option.value ? "default" : "outline"}
                onClick={() => setDraft((prev) => ({ ...prev, goalKind: option.value }))}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="group-challenge-target-count">Target count</Label>
            <Input
              id="group-challenge-target-count"
              type="number"
              min={1}
              value={draft.targetCount}
              onChange={(e) => setDraft((prev) => ({ ...prev, targetCount: e.target.value }))}
              placeholder="20"
            />
          </div>
          {draft.goalKind === "contribution_target" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="group-challenge-kind">Contribution kind (optional)</Label>
                <select
                  id="group-challenge-kind"
                  value={draft.contributionKind}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, contributionKind: e.target.value as ContributionKind | "" }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CONTRIBUTION_KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="group-challenge-arg-block">Argument block (optional)</Label>
                <Input
                  id="group-challenge-arg-block"
                  value={draft.argBlock}
                  onChange={(e) => setDraft((prev) => ({ ...prev, argBlock: e.target.value }))}
                  placeholder="solvency"
                />
              </div>
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="group-challenge-starts">Starts</Label>
            <Input
              id="group-challenge-starts"
              type="date"
              value={draft.startsAt}
              onChange={(e) => setDraft((prev) => ({ ...prev, startsAt: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-challenge-ends">Ends</Label>
            <Input
              id="group-challenge-ends"
              type="date"
              value={draft.endsAt}
              onChange={(e) => setDraft((prev) => ({ ...prev, endsAt: e.target.value }))}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit}>Create challenge</Button>
      </div>

      {challenges.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No group challenges yet. Create one above to start a friendly squad challenge.
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((challenge) => (
            <div key={challenge.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">{challenge.title}</h2>
                <Button size="sm" variant="ghost" onClick={() => handleRemove(challenge.id)}>
                  Remove
                </Button>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">{describeGoal(challenge.goal)}</p>
              <p className="mb-2 text-xs text-muted-foreground">
                {formatDate(challenge.startsAt)} – {formatDate(challenge.endsAt)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {challenge.memberIds.map((memberId) => (
                  <Badge key={memberId} variant="outline">
                    {memberId}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
