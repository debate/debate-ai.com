/**
 * @fileoverview Scout-to-Strategy panel — the "(a) a case-choice/strategy
 * panel UI" follow-up named under the "Scout-to-Strategy Workflow" bullet in
 * TODO.md's Research Crowdsourcing Organizer Features list.
 *
 * Lets a team enter a matchup id, an optional opponent-team id and judge id
 * (looked up from the existing `opponentTeamProfiles.ts`/`judgeProfiles.ts`
 * stores), and a list of case options (one per line, `Name: tag, tag`), then
 * builds and persists a `StrategyRecommendation` via
 * `scout-to-strategy.ts`'s `buildStrategyRecommendationFromStores` — no new
 * scouting/ranking logic is introduced here. Lists every persisted
 * recommendation via `state/strategyRecommendations.ts`'s
 * `buildStrategyRecommendationsPanelView`, with a "Clear" action per matchup
 * that calls the already-persisted `deleteStrategyRecommendation`, mirroring
 * `PreRoundBriefingsPanel`'s create-form-plus-list convention.
 *
 * A "Get AI case-choice evaluation" action per matchup calls
 * `round/case-choice-client.ts`'s `requestCaseChoiceEvaluation` with the
 * recommendation's own case rankings, judge-adaptation notes, and risk
 * assessment, saves the result via `saveStrategyRecommendationAiCaseChoice`,
 * and renders it alongside the deterministic recommendation — closing
 * follow-up (c), "an actual AI-panel evaluation of case choice instead of
 * the tag-overlap heuristic."
 *
 * Also subscribes to the browser's `storage` event via `flow/live-update.ts`'s
 * `isStrategyLiveUpdateStorageEvent`, so a strategy recommendation built or
 * cleared in another tab refreshes this panel's list without a manual
 * reload — closing the "every other localStorage-backed panel in this repo
 * still has no cross-tab live-update mechanism" Known gap noted in
 * `shared-flow-sync.md`, for this panel.
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
import { buildStrategyRecommendationFromStores, type CaseOption, type RiskLevel } from "../round/scout-to-strategy"
import { requestCaseChoiceEvaluation } from "../round/case-choice-client"
import type { DebateSide } from "debate-data-sync/src/rankings/opponent-team-profile"
import {
  buildStrategyRecommendationsPanelView,
  deleteStrategyRecommendation,
  saveStrategyRecommendation,
  saveStrategyRecommendationAiCaseChoice,
} from "../state/strategyRecommendations"
import type { StrategyRecommendationRecord } from "../state/strategyRecommendations"
import { isStrategyLiveUpdateStorageEvent } from "../flow/live-update"

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
 * lookup, and every persisted `StrategyRecommendationRecord`, each with a
 * "Clear" action.
 *
 * Reads localStorage on mount (client-side), so it renders a loading state
 * during SSR/hydration rather than throwing, and again on a `storage` event
 * from another tab.
 */
export function StrategyPanel() {
  const [records, setRecords] = useState<StrategyRecommendationRecord[] | null>(null)
  const [draft, setDraft] = useState<StrategyDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [caseChoiceLoadingId, setCaseChoiceLoadingId] = useState<string | null>(null)
  const [caseChoiceErrorsById, setCaseChoiceErrorsById] = useState<Record<string, string>>({})

  useEffect(() => {
    setRecords(buildStrategyRecommendationsPanelView())
  }, [])

  const refresh = () => setRecords(buildStrategyRecommendationsPanelView())

  /**
   * Live-update the strategy-recommendation list when another browser tab
   * builds or clears a recommendation. A `storage` event never fires in the
   * tab that made the write, only in other tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isStrategyLiveUpdateStorageEvent(event)) return
      refresh()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
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
    saveStrategyRecommendation({ matchupId, recommendation })
    setDraft(EMPTY_DRAFT)
    setError(null)
    refresh()
  }

  const handleClear = (matchupId: string) => {
    deleteStrategyRecommendation(matchupId)
    refresh()
  }

  const handleGetAiCaseChoice = async (record: StrategyRecommendationRecord) => {
    setCaseChoiceLoadingId(record.matchupId)
    setCaseChoiceErrorsById((prev) => {
      const { [record.matchupId]: _removed, ...rest } = prev
      return rest
    })
    try {
      const aiCaseChoice = await requestCaseChoiceEvaluation({
        caseRankings: record.recommendation.caseRankings,
        judgeAdaptationNotes: record.recommendation.judgeAdaptationNotes,
        riskLevel: record.recommendation.riskLevel,
        riskFactors: record.recommendation.riskFactors,
      })
      saveStrategyRecommendationAiCaseChoice(record.matchupId, aiCaseChoice)
      refresh()
    } catch (err) {
      setCaseChoiceErrorsById((prev) => ({
        ...prev,
        [record.matchupId]: err instanceof Error ? err.message : "Failed to get AI case-choice evaluation.",
      }))
    } finally {
      setCaseChoiceLoadingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Scout-to-Strategy</h1>
        <p className="text-sm text-muted-foreground">
          Rank case options against an opponent's scouted tendencies, get judge-adaptation notes,
          and see an overall matchup risk level.
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

      {records === null ? (
        <div className="p-6 text-sm text-muted-foreground">Loading strategy recommendations…</div>
      ) : records.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No strategy recommendations yet. Build one above.
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const { matchupId, recommendation } = record
            return (
            <div key={matchupId} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Matchup {matchupId}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant={RISK_BADGE_VARIANT[recommendation.riskLevel]} className="whitespace-nowrap">
                    {recommendation.riskLevel} risk
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => handleClear(matchupId)}>
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
                      disabled={caseChoiceLoadingId === matchupId}
                      onClick={() => handleGetAiCaseChoice({ matchupId, recommendation })}
                    >
                      {caseChoiceLoadingId === matchupId
                        ? "Evaluating…"
                        : record.aiCaseChoice
                          ? "Re-evaluate"
                          : "Get AI case-choice evaluation"}
                    </Button>
                  </div>
                  {caseChoiceErrorsById[matchupId] && (
                    <p className="mt-2 text-sm text-destructive">{caseChoiceErrorsById[matchupId]}</p>
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
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
