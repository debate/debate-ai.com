/**
 * @fileoverview Judge Profiles panel — the "(b) a judge-profile card/panel
 * UI" follow-up named under the "⚖️ Judge Profiles" bullet in TODO.md's
 * Research Crowdsourcing Organizer Features list.
 *
 * Reads every persisted judge profile via `state/judgeProfiles.ts`'s
 * `buildJudgeProfilesRoster` (a thin ordering helper over the existing
 * persisted store) and renders it as a roster table — side-vote bias,
 * average speaker points, delivery-speed tolerance, theory receptiveness,
 * and most-tagged paradigm — reusing `judge/judge-profile.ts`'s existing
 * aggregation fields directly rather than introducing new scoring logic
 * here.
 *
 * Also hosts the "Log a judged round" form: one ballot at a time is
 * persisted through `state/judgeRoundRecords.ts`'s `recordJudgeRound`,
 * which re-aggregates that judge's profile from their full logged history
 * via the existing `buildJudgeProfile`/`saveJudgeProfile`. That's the only
 * in-app way to create a profile — every profile field shown here stays
 * derived from logged rounds, never edited directly.
 *
 * The "Logged rounds" list below the roster corrects a mistyped ballot
 * through the same store: Edit loads the round back into the form (which
 * then saves through `updateJudgeRoundRecord`) and Delete removes it
 * through `deleteJudgeRoundRecord`; both re-aggregate the affected judge.
 * A row that has been edited also gets an "Undo last edit" action, shown
 * only when `hasJudgeRoundRecordEditHistory` says one exists, which steps
 * the round back to its pre-edit version via `undoLastJudgeRoundRecordEdit`.
 * A row that has just been undone also gets a matching "Redo" action, shown
 * only when `hasJudgeRoundRecordRedoHistory` says one exists, which steps
 * forward again via `redoLastJudgeRoundRecordEdit`.
 *
 * Also hosts a **Compare judges** section — the "a multi-judge comparison
 * view for panel rounds" follow-up named under this bullet in TODO.md.
 * Checking two or more judges in the roster reveals a panel-level read
 * (`judge/judge-panel-comparison.ts#buildJudgePanelComparison`): which
 * judges lean which side, the pace to prep at for the whole panel, whether
 * running theory is safe across it, and whether the panel's tagged
 * paradigms conflict.
 *
 * @module panels/JudgeProfilesPanel
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
import { Switch } from "debate-ui/src/primitives/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-ui/src/primitives/table"
import { buildJudgeProfilesRoster } from "../state/judgeProfiles"
import {
  deleteJudgeRoundRecord,
  findNearestJudgeId,
  hasJudgeRoundRecordEditHistory,
  hasJudgeRoundRecordRedoHistory,
  listJudgeIds,
  listJudgeRoundRecords,
  recordJudgeRound,
  redoLastJudgeRoundRecordEdit,
  undoLastJudgeRoundRecordEdit,
  updateJudgeRoundRecord,
  type JudgeRoundRecordEntry,
} from "../state/judgeRoundRecords"
import type { DebateSide, JudgeProfile } from "../judge/judge-profile"
import { judgeParadigms, judgeParadigmIds } from "../judge/judge-paradigms"
import type { BuiltinJudgeParadigmId } from "../judge/judge-paradigms"
import { buildJudgePanelComparison } from "../judge/judge-panel-comparison"

/** Sentinel for "no paradigm tagged" — a Radix `SelectItem` can't carry an empty value. */
const NO_PARADIGM = "none"

type RoundDraft = {
  judgeId: string
  tournamentName: string
  date: string
  division: string
  winningSide: DebateSide
  affSpeakerPoints: string
  negSpeakerPoints: string
  paceWpm: string
  theoryArgumentRaised: boolean
  theoryArgumentWon: boolean
  paradigmId: string
}

const EMPTY_DRAFT: RoundDraft = {
  judgeId: "",
  tournamentName: "",
  date: "",
  division: "",
  winningSide: "aff",
  affSpeakerPoints: "28",
  negSpeakerPoints: "28",
  paceWpm: "",
  theoryArgumentRaised: false,
  theoryArgumentWon: false,
  paradigmId: NO_PARADIGM,
}

/** Loads an already-logged round back into the form's string-typed draft. */
function draftFromRecord(record: JudgeRoundRecordEntry): RoundDraft {
  return {
    judgeId: record.judgeId,
    tournamentName: record.tournamentName,
    date: record.date,
    division: record.division,
    winningSide: record.winningSide,
    affSpeakerPoints: String(record.affSpeakerPoints),
    negSpeakerPoints: String(record.negSpeakerPoints),
    paceWpm: record.paceWpm === undefined ? "" : String(record.paceWpm),
    theoryArgumentRaised: record.theoryArgumentRaised,
    theoryArgumentWon: record.theoryArgumentWon,
    paradigmId: record.paradigmId ?? NO_PARADIGM,
  }
}

/**
 * Renders the Judge Profiles roster: every persisted judge profile ordered
 * by rounds judged descending, with side-vote bias, average speaker points,
 * delivery-speed tolerance, theory receptiveness, and most-tagged paradigm,
 * plus a form to log a judged round that creates or updates a profile.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function JudgeProfilesPanel() {
  const [roster, setRoster] = useState<JudgeProfile[] | null>(null)
  const [records, setRecords] = useState<JudgeRoundRecordEntry[]>([])
  const [draft, setDraft] = useState<RoundDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [judgeFilter, setJudgeFilter] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])

  useEffect(() => {
    setRoster(buildJudgeProfilesRoster())
    setRecords(listJudgeRoundRecords())
  }, [])

  const refresh = () => {
    setRoster(buildJudgeProfilesRoster())
    setRecords(listJudgeRoundRecords())
  }

  const handleSubmit = () => {
    const judgeId = draft.judgeId.trim()
    const tournamentName = draft.tournamentName.trim()
    const date = draft.date.trim()
    const division = draft.division.trim()
    if (!judgeId || !tournamentName || !date || !division) {
      setError("Judge ID, tournament, date, and division are all required.")
      return
    }
    const affSpeakerPoints = Number(draft.affSpeakerPoints)
    const negSpeakerPoints = Number(draft.negSpeakerPoints)
    if (!Number.isFinite(affSpeakerPoints) || !Number.isFinite(negSpeakerPoints)) {
      setError("Aff and Neg speaker points must be numbers.")
      return
    }
    const paceWpm = draft.paceWpm.trim() === "" ? undefined : Number(draft.paceWpm)
    if (paceWpm !== undefined && !Number.isFinite(paceWpm)) {
      setError("Pace must be a number of words per minute, or left blank.")
      return
    }
    const record: JudgeRoundRecordEntry = {
      id: editingId ?? `${judgeId}-${tournamentName}-${date}-${Date.now()}`,
      judgeId,
      tournamentName,
      date,
      division,
      winningSide: draft.winningSide,
      affSpeakerPoints,
      negSpeakerPoints,
      paceWpm,
      theoryArgumentRaised: draft.theoryArgumentRaised,
      theoryArgumentWon: draft.theoryArgumentRaised && draft.theoryArgumentWon,
      paradigmId:
        draft.paradigmId === NO_PARADIGM
          ? undefined
          : (draft.paradigmId as BuiltinJudgeParadigmId),
    }
    if (editingId) {
      updateJudgeRoundRecord(record)
    } else {
      recordJudgeRound(record)
    }
    setError(null)
    setEditingId(null)
    setDraft({ ...EMPTY_DRAFT, judgeId, division: draft.division })
    refresh()
  }

  const handleEdit = (record: JudgeRoundRecordEntry) => {
    setDraft(draftFromRecord(record))
    setEditingId(record.id)
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  const handleDelete = (id: string) => {
    deleteJudgeRoundRecord(id)
    if (editingId === id) {
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    }
    refresh()
  }

  const handleUndo = (id: string) => {
    undoLastJudgeRoundRecordEdit(id)
    if (editingId === id) {
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    }
    refresh()
  }

  const handleRedo = (id: string) => {
    redoLastJudgeRoundRecordEdit(id)
    if (editingId === id) {
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    }
    refresh()
  }

  const toggleCompare = (judgeId: string) => {
    setCompareIds((prev) =>
      prev.includes(judgeId) ? prev.filter((id) => id !== judgeId) : [...prev, judgeId],
    )
  }

  const normalizedFilter = judgeFilter.trim().toLowerCase()
  const visibleRecords =
    normalizedFilter === ""
      ? records
      : records.filter((record) => record.judgeId.toLowerCase().includes(normalizedFilter))
  const judgeIds = listJudgeIds()
  const nearestJudgeId = visibleRecords.length === 0 ? findNearestJudgeId(judgeFilter) : null

  if (roster === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading judge profiles…</div>
  }

  const compareProfiles = roster.filter((profile) => compareIds.includes(profile.judgeId))
  const panelComparison = compareProfiles.length >= 2 ? buildJudgePanelComparison(compareProfiles) : null

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Judge Profiles</h1>
        <p className="text-sm text-muted-foreground">
          Side-vote bias, average speaker points, delivery-speed tolerance, and
          theory receptiveness for every judge with a saved profile. Log a
          judged round below to create or update one — every field is derived
          from the rounds logged for that judge.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          {editingId ? "Edit logged round" : "Log a judged round"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="judge-round-judge-id">Judge ID</Label>
            <Input
              id="judge-round-judge-id"
              value={draft.judgeId}
              onChange={(e) => setDraft((prev) => ({ ...prev, judgeId: e.target.value }))}
              placeholder="smith"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-round-tournament">Tournament</Label>
            <Input
              id="judge-round-tournament"
              value={draft.tournamentName}
              onChange={(e) => setDraft((prev) => ({ ...prev, tournamentName: e.target.value }))}
              placeholder="Berkeley"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-round-date">Date</Label>
            <Input
              id="judge-round-date"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-round-division">Division</Label>
            <Input
              id="judge-round-division"
              value={draft.division}
              onChange={(e) => setDraft((prev) => ({ ...prev, division: e.target.value }))}
              placeholder="PF"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-round-winner">Winning side</Label>
            <Select
              value={draft.winningSide}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, winningSide: value as DebateSide }))
              }
            >
              <SelectTrigger id="judge-round-winner" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aff">Aff</SelectItem>
                <SelectItem value="neg">Neg</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-round-paradigm">Paradigm tagged</Label>
            <Select
              value={draft.paradigmId}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, paradigmId: value }))}
            >
              <SelectTrigger id="judge-round-paradigm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARADIGM}>Not tagged</SelectItem>
                {judgeParadigmIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {judgeParadigms[id].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-round-aff-points">Aff speaker points</Label>
            <Input
              id="judge-round-aff-points"
              type="number"
              step="0.1"
              value={draft.affSpeakerPoints}
              onChange={(e) => setDraft((prev) => ({ ...prev, affSpeakerPoints: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-round-neg-points">Neg speaker points</Label>
            <Input
              id="judge-round-neg-points"
              type="number"
              step="0.1"
              value={draft.negSpeakerPoints}
              onChange={(e) => setDraft((prev) => ({ ...prev, negSpeakerPoints: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-round-pace">Pace followed (wpm, optional)</Label>
            <Input
              id="judge-round-pace"
              type="number"
              min={0}
              value={draft.paceWpm}
              onChange={(e) => setDraft((prev) => ({ ...prev, paceWpm: e.target.value }))}
              placeholder="Leave blank if not tracked"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id="judge-round-theory-raised"
                checked={draft.theoryArgumentRaised}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({
                    ...prev,
                    theoryArgumentRaised: checked,
                    theoryArgumentWon: checked ? prev.theoryArgumentWon : false,
                  }))
                }
              />
              <Label htmlFor="judge-round-theory-raised">Theory argument raised</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="judge-round-theory-won"
                checked={draft.theoryArgumentWon}
                disabled={!draft.theoryArgumentRaised}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, theoryArgumentWon: checked }))
                }
              />
              <Label htmlFor="judge-round-theory-won">Theory argument won</Label>
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit}>{editingId ? "Save changes" : "Log round"}</Button>
          {editingId && (
            <Button variant="ghost" onClick={handleCancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No judge profiles yet. Log a judged round above to build one.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <span className="sr-only">Compare</span>
              </TableHead>
              <TableHead>Judge</TableHead>
              <TableHead className="text-right">Rounds</TableHead>
              <TableHead>Side record</TableHead>
              <TableHead className="text-right">Avg speaker pts</TableHead>
              <TableHead>Speed tolerance</TableHead>
              <TableHead>Theory receptiveness</TableHead>
              <TableHead>Paradigm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.map((profile) => (
              <TableRow key={profile.judgeId}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={compareIds.includes(profile.judgeId)}
                    onChange={() => toggleCompare(profile.judgeId)}
                    aria-label={`Add ${profile.judgeId} to panel comparison`}
                  />
                </TableCell>
                <TableCell className="font-medium">{profile.judgeId}</TableCell>
                <TableCell className="text-right">{profile.roundsJudged}</TableCell>
                <TableCell>
                  Aff {profile.sideBias.affWins}-{profile.sideBias.negWins} Neg
                  {profile.sideBias.hasNotableSideBias && (
                    <Badge variant="outline" className="ml-2">
                      notable bias
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {profile.roundsJudged > 0 ? profile.avgSpeakerPoints.overall : "—"}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {profile.speedTolerance ?? "unknown"}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {profile.theoryReceptiveness ?? "unknown"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.mostCommonParadigm ? (
                    <>
                      {profile.mostCommonParadigm}
                      <Badge
                        variant="outline"
                        className="ml-2"
                        title="Share of paradigm-tagged rounds that carried this paradigm"
                      >
                        {Math.round((profile.mostCommonParadigmConfidence ?? 0) * 100)}% confidence
                      </Badge>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {roster.length >= 2 && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Compare judges {compareIds.length > 0 && `(${compareIds.length} selected)`}
            </h2>
            <p className="text-sm text-muted-foreground">
              Check two or more judges above to see a panel-level read: side leans, the pace to
              prep at for the whole panel, whether theory is safe to run in front of it, and
              whether the panel's tagged paradigms conflict.
            </p>
          </div>
          {compareIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCompareIds([])}>
              Clear selection
            </Button>
          )}
          {panelComparison === null ? (
            <p className="text-sm text-muted-foreground">
              {compareIds.length === 1
                ? "Select at least one more judge to compare."
                : "No judges selected yet."}
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">Panel: </span>
                {panelComparison.judgeIds.join(", ")}
              </p>
              <p>
                <span className="font-medium text-foreground">Side leans: </span>
                {panelComparison.sideLeans.length > 0 ? (
                  panelComparison.sideLeans.map((lean) => (
                    <Badge key={lean.judgeId} variant="outline" className="mr-1 uppercase">
                      {lean.judgeId} → {lean.leansSide}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">no notable bias on this panel</span>
                )}
              </p>
              <p>
                <span className="font-medium text-foreground">Recommended pace: </span>
                {panelComparison.recommendedPaceWpm != null ? (
                  <span className="text-muted-foreground">
                    {panelComparison.recommendedPaceWpm} wpm (set by {panelComparison.slowestPacedJudgeId},
                    the panel's least speed-tolerant tracked judge)
                  </span>
                ) : (
                  <span className="text-muted-foreground">unknown — no judge on this panel tracked pace</span>
                )}
              </p>
              <p>
                <span className="font-medium text-foreground">Theory: </span>
                <Badge
                  variant={
                    panelComparison.theoryRisk === "risky" || panelComparison.theoryRisk === "mixed"
                      ? "destructive"
                      : "outline"
                  }
                  className="capitalize"
                >
                  {panelComparison.theoryRisk}
                </Badge>
                {panelComparison.judgesAverseToTheory.length > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    averse: {panelComparison.judgesAverseToTheory.join(", ")}
                  </span>
                )}
              </p>
              <p>
                <span className="font-medium text-foreground">Paradigms: </span>
                {panelComparison.hasConflictingParadigms && (
                  <Badge variant="destructive" className="mr-2">
                    conflicting
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {panelComparison.paradigms
                    .map((entry) => `${entry.judgeId}: ${entry.paradigmId ?? "untagged"}`)
                    .join(", ")}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {records.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Logged rounds</h2>
          <p className="text-sm text-muted-foreground">
            Editing a round rewrites it in place, keeping the version it held before the edit so
            it can be undone; deleting one re-derives that judge's profile from whatever rounds
            remain, and removes the profile entirely once its last round is gone.
          </p>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="judge-round-filter">Filter by judge ID</Label>
            <Input
              id="judge-round-filter"
              list="judge-round-filter-options"
              value={judgeFilter}
              onChange={(e) => setJudgeFilter(e.target.value)}
              placeholder="Show every judge's rounds"
            />
            <datalist id="judge-round-filter-options">
              {judgeIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </div>
          {visibleRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No logged rounds match that judge ID.
              {nearestJudgeId !== null && (
                <>
                  {" "}
                  Did you mean{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => setJudgeFilter(nearestJudgeId)}
                  >
                    {nearestJudgeId}
                  </button>
                  ?
                </>
              )}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judge</TableHead>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead>Speaker pts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.judgeId}</TableCell>
                    <TableCell>{record.tournamentName}</TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell className="uppercase">{record.winningSide}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.affSpeakerPoints} / {record.negSpeakerPoints}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {hasJudgeRoundRecordEditHistory(record.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUndo(record.id)}
                          aria-label={`Undo last edit to ${record.judgeId}'s ${record.tournamentName} round on ${record.date}`}
                        >
                          Undo last edit
                        </Button>
                      )}
                      {hasJudgeRoundRecordRedoHistory(record.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRedo(record.id)}
                          aria-label={`Redo last undone edit to ${record.judgeId}'s ${record.tournamentName} round on ${record.date}`}
                        >
                          Redo
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(record)}
                        aria-label={`Edit ${record.judgeId}'s ${record.tournamentName} round on ${record.date}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(record.id)}
                        aria-label={`Delete ${record.judgeId}'s ${record.tournamentName} round on ${record.date}`}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}
