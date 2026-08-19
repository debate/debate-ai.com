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
 * This only manages a program's config (name + roster) and each roster
 * member's assigned Practice Round Simulator round — it doesn't render
 * `buildCoachingProgramBoard`'s composed topic-sprint/group-challenge/
 * member-drill board yet, since those inputs (challenges, win events, and
 * contributions) aren't persisted in a form this panel could read live. See
 * the remaining follow-ups in TODO.md.
 *
 * The per-member practice-round assignment closes the "(c) wiring a
 * member's practice-round setup/feedback (Practice Round Simulator) into
 * the space" follow-up: an "Assign round" control per roster member reads
 * and writes through `state/coachingProgramMemberRounds.ts`, and every
 * member with a resolvable assignment renders their round's setup text (and
 * feedback text, once generated) via
 * `buildCoachingProgramMemberPracticeRoundsFromStores`. No new
 * setup/feedback composition logic is introduced here — a round is still
 * configured at `/practice-round` (Practice Round Simulator).
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
  buildCoachingProgramMemberPracticeRoundsFromStores,
  clearMemberPracticeRound,
  getMemberRoundIds,
  setMemberPracticeRound,
} from "../state/coachingProgramMemberRounds"
import type { CoachingProgramMemberPracticeRoundView } from "../round/coaching-program-practice-rounds"
import type { CoachingProgramConfig } from "../round/coaching-program"

type ProgramDraft = { name: string; memberIds: string }

const EMPTY_DRAFT: ProgramDraft = { name: "", memberIds: "" }

/**
 * Renders the Coaching Programs panel: a form to create a named coaching
 * space with a squad roster, plus every persisted `CoachingProgramConfig`
 * with a "Remove" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function CoachingProgramsPanel() {
  const [programs, setPrograms] = useState<CoachingProgramConfig[] | null>(null)
  const [draft, setDraft] = useState<ProgramDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [memberRoundDrafts, setMemberRoundDrafts] = useState<Record<string, string>>({})
  const [memberPracticeRounds, setMemberPracticeRounds] = useState<
    Record<string, CoachingProgramMemberPracticeRoundView[]>
  >({})

  useEffect(() => {
    refresh()
  }, [])

  const refresh = () => {
    const loaded = buildCoachingProgramsPanelView()
    setPrograms(loaded)
    const roundsByProgram: Record<string, CoachingProgramMemberPracticeRoundView[]> = {}
    for (const program of loaded) {
      roundsByProgram[program.id] = buildCoachingProgramMemberPracticeRoundsFromStores(program)
    }
    setMemberPracticeRounds(roundsByProgram)
  }

  const memberRoundDraftKey = (programId: string, contributorId: string) => `${programId}:${contributorId}`

  const handleAssignRound = (programId: string, contributorId: string) => {
    const key = memberRoundDraftKey(programId, contributorId)
    const roundId = (memberRoundDrafts[key] ?? "").trim()
    if (!roundId) return
    setMemberPracticeRound(programId, contributorId, roundId)
    setMemberRoundDrafts((prev) => ({ ...prev, [key]: "" }))
    refresh()
  }

  const handleClearMemberRound = (programId: string, contributorId: string) => {
    clearMemberPracticeRound(programId, contributorId)
    refresh()
  }

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

  const handleRemove = (id: string) => {
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
              <div className="flex flex-wrap gap-1.5">
                {program.memberIds.map((memberId) => (
                  <Badge key={memberId} variant="outline">
                    {memberId}
                  </Badge>
                ))}
              </div>

              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <p className="text-sm font-medium text-foreground">Practice rounds</p>
                <p className="text-xs text-muted-foreground">
                  Assign a member&apos;s{" "}
                  <Link href="/practice-round" className="underline">
                    Practice Round Simulator
                  </Link>{" "}
                  round to see their setup and feedback here.
                </p>
                {program.memberIds.map((memberId) => {
                  const key = memberRoundDraftKey(program.id, memberId)
                  const assignedRoundId = getMemberRoundIds(program.id)[memberId]
                  const view = memberPracticeRounds[program.id]?.find(
                    (v) => v.contributorId === memberId,
                  )
                  return (
                    <div key={memberId} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{memberId}</Badge>
                        {assignedRoundId && (
                          <span className="text-xs text-muted-foreground">
                            Assigned round: {assignedRoundId}
                            {!view && " (no matching practice round found)"}
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <Input
                            value={memberRoundDrafts[key] ?? ""}
                            onChange={(e) =>
                              setMemberRoundDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder="round-1"
                            className="h-8 w-32"
                          />
                          <Button size="sm" variant="outline" onClick={() => handleAssignRound(program.id, memberId)}>
                            Assign round
                          </Button>
                          {assignedRoundId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleClearMemberRound(program.id, memberId)}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>

                      {view && (
                        <div className="space-y-2">
                          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                            <p className="mb-1 font-medium text-foreground">Round setup</p>
                            <p className="whitespace-pre-line text-muted-foreground">{view.setupText}</p>
                          </div>
                          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                            <p className="mb-1 font-medium text-foreground">Post-round feedback</p>
                            <p className="whitespace-pre-line text-muted-foreground">
                              {view.feedbackText ?? "No post-round feedback yet."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
