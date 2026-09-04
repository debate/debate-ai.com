/**
 * @fileoverview Practice Drills panel — the UI follow-up named "(a) a
 * drill-panel UI that reads/writes through the persistence store" under the
 * "📚 AI Drill Generator" bullet in TODO.md.
 *
 * Reads every persisted drill set via `state/drillSets.ts`'s
 * `buildDrillSetsPanelView` (a stable-order sort of `listDrillSets`) and
 * renders each round's drills grouped by round, with a "Clear" action that
 * calls the already-persisted `deleteDrillSet` — no new drill-generation
 * logic is introduced here.
 *
 * A "Get AI script" action per drill calls `round/drill-script-client.ts`'s
 * `requestDrillScript` with that drill and its round's side, saves the
 * result via `saveDrillAiScript`, and renders it under the template prompt
 * — closing follow-up (b), "an actual AI-generated (rather than templated)
 * script."
 *
 * A "Generate drills for current round" form reads the round workspace's
 * currently selected flow (`state/store.ts`'s `useFlowStore`, the same
 * mechanism `CoachingProgramsPanel`'s "Save current flow" action uses) and,
 * given a side, derives and persists that round's drill set via
 * `state/drillSets.ts`'s `buildAndSaveDrillSet` — closing
 * `docs/features/drill-sets.md`'s "no affordance in this panel to generate a
 * new drill set for a round" Known gap. No new drill-generation logic is
 * introduced here.
 *
 * A "Difficulty" filter dropdown above the drill list narrows every round's
 * drills to one `DrillDifficulty` at a time via
 * `flow/drill-generator.ts`'s `filterDrillsByDifficulty` — the "difficulty
 * rating with filtering" follow-up named under the "📚 AI Drill Generator"
 * bullet in TODO.md. Each drill also shows a difficulty badge next to its
 * kind badge.
 *
 * Each drill also has a "Mark practiced"/"✓ Practiced" toggle
 * (`state/drillSets.ts`'s `toggleDrillCompletion`), and each round card
 * shows a `MeterBar` summarizing how many of its drills are marked
 * practiced (`getDrillSetCompletionStats`) — the "completion tracking"
 * follow-up named under the "📚 AI Drill Generator" bullet.
 *
 * A "Practice tier" card above the round list now closes the other half of
 * that same follow-up, "tying completion into the Progress Unlocks tier
 * system (awarding tiers/badges for practiced drills)": it shows the tier
 * and badges `state/drillProgressUnlocks.ts`'s
 * `buildDrillPracticeUnlockStatus` derives from the total practiced-drill
 * count across every persisted round (reusing `debate-card-search`'s
 * `lib/progress-unlocks.ts` tier thresholds and badge names directly), plus
 * a `MeterBar` toward the next tier. This is a local, drill-set-scoped
 * status — see `state/drillProgressUnlocks.ts`'s fileoverview for why it
 * doesn't post into the real, cross-tool Contribution Leaderboard roster.
 *
 * Each drill also has a "Review reminder" date field
 * (`state/drillSets.ts`'s `scheduleDrillReview`) — the "drill
 * scheduling/reminders" follow-up named under the "📚 AI Drill Generator"
 * bullet. Once the scheduled day arrives, that drill gets a "Due" badge and
 * the round card's heading gets a "N due for review" badge
 * (`getDueDrillIndexes`); there's no push-notification infrastructure in
 * this repo, so the "reminder" is this in-app badge, seen next time the
 * panel is visited.
 *
 * Every drill set (including its completion/AI-script/review-reminder
 * state) is now account-synced across devices for a signed-in user, via
 * `hooks/useDrillSets.ts` — the "sharing the 'Practice tier' status across
 * devices" follow-up named in `docs/features/drill-sets.md`'s Known gaps.
 * This panel reads/writes exclusively through that hook now, in place of
 * `state/drillSets.ts`'s mutating functions directly.
 *
 * @module panels/DrillSetsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives/select"
import { EmptyState, MeterBar, PanelRow } from "../ui/panels/panel-shell"
import { getDrillSetCompletionStats, getDueDrillIndexes, type DrillSetRecord } from "../state/drillSets"
import { buildDrillPracticeUnlockStatus, getTotalCompletedDrillCount } from "../state/drillProgressUnlocks"
import { filterDrillsByDifficulty, type DrillDifficulty, type DrillKind } from "../flow/drill-generator"
import { requestDrillScript } from "../round/drill-script-client"
import { useFlowStore } from "../state/store"
import { useDrillSets } from "../hooks/useDrillSets"

const DRILL_KIND_LABELS: Record<DrillKind, string> = {
  overview: "Overview",
  frontline: "Frontline",
  cross_ex: "Cross-Ex",
  collapse: "Collapse",
}

type DifficultyFilter = DrillDifficulty | "all"

const DIFFICULTY_FILTER_OPTIONS: DifficultyFilter[] = ["all", "easy", "medium", "hard"]

const DIFFICULTY_FILTER_LABELS: Record<DifficultyFilter, string> = {
  all: "All difficulties",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

const DIFFICULTY_BADGE_VARIANTS: Record<DrillDifficulty, "default" | "secondary" | "destructive"> = {
  easy: "secondary",
  medium: "default",
  hard: "destructive",
}

/** Mirrors `ProgressUnlocksPanel`'s own tier→badge-variant mapping, so a tier reads the same way in both panels. */
const TIER_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  novice: "outline",
  apprentice: "secondary",
  veteran: "secondary",
  expert: "default",
}

/** Today's local calendar day (`YYYY-MM-DD`), for comparing against a drill's `scheduledReviewAt`. */
function todayLocalDayKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Renders the Practice Drills panel: every persisted `DrillSetRecord`,
 * grouped by round, with a "Clear" action per round.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function DrillSetsPanel() {
  const {
    drillSets,
    synced,
    buildAndSaveDrillSet,
    deleteDrillSet,
    saveDrillAiScript,
    toggleDrillCompletion,
    scheduleDrillReview,
  } = useDrillSets()
  const [scriptLoadingKey, setScriptLoadingKey] = useState<string | null>(null)
  const [scriptErrorsByKey, setScriptErrorsByKey] = useState<Record<string, string>>({})
  const [generateSideKey, setGenerateSideKey] = useState("")
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all")

  const flows = useFlowStore((state) => state.flows)
  const selected = useFlowStore((state) => state.selected)
  const currentFlow = mounted ? flows[selected] : undefined
  const todayKey = todayLocalDayKey()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleClear = (roundId: string) => {
    deleteDrillSet(roundId)
  }

  const handleGenerate = () => {
    if (!currentFlow) return
    const sideKey = generateSideKey.trim()
    if (!sideKey) {
      setGenerateError("A side (e.g. aff or neg) is required to generate drills.")
      return
    }
    buildAndSaveDrillSet(currentFlow, String(currentFlow.id), sideKey)
    setGenerateError(null)
    setGenerateSideKey("")
  }

  const handleToggleCompletion = (roundId: string, drillIndex: number) => {
    toggleDrillCompletion(roundId, drillIndex)
  }

  const handleScheduleReview = (roundId: string, drillIndex: number, dayKey: string | null) => {
    scheduleDrillReview(roundId, drillIndex, dayKey)
  }

  const handleGetAiScript = async (set: DrillSetRecord, drillIndex: number) => {
    const key = `${set.roundId}:${drillIndex}`
    setScriptLoadingKey(key)
    setScriptErrorsByKey((prev) => {
      const { [key]: _removed, ...rest } = prev
      return rest
    })
    try {
      const script = await requestDrillScript({ sideKey: set.sideKey, drill: set.drills[drillIndex] })
      saveDrillAiScript(set.roundId, drillIndex, script)
    } catch (error) {
      setScriptErrorsByKey((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Failed to get AI script.",
      }))
    } finally {
      setScriptLoadingKey(null)
    }
  }

  if (drillSets === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading drills…</div>
  }

  const totalCompletedDrills = getTotalCompletedDrillCount(drillSets)
  const unlockStatus = buildDrillPracticeUnlockStatus(totalCompletedDrills)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Practice Drills</h1>
        <p className="text-sm text-muted-foreground">
          Quick practice drills generated from each round's flow — overview, frontline, cross-ex,
          and collapse-scenario prompts.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {synced
            ? "Drill sets — including AI scripts, completion, and review reminders — are synced to your account."
            : "Sign in to sync your drill sets across devices."}
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <Label htmlFor="drill-set-generate-side">Generate drills for current round</Label>
          <p className="text-xs text-muted-foreground">
            Uses the round workspace's currently selected flow.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            id="drill-set-generate-side"
            value={generateSideKey}
            onChange={(e) => setGenerateSideKey(e.target.value)}
            placeholder="Side (e.g. aff)"
            className="w-40"
          />
          <Button size="sm" disabled={!currentFlow} onClick={handleGenerate}>
            Generate drills
          </Button>
        </div>
        {!currentFlow && (
          <p className="text-sm text-muted-foreground">
            Select a round's flow in the round workspace to generate drills for it.
          </p>
        )}
        {generateError && <p className="text-sm text-destructive">{generateError}</p>}
      </div>

      {drillSets.length === 0 && (
        <EmptyState
          title="No practice drills yet."
          message="Drills fill in once a round's flow generates a drill set."
        />
      )}
      {drillSets.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Practice tier</h2>
            <Badge variant={TIER_BADGE_VARIANT[unlockStatus.tier] ?? "outline"} className="capitalize">
              {unlockStatus.tier}
            </Badge>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            {totalCompletedDrills} drill{totalCompletedDrills === 1 ? "" : "s"} practiced across every round —
            shares the same Progress Unlocks tiers and badges as the rest of the site.
          </p>
          {unlockStatus.badges.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {unlockStatus.badges.map((badge) => (
                <Badge key={badge} variant="outline" className="whitespace-nowrap">
                  {badge}
                </Badge>
              ))}
            </div>
          )}
          {unlockStatus.nextTier ? (
            <>
              <MeterBar
                value={Math.round(unlockStatus.nextTier.progressRatio * 100)}
                max={100}
                caption={`${Math.round(unlockStatus.nextTier.progressRatio * 100)}% to ${unlockStatus.nextTier.tier}`}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {unlockStatus.nextTier.completedTasksNeeded} more practiced drill
                {unlockStatus.nextTier.completedTasksNeeded === 1 ? "" : "s"} to reach {unlockStatus.nextTier.tier}.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Top tier reached.</p>
          )}
        </div>
      )}
      {drillSets.length > 0 && (
        <div className="flex items-center gap-2">
          <Label htmlFor="drill-set-difficulty-filter">Difficulty</Label>
          <Select
            value={difficultyFilter}
            onValueChange={(value) => setDifficultyFilter(value as DifficultyFilter)}
          >
            <SelectTrigger id="drill-set-difficulty-filter" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTY_FILTER_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {DIFFICULTY_FILTER_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {drillSets.map((set) => {
        const visibleDrills = filterDrillsByDifficulty(set.drills, difficultyFilter)
        const completionStats = getDrillSetCompletionStats(set)
        const dueDrillIndexes = getDueDrillIndexes(set, todayKey)
        return (
          <div key={set.roundId} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Round {set.roundId}{" "}
                <span className="font-normal text-muted-foreground">({set.sideKey})</span>
              </h2>
              <div className="flex items-center gap-2">
                {dueDrillIndexes.length > 0 && (
                  <Badge variant="destructive" className="whitespace-nowrap">
                    {dueDrillIndexes.length} due for review
                  </Badge>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleClear(set.roundId)}>
                  Clear
                </Button>
              </div>
            </div>
            {completionStats.total > 0 && (
              <div className="mb-3">
                <MeterBar
                  value={completionStats.completed}
                  max={completionStats.total}
                  label="Practiced"
                  caption={`${completionStats.completed} of ${completionStats.total}`}
                  tone={completionStats.completed === completionStats.total ? "positive" : "info"}
                />
              </div>
            )}
            {visibleDrills.length === 0 && (
              <p className="text-sm text-muted-foreground">No drills match this difficulty filter.</p>
            )}
            <div className="space-y-2">
              {visibleDrills.map((drill) => {
                const index = set.drills.indexOf(drill)
                const key = `${set.roundId}:${index}`
                const aiScript = set.aiScripts?.[index]
                const isCompleted = (set.completedDrillIndexes ?? []).includes(index)
                const scheduledReviewAt = set.scheduledReviewAt?.[index]
                const isDue = dueDrillIndexes.includes(index)
                return (
                  <PanelRow
                    key={index}
                    leading={
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="whitespace-nowrap">
                          {DRILL_KIND_LABELS[drill.kind]}
                        </Badge>
                        <Badge
                          variant={DIFFICULTY_BADGE_VARIANTS[drill.difficulty]}
                          className="whitespace-nowrap"
                        >
                          {DIFFICULTY_FILTER_LABELS[drill.difficulty]}
                        </Badge>
                        {isDue && (
                          <Badge variant="destructive" className="whitespace-nowrap">
                            Due
                          </Badge>
                        )}
                      </div>
                    }
                    title={drill.prompt}
                    trailing={
                      <>
                        <Button
                          size="sm"
                          variant={isCompleted ? "secondary" : "outline"}
                          onClick={() => handleToggleCompletion(set.roundId, index)}
                        >
                          {isCompleted ? "✓ Practiced" : "Mark practiced"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={scriptLoadingKey === key}
                          onClick={() => handleGetAiScript(set, index)}
                        >
                          {scriptLoadingKey === key
                            ? "Getting script…"
                            : aiScript
                              ? "Regenerate AI script"
                              : "Get AI script"}
                        </Button>
                      </>
                    }
                  >
                    {scriptErrorsByKey[key] && (
                      <p className="text-sm text-destructive">{scriptErrorsByKey[key]}</p>
                    )}
                    {aiScript && (
                      <p className="whitespace-pre-wrap border-t border-border pt-2 text-sm text-foreground">
                        {aiScript}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                      <Label htmlFor={`drill-review-${key}`} className="text-xs text-muted-foreground">
                        Review reminder
                      </Label>
                      <Input
                        id={`drill-review-${key}`}
                        type="date"
                        value={scheduledReviewAt ?? ""}
                        onChange={(e) => handleScheduleReview(set.roundId, index, e.target.value || null)}
                        className="w-40"
                      />
                      {scheduledReviewAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleScheduleReview(set.roundId, index, null)}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </PanelRow>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
