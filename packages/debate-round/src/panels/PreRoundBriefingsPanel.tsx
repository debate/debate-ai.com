/**
 * @fileoverview Pre-Round Briefings panel — the "(b) a briefing panel UI
 * that renders it on a round-information page" follow-up named in idea #12
 * ("Pre-Round Intelligence Panel") in TODO.md.
 *
 * Reads every persisted briefing via `state/preRoundBriefings.ts`'s
 * `buildPreRoundBriefingsPanelView` (a stable `roundId` sort of
 * `listPreRoundBriefings`) and renders each round's event summary, prior
 * head-to-head record, and briefing sections, with a "Clear" action per
 * round that calls the already-persisted `deletePreRoundBriefing` — no new
 * briefing-composition logic is introduced here.
 *
 * Also renders a "create briefing" form: draft fields are validated and
 * composed into a `PreRoundBriefingRecord` by
 * `state/preRoundBriefings.ts`'s `buildPreRoundBriefingRecordFromDraft`
 * (optionally pulling in an already-persisted Opponent Team Profile / Judge
 * Profile by id via the existing `buildPreRoundBriefingFromStores`), then
 * persisted via `savePreRoundBriefing` — closing the panel's previously
 * documented gap that nothing in the shipped app could actually create a
 * briefing — mirroring `StandingsPanel`'s "record a result" form
 * convention.
 *
 * @module panels/PreRoundBriefingsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-ui/src/primitives/select"
import { Textarea } from "debate-ui/src/primitives/textarea"
import { listOpponentTeamProfiles } from "debate-data-sync/src/state/opponentTeamProfiles"
import { listJudgeProfiles } from "debate-speech-writer/src/state/judgeProfiles"
import type { DebateSide } from "debate-data-sync/src/rankings/opponent-team-profile"
import {
  buildPreRoundBriefingRecordFromDraft,
  buildPreRoundBriefingsPanelView,
  deletePreRoundBriefing,
  savePreRoundBriefing,
} from "../state/preRoundBriefings"
import type { PreRoundBriefingRecord } from "../state/preRoundBriefings"

const NONE_VALUE = "__none__"

type BriefingDraft = {
  roundId: string
  tournamentName: string
  division: string
  roundLabel: string
  side: DebateSide
  room: string
  opponentLabel: string
  opponentTeamId: string
  judgeId: string
  teamPrepNotes: string
}

const EMPTY_DRAFT: BriefingDraft = {
  roundId: "",
  tournamentName: "",
  division: "",
  roundLabel: "",
  side: "aff",
  room: "",
  opponentLabel: "",
  opponentTeamId: NONE_VALUE,
  judgeId: NONE_VALUE,
  teamPrepNotes: "",
}

/**
 * Renders the Pre-Round Briefings panel: every persisted
 * `PreRoundBriefingRecord`, sorted by `roundId`, with a "Clear" action per
 * round.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function PreRoundBriefingsPanel() {
  const [briefings, setBriefings] = useState<PreRoundBriefingRecord[] | null>(null)
  const [opponentProfiles, setOpponentProfiles] = useState<{ teamId: string }[]>([])
  const [judgeProfiles, setJudgeProfiles] = useState<{ judgeId: string }[]>([])
  const [draft, setDraft] = useState<BriefingDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBriefings(buildPreRoundBriefingsPanelView())
    setOpponentProfiles(listOpponentTeamProfiles())
    setJudgeProfiles(listJudgeProfiles())
  }, [])

  const refresh = () => setBriefings(buildPreRoundBriefingsPanelView())

  const handleClear = (roundId: string) => {
    deletePreRoundBriefing(roundId)
    refresh()
  }

  const handleSubmit = () => {
    const teamPrepNotes = draft.teamPrepNotes
      .split("\n")
      .map((note) => note.trim())
      .filter((note) => note.length > 0)

    const result = buildPreRoundBriefingRecordFromDraft({
      roundId: draft.roundId,
      tournamentName: draft.tournamentName,
      division: draft.division,
      roundLabel: draft.roundLabel,
      side: draft.side,
      room: draft.room,
      opponentLabel: draft.opponentLabel,
      opponentTeamId: draft.opponentTeamId === NONE_VALUE ? undefined : draft.opponentTeamId,
      judgeId: draft.judgeId === NONE_VALUE ? undefined : draft.judgeId,
      teamPrepNotes,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    savePreRoundBriefing(result.record)
    setError(null)
    setDraft({ ...EMPTY_DRAFT, tournamentName: draft.tournamentName, division: draft.division })
    refresh()
  }

  if (briefings === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading briefings…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Pre-Round Briefings</h1>
        <p className="text-sm text-muted-foreground">
          Opponent scouting, judge tendencies, head-to-head record, and prep notes, combined into
          one focused briefing per round.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="briefing-round-id">Round ID</Label>
            <Input
              id="briefing-round-id"
              value={draft.roundId}
              onChange={(e) => setDraft((prev) => ({ ...prev, roundId: e.target.value }))}
              placeholder="round-4"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="briefing-tournament-name">Tournament</Label>
            <Input
              id="briefing-tournament-name"
              value={draft.tournamentName}
              onChange={(e) => setDraft((prev) => ({ ...prev, tournamentName: e.target.value }))}
              placeholder="Blake"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="briefing-division">Division</Label>
            <Input
              id="briefing-division"
              value={draft.division}
              onChange={(e) => setDraft((prev) => ({ ...prev, division: e.target.value }))}
              placeholder="LD"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="briefing-round-label">Round label</Label>
            <Input
              id="briefing-round-label"
              value={draft.roundLabel}
              onChange={(e) => setDraft((prev) => ({ ...prev, roundLabel: e.target.value }))}
              placeholder="Round 4"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="briefing-side">Side</Label>
            <Select
              value={draft.side}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, side: value as DebateSide }))}
            >
              <SelectTrigger id="briefing-side" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aff">Aff</SelectItem>
                <SelectItem value="neg">Neg</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="briefing-room">Room</Label>
            <Input
              id="briefing-room"
              value={draft.room}
              onChange={(e) => setDraft((prev) => ({ ...prev, room: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="briefing-opponent-label">Opponent label</Label>
            <Input
              id="briefing-opponent-label"
              value={draft.opponentLabel}
              onChange={(e) => setDraft((prev) => ({ ...prev, opponentLabel: e.target.value }))}
              placeholder="Optional (e.g. a team code)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="briefing-opponent-profile">Opponent scouting profile</Label>
            <Select
              value={draft.opponentTeamId}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, opponentTeamId: value }))}
            >
              <SelectTrigger id="briefing-opponent-profile" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>None on file</SelectItem>
                {opponentProfiles.map((profile) => (
                  <SelectItem key={profile.teamId} value={profile.teamId}>
                    {profile.teamId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="briefing-judge-profile">Judge profile</Label>
            <Select
              value={draft.judgeId}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, judgeId: value }))}
            >
              <SelectTrigger id="briefing-judge-profile" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>None on file</SelectItem>
                {judgeProfiles.map((profile) => (
                  <SelectItem key={profile.judgeId} value={profile.judgeId}>
                    {profile.judgeId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="briefing-prep-notes">Team prep notes</Label>
          <Textarea
            id="briefing-prep-notes"
            value={draft.teamPrepNotes}
            onChange={(e) => setDraft((prev) => ({ ...prev, teamPrepNotes: e.target.value }))}
            placeholder="One note per line"
            rows={3}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit}>Save briefing</Button>
      </div>

      {briefings.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No pre-round briefings yet. Create one above, or one fills in once generated
          elsewhere for a round.
        </div>
      )}
      {briefings.map(({ roundId, briefing }) => (
        <div key={roundId} className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Round {roundId}{" "}
              <span className="font-normal text-muted-foreground">
                — {briefing.event.tournamentName}, {briefing.event.division},{" "}
                {briefing.event.roundLabel}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="whitespace-nowrap">
                {briefing.priorMeetings.meetings === 0
                  ? "No prior meetings"
                  : `${briefing.priorMeetings.wins}-${briefing.priorMeetings.losses} vs. opponent`}
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => handleClear(roundId)}>
                Clear
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {briefing.sections.map((section) => (
              <div
                key={section.title}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                <p className="mb-1 font-medium text-foreground">{section.title}</p>
                <p className="whitespace-pre-line text-muted-foreground">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
