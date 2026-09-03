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
 * briefing.
 *
 * Also renders a "log a round" form: this team's own round history (used
 * for the "Prior meetings" head-to-head record) is persisted via
 * `state/ownRoundHistory.ts`'s `saveOwnRoundHistoryRecord`, closing the
 * real gap `docs/features/pre-round-briefings.md`'s "Known gaps" documented
 * — no persisted store of a team's own round history existed for
 * `buildPreRoundBriefingFromStores` to read from, so "Prior meetings"
 * always rendered "No recorded prior meetings" even when an opponent
 * profile was picked.
 *
 * Each round card also has a "Download" action — idea #12's "a print/export
 * view of a briefing for offline use before a round" follow-up — using the
 * same anchor+Blob download pattern every other completed export follow-up
 * in this repo already uses (e.g. `VulnerabilityChartsPanel.tsx`'s "Download
 * report"), backed by `round/pre-round-briefing.ts`'s
 * `buildPreRoundBriefingText`/`preRoundBriefingFilename`.
 *
 * Each round card also carries a "last updated" freshness badge — idea #12's
 * "a 'last updated' freshness indicator so a stale briefing is obvious"
 * follow-up — showing how long it's been since the record's `updatedAt` was
 * last stamped by `savePreRoundBriefing`, and switching to a destructive
 * variant once `round/pre-round-briefing.ts#isBriefingStale` reports it's
 * past the staleness threshold. Mirrors `ReviewQueuePanel.tsx`'s
 * age/staleness badge exactly (same `undefined`-age-hides-the-badge guard,
 * for a record persisted before `updatedAt` existed).
 *
 * Also renders a "Pairing schedule" section — idea #12's "A manual
 * pairing/room-assignment entry form as the practical stand-in" follow-up,
 * since real Tabroom pairings stay blocked behind a login wall (see
 * `docs/features/pre-round-briefings.md`'s "Known gaps"). Pairings are
 * persisted (and account-synced) independently of a briefing via
 * `hooks/useRoundPairings.ts`, so a team can log a tournament's whole round
 * schedule as soon as pairings are posted, before writing up any briefing.
 * Each saved pairing has a "Use for briefing" action that prefills the
 * create-briefing form's round id/tournament/division/round label/side/
 * room/opponent-label fields from it, so a pairing only has to be typed
 * once.
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
import { EmptyState } from "debate-ui/src/panels/panel-shell"
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
import {
  buildPreRoundBriefingText,
  getBriefingAgeHours,
  isBriefingStale,
  preRoundBriefingFilename,
  STALE_BRIEFING_THRESHOLD_HOURS,
} from "../round/pre-round-briefing"
import type { PreRoundBriefing } from "../round/pre-round-briefing"
import {
  deleteOwnRoundHistoryRecord,
  listOwnRoundHistory,
  saveOwnRoundHistoryRecord,
} from "../state/ownRoundHistory"
import type { OwnRoundHistoryRecord } from "../state/ownRoundHistory"
import { buildRoundPairingRecordFromDraft } from "../state/roundPairings"
import type { RoundPairingRecord } from "../state/roundPairings"
import { useRoundPairings } from "../hooks/useRoundPairings"

const NONE_VALUE = "__none__"

/** Mirrors `ReviewQueuePanel.tsx`'s `formatReviewAgeLabel` — a short, singular/plural-aware age label. */
function formatBriefingAgeLabel(hours: number): string {
  if (hours < 1) return "updated <1h ago"
  if (hours < 24) return `updated ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `updated ${days}d ago`
}

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

type PairingDraft = {
  roundId: string
  tournamentName: string
  division: string
  roundLabel: string
  side: DebateSide
  room: string
  opponentLabel: string
  judgeLabel: string
}

const EMPTY_PAIRING_DRAFT: PairingDraft = {
  roundId: "",
  tournamentName: "",
  division: "",
  roundLabel: "",
  side: "aff",
  room: "",
  opponentLabel: "",
  judgeLabel: "",
}

type RoundLogDraft = {
  tournamentName: string
  date: string
  division: string
  side: DebateSide
  opponentTeamId: string
  won: "won" | "lost"
}

const EMPTY_ROUND_LOG_DRAFT: RoundLogDraft = {
  tournamentName: "",
  date: "",
  division: "",
  side: "aff",
  opponentTeamId: NONE_VALUE,
  won: "won",
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
  const [ownRoundHistory, setOwnRoundHistory] = useState<OwnRoundHistoryRecord[]>([])
  const [roundLogDraft, setRoundLogDraft] = useState<RoundLogDraft>(EMPTY_ROUND_LOG_DRAFT)
  const [roundLogError, setRoundLogError] = useState<string | null>(null)
  const { pairings, synced: pairingsSynced, savePairing, deletePairing } = useRoundPairings()
  const [pairingDraft, setPairingDraft] = useState<PairingDraft>(EMPTY_PAIRING_DRAFT)
  const [pairingError, setPairingError] = useState<string | null>(null)

  useEffect(() => {
    setBriefings(buildPreRoundBriefingsPanelView())
    setOpponentProfiles(listOpponentTeamProfiles())
    setJudgeProfiles(listJudgeProfiles())
    setOwnRoundHistory(listOwnRoundHistory())
  }, [])

  const refresh = () => setBriefings(buildPreRoundBriefingsPanelView())

  const handleClear = (roundId: string) => {
    deletePreRoundBriefing(roundId)
    refresh()
  }

  /** Mirrors `VulnerabilityChartsPanel.tsx`'s anchor+Blob download pattern. */
  const handleDownload = (roundId: string, briefing: PreRoundBriefing) => {
    const text = buildPreRoundBriefingText(briefing, roundId)
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = preRoundBriefingFilename(roundId)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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

  const handleSavePairing = () => {
    const result = buildRoundPairingRecordFromDraft(pairingDraft)
    if (!result.ok) {
      setPairingError(result.error)
      return
    }
    savePairing(result.record)
    setPairingError(null)
    setPairingDraft({ ...EMPTY_PAIRING_DRAFT, tournamentName: pairingDraft.tournamentName, division: pairingDraft.division })
  }

  /** Prefills the "create briefing" form above from a saved pairing, so its fields only have to be typed once. */
  const handleUsePairingForBriefing = (pairing: RoundPairingRecord) => {
    setDraft((prev) => ({
      ...prev,
      roundId: pairing.roundId,
      tournamentName: pairing.tournamentName,
      division: pairing.division,
      roundLabel: pairing.roundLabel,
      side: pairing.side,
      room: pairing.room ?? "",
      opponentLabel: pairing.opponentLabel ?? "",
    }))
    setError(null)
  }

  const refreshOwnRoundHistory = () => setOwnRoundHistory(listOwnRoundHistory())

  const handleLogRound = () => {
    const tournamentName = roundLogDraft.tournamentName.trim()
    const date = roundLogDraft.date.trim()
    const division = roundLogDraft.division.trim()
    const opponentTeamId =
      roundLogDraft.opponentTeamId === NONE_VALUE ? "" : roundLogDraft.opponentTeamId.trim()
    if (!tournamentName || !date || !division || !opponentTeamId) {
      setRoundLogError("Tournament, date, division, and opponent are all required.")
      return
    }

    saveOwnRoundHistoryRecord({
      id: `round-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      teamId: "self",
      tournamentName,
      date,
      division,
      side: roundLogDraft.side,
      won: roundLogDraft.won === "won",
      opponentTeamId,
    })
    setRoundLogError(null)
    setRoundLogDraft({ ...EMPTY_ROUND_LOG_DRAFT, tournamentName, division })
    refreshOwnRoundHistory()
    refresh()
  }

  const handleDeleteRoundLog = (id: string) => {
    deleteOwnRoundHistoryRecord(id)
    refreshOwnRoundHistory()
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

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Pairing schedule</h2>
          <p className="text-xs text-muted-foreground">
            Log a round&apos;s pairing/room assignment by hand once it&apos;s posted — live tournament
            pairings aren&apos;t available from Tabroom yet. Each saved pairing has a &quot;Use for
            briefing&quot; action that prefills the form above.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pairingsSynced
              ? "Pairings are synced to your account."
              : "Sign in to sync pairings across devices."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pairing-round-id">Round ID</Label>
            <Input
              id="pairing-round-id"
              value={pairingDraft.roundId}
              onChange={(e) => setPairingDraft((prev) => ({ ...prev, roundId: e.target.value }))}
              placeholder="round-4"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pairing-tournament-name">Tournament</Label>
            <Input
              id="pairing-tournament-name"
              value={pairingDraft.tournamentName}
              onChange={(e) => setPairingDraft((prev) => ({ ...prev, tournamentName: e.target.value }))}
              placeholder="Blake"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pairing-division">Division</Label>
            <Input
              id="pairing-division"
              value={pairingDraft.division}
              onChange={(e) => setPairingDraft((prev) => ({ ...prev, division: e.target.value }))}
              placeholder="LD"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pairing-round-label">Round label</Label>
            <Input
              id="pairing-round-label"
              value={pairingDraft.roundLabel}
              onChange={(e) => setPairingDraft((prev) => ({ ...prev, roundLabel: e.target.value }))}
              placeholder="Round 4"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pairing-side">Side</Label>
            <Select
              value={pairingDraft.side}
              onValueChange={(value) => setPairingDraft((prev) => ({ ...prev, side: value as DebateSide }))}
            >
              <SelectTrigger id="pairing-side" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aff">Aff</SelectItem>
                <SelectItem value="neg">Neg</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pairing-room">Room</Label>
            <Input
              id="pairing-room"
              value={pairingDraft.room}
              onChange={(e) => setPairingDraft((prev) => ({ ...prev, room: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pairing-opponent-label">Opponent label</Label>
            <Input
              id="pairing-opponent-label"
              value={pairingDraft.opponentLabel}
              onChange={(e) => setPairingDraft((prev) => ({ ...prev, opponentLabel: e.target.value }))}
              placeholder="Optional (e.g. a team code)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pairing-judge-label">Judge</Label>
            <Input
              id="pairing-judge-label"
              value={pairingDraft.judgeLabel}
              onChange={(e) => setPairingDraft((prev) => ({ ...prev, judgeLabel: e.target.value }))}
              placeholder="Optional (judge name as posted)"
            />
          </div>
        </div>
        {pairingError && <p className="text-sm text-destructive">{pairingError}</p>}
        <Button onClick={handleSavePairing} variant="outline">
          Save pairing
        </Button>

        {pairings === null ? null : pairings.length === 0 ? (
          <p className="pt-1 text-sm text-muted-foreground">No pairings logged yet.</p>
        ) : (
          <ul className="space-y-1.5 pt-1">
            {pairings.map((pairing) => (
              <li
                key={pairing.roundId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
              >
                <span>
                  Round {pairing.roundId} — {pairing.tournamentName}, {pairing.division},{" "}
                  {pairing.roundLabel} ({pairing.side})
                  {pairing.room && `, Room ${pairing.room}`}
                  {pairing.opponentLabel && `, vs. ${pairing.opponentLabel}`}
                  {pairing.judgeLabel && `, Judge: ${pairing.judgeLabel}`}
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleUsePairingForBriefing(pairing)}>
                    Use for briefing
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deletePairing(pairing.roundId)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Log a round</h2>
          <p className="text-xs text-muted-foreground">
            Log this team&apos;s own past rounds against an opponent so a future briefing for that
            opponent can show a head-to-head &quot;Prior meetings&quot; record.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="round-log-tournament">Tournament</Label>
            <Input
              id="round-log-tournament"
              value={roundLogDraft.tournamentName}
              onChange={(e) =>
                setRoundLogDraft((prev) => ({ ...prev, tournamentName: e.target.value }))
              }
              placeholder="Blake"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="round-log-date">Date</Label>
            <Input
              id="round-log-date"
              type="date"
              value={roundLogDraft.date}
              onChange={(e) => setRoundLogDraft((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="round-log-division">Division</Label>
            <Input
              id="round-log-division"
              value={roundLogDraft.division}
              onChange={(e) => setRoundLogDraft((prev) => ({ ...prev, division: e.target.value }))}
              placeholder="LD"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="round-log-side">Side</Label>
            <Select
              value={roundLogDraft.side}
              onValueChange={(value) =>
                setRoundLogDraft((prev) => ({ ...prev, side: value as DebateSide }))
              }
            >
              <SelectTrigger id="round-log-side" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aff">Aff</SelectItem>
                <SelectItem value="neg">Neg</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="round-log-opponent">Opponent</Label>
            <Select
              value={roundLogDraft.opponentTeamId}
              onValueChange={(value) =>
                setRoundLogDraft((prev) => ({ ...prev, opponentTeamId: value }))
              }
            >
              <SelectTrigger id="round-log-opponent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Select an opponent profile</SelectItem>
                {opponentProfiles.map((profile) => (
                  <SelectItem key={profile.teamId} value={profile.teamId}>
                    {profile.teamId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="round-log-result">Result</Label>
            <Select
              value={roundLogDraft.won}
              onValueChange={(value) =>
                setRoundLogDraft((prev) => ({ ...prev, won: value as "won" | "lost" }))
              }
            >
              <SelectTrigger id="round-log-result" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {roundLogError && <p className="text-sm text-destructive">{roundLogError}</p>}
        <Button onClick={handleLogRound} variant="outline">
          Log round
        </Button>

        {ownRoundHistory.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {ownRoundHistory.map((record) => (
              <li
                key={record.id}
                className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
              >
                <span>
                  {record.date} — {record.tournamentName}, {record.division} ({record.side}) vs.{" "}
                  {record.opponentTeamId}: {record.won ? "W" : "L"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteRoundLog(record.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {briefings.length === 0 && (
        <EmptyState
          title="No pre-round briefings yet."
          message="Create one above, or one fills in once generated elsewhere for a round."
        />
      )}
      {briefings.map(({ roundId, briefing, updatedAt }) => {
        const ageHours = getBriefingAgeHours(updatedAt)
        const stale = isBriefingStale(updatedAt)

        return (
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
                {ageHours !== undefined && (
                  <Badge
                    variant={stale ? "destructive" : "outline"}
                    className="whitespace-nowrap"
                    title={
                      stale
                        ? `Last updated ${ageHours} hour(s) ago — over the ${STALE_BRIEFING_THRESHOLD_HOURS}-hour staleness threshold`
                        : `Last updated ${ageHours} hour(s) ago`
                    }
                  >
                    {formatBriefingAgeLabel(ageHours)}
                  </Badge>
                )}
                <Badge variant="outline" className="whitespace-nowrap">
                  {briefing.priorMeetings.meetings === 0
                    ? "No prior meetings"
                    : `${briefing.priorMeetings.wins}-${briefing.priorMeetings.losses} vs. opponent`}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => handleDownload(roundId, briefing)}>
                  Download
                </Button>
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
        )
      })}
    </div>
  )
}
