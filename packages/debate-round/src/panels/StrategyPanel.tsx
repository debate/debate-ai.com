/**
 * @fileoverview Scout-to-Strategy panel — the "(a) a case-choice/strategy
 * panel UI" follow-up named under the "Scout-to-Strategy Workflow" bullet in
 * TODO.md's Research Crowdsourcing Organizer Features list.
 *
 * Lets a team enter a matchup id, an optional opponent-team id and judge id
 * (looked up from the existing `opponentTeamProfiles.ts`/`judgeProfiles.ts`
 * stores), and a list of case options (one per line, `Name: tag, tag`), then
 * builds and appends a `StrategyRecommendation` via
 * `scout-to-strategy.ts`'s `buildStrategyRecommendationFromStores` — no new
 * scouting/ranking logic is introduced here. Renders every persisted
 * recommendation, grouped and sorted by matchup, via
 * `hooks/useStrategyRecommendations.ts`, mirroring
 * `JudgeDecisionPanel.tsx`'s history-log convention: rebuilding a
 * recommendation for a matchup that already has one appends a fresh entry
 * to that matchup's history (newest first) instead of overwriting it —
 * closing this bullet's "a history log of past strategy recommendations per
 * matchup" follow-up. A "Clear" action removes one entry; "Clear all
 * history for this matchup" removes every entry for that matchup at once.
 *
 * A "Get AI case-choice evaluation" action per recommendation calls
 * `round/case-choice-client.ts`'s `requestCaseChoiceEvaluation` with that
 * recommendation's own case rankings, judge-adaptation notes, and risk
 * assessment, saves the result via the hook's `setAiCaseChoice`, and renders
 * it alongside the deterministic recommendation — closing follow-up (c),
 * "an actual AI-panel evaluation of case choice instead of the tag-overlap
 * heuristic."
 *
 * The recommendation history is also account-synced when signed in (the
 * hook's `synced` flag), following a signed-in user across devices —
 * closing the standing "link user db SQL... save flows docs and debates in
 * SQL and link to users" gap for this tool the same way judge decisions and
 * counsel-panel assessments already do.
 *
 * A "Send to Pre-Round Briefing" action per recommendation closes this
 * bullet's "a one-click export into the Pre-Round Briefing" follow-up: it
 * appends `scout-to-strategy.ts#buildStrategyRecommendationPrepNote`'s
 * one-line summary as a new "Team prep notes" bullet on an already-saved
 * `state/preRoundBriefings.ts` record (`appendPrepNoteToPreRoundBriefing`),
 * picked from a dropdown of every round id with a saved briefing.
 *
 * A "Case comparison" table per recommendation (shown once there are at
 * least two ranked case options) closes this bullet's "a side-by-side
 * case-option comparison table" follow-up: `scout-to-strategy.ts`'s
 * `buildCaseComparisonTable` pivots every case's per-tag overlap breakdown
 * into one row per opponent-run tag (most frequent first) with a column per
 * case, so a team can see at a glance which specific tags each case shares
 * with the opponent instead of only each case's total overlap score.
 *
 * @module panels/StrategyPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/primitives/select"
import { Textarea } from "../ui/primitives/textarea"
import { EmptyState } from "../ui/panels/panel-shell"
import {
  buildCaseComparisonTable,
  buildStrategyRecommendationFromStores,
  buildStrategyRecommendationPrepNote,
  type CaseOption,
  type RiskLevel,
} from "../round/scout-to-strategy"
import { requestCaseChoiceEvaluation } from "../round/case-choice-client"
import type { DebateSide } from "debate-data-sync/src/rankings/opponent-team-profile"
import { useStrategyRecommendations } from "../hooks/useStrategyRecommendations"
import type { StrategyRecommendationRecord } from "../state/strategyRecommendations"
import { appendPrepNoteToPreRoundBriefing, listPreRoundBriefings } from "../state/preRoundBriefings"

type StrategyDraft = {
  matchupId: string
  opponentTeamId: string
  judgeId: string
  caseOptionsText: string
  ourSide: DebateSide | "unspecified"
}

const EMPTY_DRAFT: StrategyDraft = {
  matchupId: "",
  opponentTeamId: "",
  judgeId: "",
  caseOptionsText: "",
  ourSide: "unspecified",
}

const RISK_BADGE_VARIANT: Record<RiskLevel, "default" | "secondary" | "destructive"> = {
  low: "secondary",
  medium: "default",
  high: "destructive",
}

/** Parses one `Name: tag, tag` case option per line, skipping blank/unnamed lines. */
function parseCaseOptions(raw: string): CaseOption[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf(":")
      const name = (separatorIndex === -1 ? line : line.slice(0, separatorIndex)).trim()
      const tagsPart = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1)
      const argumentTags = tagsPart
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
      return { name, argumentTags }
    })
    .filter((option) => option.name.length > 0)
}

/**
 * Renders the Scout-to-Strategy panel: a form to build a matchup's strategy
 * recommendation from case options plus an optional opponent/judge profile
 * lookup, and every persisted `StrategyRecommendationRecord`, grouped by
 * matchup and sorted newest-first within each group, each with a "Clear"
 * action plus a per-matchup "Clear all history for this matchup" action.
 *
 * Reads localStorage (and, if signed in, the account) on mount via
 * `useStrategyRecommendations`, so it renders a loading state during
 * SSR/hydration rather than throwing.
 */
export function StrategyPanel() {
  const { groups, synced, appendRecommendation, deleteRecommendation, deleteMatchupHistory, setAiCaseChoice } =
    useStrategyRecommendations()
  const [draft, setDraft] = useState<StrategyDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [caseChoiceLoadingId, setCaseChoiceLoadingId] = useState<string | null>(null)
  const [caseChoiceErrorsById, setCaseChoiceErrorsById] = useState<Record<string, string>>({})
  const [briefingRoundIds, setBriefingRoundIds] = useState<string[]>([])
  const [briefingSelectionById, setBriefingSelectionById] = useState<Record<string, string>>({})
  const [briefingStatusById, setBriefingStatusById] = useState<Record<string, { ok: boolean; message: string }>>({})

  const refreshBriefingRoundIds = () => {
    setBriefingRoundIds(listPreRoundBriefings().map((record) => record.roundId).sort())
  }

  // Re-read on window focus and on cross-tab `storage` writes (not just on
  // mount), so a briefing created after this panel loaded — in another tab,
  // or in a co-rendered Pre-Round Briefings panel (e.g. the Coach hub) —
  // shows up in the "Send to Pre-Round Briefing" dropdown without a reload.
  useEffect(() => {
    refreshBriefingRoundIds()
    const handleFocus = () => refreshBriefingRoundIds()
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "preRoundBriefings") refreshBriefingRoundIds()
    }
    window.addEventListener("focus", handleFocus)
    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  const handleSubmit = () => {
    const matchupId = draft.matchupId.trim()
    const caseOptions = parseCaseOptions(draft.caseOptionsText)

    if (!matchupId) {
      setError("A matchup id is required.")
      return
    }
    if (caseOptions.length === 0) {
      setError("At least one case option is required, one per line as \"Name: tag, tag\".")
      return
    }

    const recommendation = buildStrategyRecommendationFromStores({
      caseOptions,
      opponentTeamId: draft.opponentTeamId.trim() || undefined,
      judgeId: draft.judgeId.trim() || undefined,
      ourSide: draft.ourSide === "unspecified" ? undefined : draft.ourSide,
    })
    appendRecommendation({ matchupId, recommendation, generatedAt: Date.now() })
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  const handleGetAiCaseChoice = async (record: StrategyRecommendationRecord) => {
    setCaseChoiceLoadingId(record.id)
    setCaseChoiceErrorsById((prev) => {
      const { [record.id]: _removed, ...rest } = prev
      return rest
    })
    try {
      const aiCaseChoice = await requestCaseChoiceEvaluation({
        caseRankings: record.recommendation.caseRankings,
        judgeAdaptationNotes: record.recommendation.judgeAdaptationNotes,
        riskLevel: record.recommendation.riskLevel,
        riskFactors: record.recommendation.riskFactors,
      })
      setAiCaseChoice(record.id, aiCaseChoice)
    } catch (err) {
      setCaseChoiceErrorsById((prev) => ({
        ...prev,
        [record.id]: err instanceof Error ? err.message : "Failed to get AI case-choice evaluation.",
      }))
    } finally {
      setCaseChoiceLoadingId(null)
    }
  }

  const handleSendToBriefing = (record: StrategyRecommendationRecord) => {
    const roundId = briefingSelectionById[record.id]
    if (!roundId) {
      setBriefingStatusById((prev) => ({
        ...prev,
        [record.id]: { ok: false, message: "Choose a saved briefing's round first." },
      }))
      return
    }

    const note = buildStrategyRecommendationPrepNote(record.recommendation, record.matchupId)
    const result = appendPrepNoteToPreRoundBriefing(roundId, note)
    setBriefingStatusById((prev) => ({
      ...prev,
      [record.id]: result.ok
        ? { ok: true, message: `Sent to the round ${roundId} briefing's prep notes.` }
        : { ok: false, message: result.error },
    }))
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Scout-to-Strategy</h1>
        <p className="text-sm text-muted-foreground">
          Rank case options against an opponent's scouted tendencies, get judge-adaptation notes,
          and see an overall matchup risk level. Every recommendation built for a matchup is kept
          as history, newest first.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {synced ? "Recommendation history is synced to your account." : "Sign in to sync your recommendation history."}
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="strategy-matchup-id">Matchup id</Label>
            <Input
              id="strategy-matchup-id"
              value={draft.matchupId}
              onChange={(e) => setDraft({ ...draft, matchupId: e.target.value })}
              placeholder="round-42"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="strategy-opponent-id">Opponent team id (optional)</Label>
            <Input
              id="strategy-opponent-id"
              value={draft.opponentTeamId}
              onChange={(e) => setDraft({ ...draft, opponentTeamId: e.target.value })}
              placeholder="OpponentA"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="strategy-judge-id">Judge id (optional)</Label>
            <Input
              id="strategy-judge-id"
              value={draft.judgeId}
              onChange={(e) => setDraft({ ...draft, judgeId: e.target.value })}
              placeholder="judge-123"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="strategy-our-side">Our side (optional)</Label>
            <Select
              value={draft.ourSide}
              onValueChange={(value) => setDraft({ ...draft, ourSide: value as StrategyDraft["ourSide"] })}
            >
              <SelectTrigger id="strategy-our-side">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unspecified">Unspecified</SelectItem>
                <SelectItem value="aff">Aff</SelectItem>
                <SelectItem value="neg">Neg</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="strategy-case-options">Case options (one per line: "Name: tag, tag")</Label>
          <Textarea
            id="strategy-case-options"
            value={draft.caseOptionsText}
            onChange={(e) => setDraft({ ...draft, caseOptionsText: e.target.value })}
            placeholder={"Topicality case: topicality, framework\nKritik case: kritik"}
            rows={3}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit}>Build recommendation</Button>
      </div>

      {groups === null ? (
        <div className="p-6 text-sm text-muted-foreground">Loading strategy recommendations…</div>
      ) : groups.length === 0 ? (
        <EmptyState title="No strategy recommendations yet." message="Build one above." />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.matchupId} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">
                  Matchup {group.matchupId}{" "}
                  <span className="text-muted-foreground">({group.recommendations.length})</span>
                </h2>
                <Button size="sm" variant="ghost" onClick={() => deleteMatchupHistory(group.matchupId)}>
                  Clear all history for this matchup
                </Button>
              </div>

              {group.recommendations.map((record) => {
                const { recommendation } = record
                return (
                  <div key={record.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.generatedAt).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={RISK_BADGE_VARIANT[recommendation.riskLevel]} className="whitespace-nowrap">
                          {recommendation.riskLevel} risk
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => deleteRecommendation(record.id)}>
                          Clear
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-md border border-border px-3 py-2 text-sm">
                        <p className="mb-1 font-medium text-foreground">Recommended case</p>
                        <p className="text-muted-foreground">
                          {recommendation.recommendedCase
                            ? `${recommendation.recommendedCase.name} (overlap score: ${recommendation.recommendedCase.overlapScore})`
                            : "No case options supplied."}
                        </p>
                      </div>

                      <div className="rounded-md border border-border px-3 py-2 text-sm">
                        <p className="mb-1 font-medium text-foreground">Case rankings</p>
                        <ul className="list-inside list-disc text-muted-foreground">
                          {recommendation.caseRankings.map((option) => (
                            <li key={option.name}>
                              {option.name} (overlap score: {option.overlapScore})
                            </li>
                          ))}
                        </ul>
                      </div>

                      {recommendation.caseRankings.length > 1 && (
                        <div className="rounded-md border border-border px-3 py-2 text-sm">
                          <p className="mb-1 font-medium text-foreground">Case comparison</p>
                          {(() => {
                            const table = buildCaseComparisonTable(recommendation.caseRankings)
                            return table.rows.length === 0 ? (
                              <p className="text-muted-foreground">No shared opponent-tag data to compare yet.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-max border-collapse text-left">
                                  <thead>
                                    <tr>
                                      <th className="border-b border-border py-1 pr-3 font-medium text-foreground">Tag</th>
                                      {table.caseNames.map((name) => (
                                        <th key={name} className="border-b border-border py-1 px-3 font-medium text-foreground">
                                          {name}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {table.rows.map((row) => (
                                      <tr key={row.tag}>
                                        <td className="py-1 pr-3 text-muted-foreground">{row.tag}</td>
                                        {table.caseNames.map((name) => (
                                          <td key={name} className="py-1 px-3 text-muted-foreground">
                                            {row.perCase[name] > 0 ? row.perCase[name] : "—"}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      <div className="rounded-md border border-border px-3 py-2 text-sm">
                        <p className="mb-1 font-medium text-foreground">Judge adaptation</p>
                        <ul className="list-inside list-disc text-muted-foreground">
                          {recommendation.judgeAdaptationNotes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>

                      {recommendation.riskFactors.length > 0 && (
                        <div className="rounded-md border border-border px-3 py-2 text-sm">
                          <p className="mb-1 font-medium text-foreground">Risk factors</p>
                          <ul className="list-inside list-disc text-muted-foreground">
                            {recommendation.riskFactors.map((factor) => (
                              <li key={factor}>{factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground">AI case-choice evaluation</p>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={caseChoiceLoadingId === record.id}
                            onClick={() => handleGetAiCaseChoice(record)}
                          >
                            {caseChoiceLoadingId === record.id
                              ? "Evaluating…"
                              : record.aiCaseChoice
                                ? "Re-evaluate"
                                : "Get AI case-choice evaluation"}
                          </Button>
                        </div>
                        {caseChoiceErrorsById[record.id] && (
                          <p className="mt-2 text-sm text-destructive">{caseChoiceErrorsById[record.id]}</p>
                        )}
                        {record.aiCaseChoice && (
                          <div className="mt-2 space-y-2 border-t border-border pt-2">
                            <p className="text-foreground">
                              <span className="font-medium">Recommended: </span>
                              {record.aiCaseChoice.recommendedCase}
                            </p>
                            <p className="text-muted-foreground">{record.aiCaseChoice.reasoning}</p>
                            <ul className="list-inside list-disc text-muted-foreground">
                              {record.aiCaseChoice.caseAssessments.map((assessment) => (
                                <li key={assessment.name}>
                                  <span className="font-medium text-foreground">{assessment.name}: </span>
                                  {assessment.assessment}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="rounded-md border border-border px-3 py-2 text-sm">
                        <p className="mb-1 font-medium text-foreground">Send to Pre-Round Briefing</p>
                        {briefingRoundIds.length === 0 ? (
                          <p className="text-muted-foreground">
                            No saved briefings yet — create one in Pre-Round Briefings first.
                          </p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={briefingSelectionById[record.id] ?? ""}
                              onValueChange={(value) =>
                                setBriefingSelectionById((prev) => ({ ...prev, [record.id]: value }))
                              }
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Choose a round" />
                              </SelectTrigger>
                              <SelectContent>
                                {briefingRoundIds.map((roundId) => (
                                  <SelectItem key={roundId} value={roundId}>
                                    {roundId}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" onClick={() => handleSendToBriefing(record)}>
                              Send
                            </Button>
                          </div>
                        )}
                        {briefingStatusById[record.id] && (
                          <p
                            className={`mt-1 text-xs ${
                              briefingStatusById[record.id].ok ? "text-muted-foreground" : "text-destructive"
                            }`}
                          >
                            {briefingStatusById[record.id].message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
