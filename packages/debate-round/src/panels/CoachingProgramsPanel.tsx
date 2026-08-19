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
 * persisted state via the new `state/persistedCoachingProgramBoard.ts`'s
 * `buildPersistedCoachingProgramBoard` — the topic sprint (research, quests,
 * task routing, progress, notes), the group-challenge standings, and each
 * roster member's drill set (once they've registered an already-flowed
 * practice round below). This closes the "(b-continued)" follow-up named
 * under idea #13 in TODO.md.
 *
 * The board view also renders a "Register practice flow" form per roster
 * member — round id + side — that saves through the new
 * `state/memberPracticeFlows.ts`'s `saveMemberPracticeFlow`, plus that
 * member's resolution status (a registered round that can't be resolved to
 * an actual flow, e.g. it hasn't been flowed yet, is called out rather than
 * silently rendering no drills). This closes the roundId-to-contributor
 * mapping half of the "(b-continued)" follow-up.
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
  deleteMemberPracticeFlow,
  getMemberPracticeFlow,
  resolveFlowForRound,
  saveMemberPracticeFlow,
  type MemberPracticeFlowRecord,
} from "../state/memberPracticeFlows"
import { buildCoachingProgramSummaryText, type CoachingProgramBoard, type CoachingProgramConfig } from "../round/coaching-program"

type ProgramDraft = { name: string; memberIds: string }

const EMPTY_DRAFT: ProgramDraft = { name: "", memberIds: "" }

type PracticeFlowDraft = { roundId: string; sideKey: string }

const EMPTY_PRACTICE_FLOW_DRAFT: PracticeFlowDraft = { roundId: "", sideKey: "" }

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
  const [practiceFlowDrafts, setPracticeFlowDrafts] = useState<Record<string, PracticeFlowDraft>>({})
  const [practiceFlowErrors, setPracticeFlowErrors] = useState<Record<string, string>>({})
  /** Bumped on every register/clear so the board and per-member status re-read localStorage. */
  const [registrationTick, setRegistrationTick] = useState(0)

  useEffect(() => {
    setPrograms(buildCoachingProgramsPanelView())
  }, [])

  const refresh = () => setPrograms(buildCoachingProgramsPanelView())

  useEffect(() => {
    const trimmedTopic = topic.trim()
    if (!openProgramId || !trimmedTopic) {
      setBoard(null)
      return
    }
    setBoard(buildPersistedCoachingProgramBoard(openProgramId, trimmedTopic, Date.now()) ?? null)
  }, [openProgramId, topic, registrationTick])

  const handleToggleBoard = (id: string) => {
    setOpenProgramId((prev) => (prev === id ? null : id))
    setTopic("")
    setBoard(null)
    setPracticeFlowDrafts({})
    setPracticeFlowErrors({})
  }

  const handleRegisterPracticeFlow = (memberId: string) => {
    const draft = practiceFlowDrafts[memberId] ?? EMPTY_PRACTICE_FLOW_DRAFT
    const roundId = Number(draft.roundId.trim())
    const sideKey = draft.sideKey.trim()
    if (!draft.roundId.trim() || !Number.isFinite(roundId) || !sideKey) {
      setPracticeFlowErrors((prev) => ({ ...prev, [memberId]: "A numeric round id and a side are required." }))
      return
    }
    saveMemberPracticeFlow({ contributorId: memberId, roundId, sideKey })
    setPracticeFlowErrors((prev) => {
      const { [memberId]: _removed, ...rest } = prev
      return rest
    })
    setPracticeFlowDrafts((prev) => ({ ...prev, [memberId]: EMPTY_PRACTICE_FLOW_DRAFT }))
    setRegistrationTick((tick) => tick + 1)
  }

  const handleClearPracticeFlow = (memberId: string) => {
    deleteMemberPracticeFlow(memberId)
    setRegistrationTick((tick) => tick + 1)
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

                  <div className="space-y-2 border-t border-border pt-3">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                      Member practice flows
                    </h3>
                    {program.memberIds.map((memberId) => {
                      const registration: MemberPracticeFlowRecord | undefined = getMemberPracticeFlow(memberId)
                      const resolved = registration ? resolveFlowForRound(registration.roundId) : undefined
                      const draft = practiceFlowDrafts[memberId] ?? EMPTY_PRACTICE_FLOW_DRAFT
                      return (
                        <div key={memberId} className="rounded-md border border-border/60 p-2.5">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{memberId}</span>
                            {registration ? (
                              <Badge variant={resolved ? "default" : "outline"}>
                                {resolved
                                  ? `Round ${registration.roundId} (${registration.sideKey}) — drills ready`
                                  : `Round ${registration.roundId} not flowed yet`}
                              </Badge>
                            ) : (
                              <Badge variant="outline">No practice round registered</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="space-y-1">
                              <Label htmlFor={`practice-flow-round-${program.id}-${memberId}`} className="text-xs">
                                Round id
                              </Label>
                              <Input
                                id={`practice-flow-round-${program.id}-${memberId}`}
                                value={draft.roundId}
                                onChange={(e) =>
                                  setPracticeFlowDrafts((prev) => ({
                                    ...prev,
                                    [memberId]: { ...draft, roundId: e.target.value },
                                  }))
                                }
                                placeholder="1234"
                                className="h-8 w-24"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`practice-flow-side-${program.id}-${memberId}`} className="text-xs">
                                Side
                              </Label>
                              <Input
                                id={`practice-flow-side-${program.id}-${memberId}`}
                                value={draft.sideKey}
                                onChange={(e) =>
                                  setPracticeFlowDrafts((prev) => ({
                                    ...prev,
                                    [memberId]: { ...draft, sideKey: e.target.value },
                                  }))
                                }
                                placeholder="A"
                                className="h-8 w-16"
                              />
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleRegisterPracticeFlow(memberId)}>
                              Register
                            </Button>
                            {registration && (
                              <Button size="sm" variant="ghost" onClick={() => handleClearPracticeFlow(memberId)}>
                                Clear
                              </Button>
                            )}
                          </div>
                          {practiceFlowErrors[memberId] && (
                            <p className="mt-1 text-xs text-destructive">{practiceFlowErrors[memberId]}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
