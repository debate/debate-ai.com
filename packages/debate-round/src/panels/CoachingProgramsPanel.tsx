/**
 * @fileoverview Coaching Programs panel — part of the "(b) a coaching-space
 * dashboard UI" follow-up named under idea #13 ("Coaching Programs and Group
 * Challenges") in TODO.md.
 *
 * Lets a coach create a named coaching space with a squad roster (member
 * IDs) and lists every persisted `CoachingProgramConfig` via
 * `state/coachingPrograms.ts`'s `buildCoachingProgramsPanelView`, with a
 * "Remove" action per program that calls the already-persisted
 * `deleteCoachingProgram` — mirroring `PreRoundBriefingsPanel`'s
 * list-plus-clear convention. No new coaching-program logic is introduced
 * here.
 *
 * Each roster member also gets a "Practice round" field — closing follow-up
 * (c), "wiring a member's Practice Round Simulator setup/feedback into the
 * coaching space." Entering a `roundId` and saving calls
 * `state/coachingProgramMemberRounds.ts`'s `saveMemberRoundLink`; the
 * member's linked round's setup/feedback then renders inline via
 * `round/coaching-program-member-round-wiring.ts`'s
 * `buildCoachingProgramMemberRoundStatuses`, which resolves that link
 * straight through the already-persisted `state/practiceRounds.ts` store
 * (the same round a coach configures at `/practice-round`). Removing a
 * program also clears its members' links via
 * `deleteMemberRoundLinksForProgram`.
 *
 * This still doesn't render `buildCoachingProgramBoard`'s composed
 * topic-sprint/group-challenge/member-drill board, since its remaining
 * inputs (challenges, win events, and live topic-sprint contributions)
 * aren't persisted in a form this panel could read live. See the remaining
 * follow-up ((b-continued)) in TODO.md.
 *
 * @module panels/CoachingProgramsPanel
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import {
  buildCoachingProgramsPanelView,
  deleteCoachingProgram,
  saveCoachingProgram,
} from "../state/coachingPrograms"
import {
  deleteMemberRoundLink,
  deleteMemberRoundLinksForProgram,
  saveMemberRoundLink,
} from "../state/coachingProgramMemberRounds"
import {
  buildCoachingProgramMemberRoundStatuses,
  buildMemberPracticeRoundStatusText,
  type MemberPracticeRoundStatus,
} from "../round/coaching-program-member-round-wiring"
import type { CoachingProgramConfig } from "../round/coaching-program"

type ProgramDraft = { name: string; memberIds: string }

const EMPTY_DRAFT: ProgramDraft = { name: "", memberIds: "" }

/**
 * Renders the Coaching Programs panel: a form to create a named coaching
 * space with a squad roster, plus every persisted `CoachingProgramConfig`
 * with a "Remove" action and, per roster member, a practice-round link
 * field that resolves and renders that member's Practice Round Simulator
 * setup/feedback.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function CoachingProgramsPanel() {
  const [programs, setPrograms] = useState<CoachingProgramConfig[] | null>(null)
  const [draft, setDraft] = useState<ProgramDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [roundIdDrafts, setRoundIdDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setPrograms(buildCoachingProgramsPanelView())
  }, [])

  const refresh = () => setPrograms(buildCoachingProgramsPanelView())

  const handleSubmit = () => {
    const name = draft.name.trim()
    const memberIds = draft.memberIds
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
    if (!name || memberIds.length === 0) {
      setError("A program name and at least one squad member are required.")
      return
    }
    saveCoachingProgram({ id: `${name}-${Date.now()}`, name, memberIds })
    setError(null)
    setDraft(EMPTY_DRAFT)
    refresh()
  }

  const draftKey = (programId: string, memberId: string) => `${programId}:${memberId}`

  const handleLinkRound = (programId: string, memberId: string) => {
    const roundId = (roundIdDrafts[draftKey(programId, memberId)] ?? "").trim()
    if (!roundId) return
    saveMemberRoundLink({ programId, memberId, roundId })
    refresh()
  }

  const handleUnlinkRound = (programId: string, memberId: string) => {
    deleteMemberRoundLink(programId, memberId)
    setRoundIdDrafts((prev) => {
      const next = { ...prev }
      delete next[draftKey(programId, memberId)]
      return next
    })
    refresh()
  }

  const handleRemove = (id: string) => {
    deleteMemberRoundLinksForProgram(id)
    deleteCoachingProgram(id)
    refresh()
  }

  if (programs === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading coaching programs…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Coaching Programs</h1>
        <p className="text-sm text-muted-foreground">
          Create a group coaching space scoped to a squad roster, shared across research sprints,
          friendly challenges, and practice drills.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="coaching-program-name">Program name</Label>
            <Input
              id="coaching-program-name"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Varsity Squad"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coaching-program-members">Squad roster (comma-separated IDs)</Label>
            <Input
              id="coaching-program-members"
              value={draft.memberIds}
              onChange={(e) => setDraft((prev) => ({ ...prev, memberIds: e.target.value }))}
              placeholder="alice, bob"
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit}>Create program</Button>
      </div>

      {programs.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No coaching programs yet. Create one above to start a coaching space.
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((program) => (
            <div key={program.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {program.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({program.memberIds.length} member{program.memberIds.length === 1 ? "" : "s"})
                  </span>
                </h2>
                <Button size="sm" variant="ghost" onClick={() => handleRemove(program.id)}>
                  Remove
                </Button>
              </div>
              <div className="space-y-3">
                {buildCoachingProgramMemberRoundStatuses(program).map((status) => (
                  <MemberPracticeRoundRow
                    key={status.memberId}
                    programId={program.id}
                    status={status}
                    draftValue={roundIdDrafts[draftKey(program.id, status.memberId)] ?? ""}
                    onDraftChange={(value) =>
                      setRoundIdDrafts((prev) => ({ ...prev, [draftKey(program.id, status.memberId)]: value }))
                    }
                    onLink={() => handleLinkRound(program.id, status.memberId)}
                    onUnlink={() => handleUnlinkRound(program.id, status.memberId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MemberPracticeRoundRow({
  programId,
  status,
  draftValue,
  onDraftChange,
  onLink,
  onUnlink,
}: {
  programId: string
  status: MemberPracticeRoundStatus
  draftValue: string
  onDraftChange: (value: string) => void
  onLink: () => void
  onUnlink: () => void
}) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline">{status.memberId}</Badge>
        <div className="flex items-center gap-2">
          <Label htmlFor={`round-link-${programId}-${status.memberId}`} className="sr-only">
            Practice round ID
          </Label>
          <Input
            id={`round-link-${programId}-${status.memberId}`}
            value={draftValue}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={status.roundId ?? "round-1"}
            className="h-8 w-32"
          />
          <Button size="sm" variant="outline" onClick={onLink}>
            {status.roundId ? "Update" : "Link"}
          </Button>
          {status.roundId && (
            <Button size="sm" variant="ghost" onClick={onUnlink}>
              Unlink
            </Button>
          )}
        </div>
      </div>
      <p className="whitespace-pre-line text-xs text-muted-foreground">
        {buildMemberPracticeRoundStatusText(status)}
      </p>
      {status.roundId && (
        <Link href="/practice-round" className="text-xs underline text-muted-foreground">
          Manage this round in the Practice Round Simulator
        </Link>
      )}
    </div>
  )
}
