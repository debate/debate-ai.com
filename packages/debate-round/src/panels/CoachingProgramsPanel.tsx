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
 * Each program also gets a "View board" action that opens its live
 * `buildCoachingProgramBoard` for a chosen topic, composed entirely from
 * persisted state via `state/persistedCoachingProgramBoard.ts`'s
 * `buildPersistedCoachingProgramBoard` — the topic sprint (research, quests,
 * task routing, progress, notes), the group-challenge standings, and each
 * roster member's drill set. This closes the "(b-continued)" follow-up
 * named under idea #13 in TODO.md.
 *
 * A member's drill set comes from their currently recorded practice-round
 * flow — the `roundId`-to-contributor mapping named as a further follow-up
 * in TODO.md and `docs/features/coaching-programs.md`'s "Known gaps". An
 * open board's roster now gets a "Save current flow" action per member that
 * records the live round workspace's selected flow (`state/store.ts`'s
 * `useFlowStore`) against that member via
 * `state/roundContributorFlows.ts`'s `buildAndSaveRoundContributorFlow`,
 * closing that follow-up.
 *
 * A roster member's board now also shows a Practice Round Simulator badge —
 * "Practice round recorded" (or "+ feedback" once feedback has been
 * generated) when a `PracticeRoundRecord` exists for that same recorded
 * `roundId` (`state/practiceRounds.ts`, joined through
 * `state/roundContributorFlows.ts`'s `buildCoachingProgramMemberPracticeRounds`),
 * closing idea #13's remaining "(c)" follow-up in TODO.md.
 *
 * @module panels/CoachingProgramsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import {
  buildCoachingProgramsPanelView,
  deleteCoachingProgram,
  saveCoachingProgram,
} from "../state/coachingPrograms"
import { buildPersistedCoachingProgramBoard } from "../state/persistedCoachingProgramBoard"
import {
  buildAndSaveRoundContributorFlow,
  deleteRoundContributorFlow,
  listRoundContributorFlows,
} from "../state/roundContributorFlows"
import { buildCoachingProgramSummaryText, type CoachingProgramBoard, type CoachingProgramConfig } from "../round/coaching-program"
import { useFlowStore } from "../state/store"

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
  const [openProgramId, setOpenProgramId] = useState<string | null>(null)
  const [topic, setTopic] = useState("")
  const [board, setBoard] = useState<CoachingProgramBoard | null>(null)
  const [sideKeyDrafts, setSideKeyDrafts] = useState<Record<string, string>>({})
  const [recordedContributorIds, setRecordedContributorIds] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  const flows = useFlowStore((state) => state.flows)
  const selected = useFlowStore((state) => state.selected)
  const currentFlow = mounted ? flows[selected] : undefined

  useEffect(() => {
    setMounted(true)
    setPrograms(buildCoachingProgramsPanelView())
    setRecordedContributorIds(new Set(listRoundContributorFlows().map((record) => record.contributorId)))
  }, [])

  const refresh = () => setPrograms(buildCoachingProgramsPanelView())

  const refreshBoard = (id: string, rawTopic: string) => {
    const trimmedTopic = rawTopic.trim()
    setBoard(trimmedTopic ? buildPersistedCoachingProgramBoard(id, trimmedTopic, Date.now()) ?? null : null)
  }

  useEffect(() => {
    if (!openProgramId) {
      setBoard(null)
      return
    }
    refreshBoard(openProgramId, topic)
  }, [openProgramId, topic])

  const handleToggleBoard = (id: string) => {
    setOpenProgramId((prev) => (prev === id ? null : id))
    setTopic("")
    setBoard(null)
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

  const handleRecordFlow = (memberId: string) => {
    if (!currentFlow) return
    const sideKey = (sideKeyDrafts[memberId] ?? "").trim()
    if (!sideKey) {
      setError("A side (e.g. A or N) is required to save a member's flow.")
      return
    }
    buildAndSaveRoundContributorFlow(currentFlow, String(currentFlow.id), memberId, sideKey)
    setError(null)
    setRecordedContributorIds((prev) => new Set(prev).add(memberId))
    if (openProgramId) refreshBoard(openProgramId, topic)
  }

  const handleClearFlow = (memberId: string) => {
    deleteRoundContributorFlow(memberId)
    setRecordedContributorIds((prev) => {
      const next = new Set(prev)
      next.delete(memberId)
      return next
    })
    if (openProgramId) refreshBoard(openProgramId, topic)
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
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => handleToggleBoard(program.id)}>
                    {openProgramId === program.id ? "Hide board" : "View board"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(program.id)}>
                    Remove
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {program.memberIds.map((memberId) => (
                  <Badge key={memberId} variant="outline">
                    {memberId}
                  </Badge>
                ))}
              </div>

              {openProgramId === program.id && (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`coaching-board-topic-${program.id}`}>Topic sprint</Label>
                    <Input
                      id={`coaching-board-topic-${program.id}`}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Immigration"
                      className="max-w-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Member flows</Label>
                    <p className="text-xs text-muted-foreground">
                      Save the round workspace's currently selected flow against a roster member to
                      generate their drill set on this board.
                    </p>
                    {program.memberIds.map((memberId) => (
                      <div key={memberId} className="flex flex-wrap items-center gap-2">
                        <span className="w-24 truncate text-sm text-foreground">{memberId}</span>
                        <Badge variant={recordedContributorIds.has(memberId) ? "default" : "outline"}>
                          {recordedContributorIds.has(memberId) ? "Flow recorded" : "No flow recorded"}
                        </Badge>
                        <Badge variant={board?.memberPracticeRounds[memberId] ? "default" : "outline"}>
                          {board?.memberPracticeRounds[memberId]
                            ? board.memberPracticeRounds[memberId].feedback
                              ? "Practice round + feedback"
                              : "Practice round recorded"
                            : "No practice round"}
                        </Badge>
                        <Input
                          value={sideKeyDrafts[memberId] ?? ""}
                          onChange={(e) =>
                            setSideKeyDrafts((prev) => ({ ...prev, [memberId]: e.target.value }))
                          }
                          placeholder="Side (e.g. A)"
                          className="w-32"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!currentFlow}
                          onClick={() => handleRecordFlow(memberId)}
                        >
                          Save current flow
                        </Button>
                        {recordedContributorIds.has(memberId) && (
                          <Button size="sm" variant="ghost" onClick={() => handleClearFlow(memberId)}>
                            Clear
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {!topic.trim() ? (
                    <p className="text-sm text-muted-foreground">
                      Enter a topic above to compose this program's live board.
                    </p>
                  ) : !board ? (
                    <p className="text-sm text-muted-foreground">Loading board…</p>
                  ) : (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {buildCoachingProgramSummaryText(board)}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
