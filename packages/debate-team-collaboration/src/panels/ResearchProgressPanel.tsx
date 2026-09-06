/**
 * @fileoverview Research Progress panel — the UI half of the "(b) a
 * progress dashboard/roster UI" follow-up named under the "📈 Research
 * Progress Tracking" bullet in TODO.md.
 *
 * Reads every contributor's progress via `state/researchProgress.ts`'s
 * `buildPersistedResearchProgressBoard` (itself a thin composition of the
 * persisted `state/contributions.ts` contribution list, every persisted
 * completed task, and every still-active `state/routedTaskQueues.ts`
 * assignment) and renders it as a roster: contribution history, then
 * per-topic task-completion counts — reusing
 * `lib/research-progress.ts`'s `ContributorProgress`/`TopicProgress` shape
 * directly rather than introducing new aggregation logic here.
 *
 * A per-topic "Clear completed history" action closes the "a completed
 * task's history record is never deleted" Known gap recorded in
 * `docs/features/research-progress-tracking.md`, calling
 * `state/researchProgress.ts`'s `deleteCompletedTaskHistoryForTopic` and
 * re-reading the board.
 *
 * An optional `signedInContributorId` prop (built from
 * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`
 * against a real signed-in session) highlights that contributor's own row
 * with a "You" badge via `isOwnContributorRow` — this roster always shows
 * every contributor, so unlike Task Inbox's "My tasks" prefill there is
 * nothing to filter or prefill here, only to highlight.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isResearchProgressLiveUpdateStorageEvent`, so a contribution, completed
 * task, or routed task queue change recorded in another tab refreshes this
 * panel's roster without a manual reload — closing the "Every other
 * localStorage-backed panel in this repo still has no cross-tab
 * live-update mechanism" Known gap noted in `shared-flow-sync.md`, for this
 * panel.
 *
 * A "Download report" button exports the whole roster as a plain-text file
 * via `lib/research-progress.ts`'s `buildResearchProgressReportText` (mirrors
 * `PreRoundBriefingsPanel.tsx`'s anchor+Blob download pattern) — the
 * "printable/exportable progress report" follow-up named under the "📈
 * Research Progress Tracking" bullet in TODO.md.
 *
 * A "Topic comparison" section below the roster rolls each contributor's
 * own per-topic counts up into one row per topic across the whole team via
 * `lib/research-progress.ts`'s `buildTeamTopicComparison`, least-covered
 * topic first — the "topic-comparison view across the whole team"
 * follow-up named under the same TODO.md bullet.
 *
 * A "My research goal" section, shown only for a signed-in visitor
 * (`signedInContributorId`), lets them set a personal completed-task target
 * — optionally scoped to one topic — and tracks progress toward it with a
 * `MeterBar` via `hooks/useResearchProgressGoalSync.ts` (wrapping
 * `state/researchProgressGoals.ts`) — the "personal goal-setting UI" and
 * "account-syncing the goal across devices" follow-ups named under the same
 * TODO.md bullet.
 *
 * @module panels/ResearchProgressPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import { Button } from "debate-research-evidence/src/ui/primitives/button"
import { Input } from "debate-research-evidence/src/ui/primitives/input"
import { Label } from "debate-research-evidence/src/ui/primitives/label"
import { MeterBar } from "debate-research-evidence/src/ui/panels/panel-shell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-research-evidence/src/ui/primitives/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-research-evidence/src/ui/primitives/table"
import {
  buildPersistedResearchProgressBoard,
  deleteCompletedTaskHistoryForTopic,
} from "../state/researchProgress"
import { listTrackedTopics } from "debate-research-evidence/src/state/trackedArguments"
import { useResearchProgressGoalSync } from "../hooks/useResearchProgressGoalSync"
import { isOwnContributorRow } from "debate-research-evidence/src/lib/session-identity"
import { isResearchProgressLiveUpdateStorageEvent } from "debate-research-evidence/src/state/live-update"
import {
  buildResearchProgressReportText,
  buildTeamTopicComparison,
  researchProgressReportFilename,
  type ContributorProgress,
} from "../lib/research-progress"

const ALL_TOPICS_VALUE = "__all_topics__"

export interface ResearchProgressPanelProps {
  /**
   * A contributor id to highlight as "You" in the roster, typically derived
   * from a real signed-in session via `deriveContributorIdFromSessionIdentity`.
   * This roster always shows every contributor — this only highlights a
   * matching row, it never filters the others out.
   */
  signedInContributorId?: string
}

/**
 * Renders the Research Progress roster: every contributor with either a
 * scored contribution or a routed task assignment, their contribution
 * history, and their per-topic task-completion counts.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function ResearchProgressPanel({ signedInContributorId }: ResearchProgressPanelProps = {}) {
  const [roster, setRoster] = useState<ContributorProgress[] | null>(null)

  useEffect(() => {
    setRoster(buildPersistedResearchProgressBoard())
  }, [])

  /**
   * Live-update the roster when another browser tab records a contribution,
   * completes a task, or routes a topic's task queue. A `storage` event
   * never fires in the tab that made the write, only in other tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isResearchProgressLiveUpdateStorageEvent(event)) return
      setRoster(buildPersistedResearchProgressBoard())
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const handleClearTopicHistory = (topic: string) => {
    // This deletes every contributor's completed-task history for the topic,
    // not just the row it was clicked from — confirm before the wipe.
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Clear the completed-task history for "${topic}" for every contributor? This can't be undone.`,
      )
    ) {
      return
    }
    deleteCompletedTaskHistoryForTopic(topic)
    setRoster(buildPersistedResearchProgressBoard())
  }

  const {
    goalProgress,
    saveGoal,
    clearGoal,
    refresh: refreshGoalProgress,
    error: goalSyncError,
  } = useResearchProgressGoalSync(signedInContributorId)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [draftTarget, setDraftTarget] = useState("")
  const [draftTopic, setDraftTopic] = useState(ALL_TOPICS_VALUE)
  const [draftTargetDate, setDraftTargetDate] = useState("")
  const [goalError, setGoalError] = useState<string | null>(null)

  // Re-reads the goal whenever the underlying board changes (a completed
  // task can push a goal over its target), mirroring the roster's own
  // storage-event refresh above. `useResearchProgressGoalSync` already
  // refreshes on mount and once its account sync resolves.
  useEffect(() => {
    refreshGoalProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster])

  const openGoalForm = () => {
    setDraftTarget(goalProgress ? String(goalProgress.goal.targetCompletedTaskCount) : "")
    setDraftTopic(goalProgress?.goal.topic ?? ALL_TOPICS_VALUE)
    setDraftTargetDate(goalProgress?.goal.targetDate ?? "")
    setGoalError(null)
    setIsEditingGoal(true)
  }

  const handleSaveGoal = () => {
    if (!signedInContributorId) return
    const target = Number(draftTarget)
    if (!Number.isFinite(target) || target <= 0) {
      setGoalError("Enter a target number of tasks greater than 0.")
      return
    }
    const saved = saveGoal(
      Math.round(target),
      draftTopic === ALL_TOPICS_VALUE ? undefined : draftTopic,
      draftTargetDate.trim() || undefined,
    )
    if (!saved) {
      setGoalError(goalSyncError ?? "Could not save goal.")
      return
    }
    setGoalError(null)
    setIsEditingGoal(false)
  }

  const handleClearGoal = () => {
    if (!signedInContributorId) return
    clearGoal()
    setIsEditingGoal(false)
  }

  /** Mirrors `PreRoundBriefingsPanel.tsx`'s anchor+Blob download pattern. */
  const handleDownloadReport = () => {
    if (roster === null) return
    const text = buildResearchProgressReportText(roster)
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = researchProgressReportFilename()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (roster === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading research progress…</div>
  }

  const topicComparison = buildTeamTopicComparison(roster)
  // A goal can be set for a topic no one has an assignment in yet — offer
  // every tracked topic alongside the roster-derived ones.
  const goalTopicOptions = Array.from(
    new Set([...topicComparison.map((topic) => topic.topic), ...listTrackedTopics()]),
  ).sort((a, b) => a.localeCompare(b))

  // The goal section renders even on an empty roster — a brand-new signed-in
  // contributor with no tracked work yet is exactly who goal-setting is for.
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-foreground">Research Progress</h1>
          <p className="text-sm text-muted-foreground">
            Each contributor's contribution history and per-topic task completion.
          </p>
        </div>
        {roster.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleDownloadReport}>
            Download report
          </Button>
        )}
      </div>

      {signedInContributorId && (
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">My research goal</h2>
          {isEditingGoal ? (
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
              <div className="space-y-1.5">
                <Label htmlFor="research-goal-target">Target completed tasks</Label>
                <Input
                  id="research-goal-target"
                  type="number"
                  min={1}
                  step={1}
                  className="w-32"
                  value={draftTarget}
                  onChange={(e) => setDraftTarget(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="research-goal-topic">Topic</Label>
                <Select value={draftTopic} onValueChange={setDraftTopic}>
                  <SelectTrigger id="research-goal-topic" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TOPICS_VALUE}>All topics</SelectItem>
                    {goalTopicOptions.map((topic) => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="research-goal-target-date">Target date (optional)</Label>
                <Input
                  id="research-goal-target-date"
                  type="date"
                  className="w-40"
                  value={draftTargetDate}
                  onChange={(e) => setDraftTargetDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveGoal}>
                  Save goal
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingGoal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : goalProgress ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {goalProgress.goal.topic
                    ? `${goalProgress.currentCompletedTaskCount}/${goalProgress.goal.targetCompletedTaskCount} tasks completed in ${goalProgress.goal.topic}`
                    : `${goalProgress.currentCompletedTaskCount}/${goalProgress.goal.targetCompletedTaskCount} tasks completed`}
                  {goalProgress.goal.targetDate ? ` by ${goalProgress.goal.targetDate}` : ""}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={openGoalForm}>
                    Update goal
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleClearGoal}>
                    Clear goal
                  </Button>
                </div>
              </div>
              <MeterBar
                value={Math.round(goalProgress.progressRatio * 100)}
                max={100}
                caption={
                  goalProgress.isComplete
                    ? undefined
                    : `${goalProgress.remainingTaskCount} more task${goalProgress.remainingTaskCount === 1 ? "" : "s"} to go`
                }
              />
              {goalProgress.isComplete && (
                <Badge variant="outline" className="whitespace-nowrap">
                  🎉 Goal reached
                </Badge>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Set a personal target to track your own progress toward, overall or for one topic.
              </p>
              <Button size="sm" variant="outline" onClick={openGoalForm}>
                Set a goal
              </Button>
            </div>
          )}
          {goalError && <p className="mt-2 text-sm text-destructive">{goalError}</p>}
        </div>
      )}

      {roster.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No progress yet. This fills in once contributors submit contributions or have research
          tasks routed to them.
        </div>
      )}

      {roster.length > 0 && (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contributor</TableHead>
            <TableHead>Contributions</TableHead>
            <TableHead className="text-right">Tasks</TableHead>
            <TableHead>Topics</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((progress) => {
            const isMe = isOwnContributorRow(progress.contributorId, signedInContributorId)
            return (
            <TableRow key={progress.contributorId} className={isMe ? "bg-primary/5" : undefined}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-1.5">
                  {progress.contributorId}
                  {isMe && (
                    <Badge variant="outline" className="whitespace-nowrap">
                      You
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {progress.contributionStats === null
                  ? "—"
                  : `${progress.contributionStats.contributionCount} (${progress.contributionStats.totalHelpfulnessScore} pts)`}
              </TableCell>
              <TableCell className="text-right">
                {progress.totalAssignedTasks === 0
                  ? "—"
                  : `${progress.totalCompletedTasks}/${progress.totalAssignedTasks} (${Math.round(progress.overallCompletionRate * 100)}%)`}
              </TableCell>
              <TableCell>
                {progress.topics.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {progress.topics.map((topic) => (
                      <div key={topic.topic} className="flex items-center gap-1">
                        <Badge variant="outline" className="whitespace-nowrap">
                          {topic.topic}: {topic.completedTaskCount}/{topic.assignedTaskCount}
                        </Badge>
                        {topic.completedTaskCount > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1 text-xs text-muted-foreground"
                            onClick={() => handleClearTopicHistory(topic.topic)}
                          >
                            Clear completed history
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>
      )}

      {topicComparison.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-1 text-lg font-semibold text-foreground">Topic comparison</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Task completion rolled up across the whole team, least-covered topic first.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead className="text-right">Contributors</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="min-w-40">Completion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topicComparison.map((topic) => (
                <TableRow key={topic.topic}>
                  <TableCell className="font-medium">{topic.topic}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{topic.contributorCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {topic.completedTaskCount}/{topic.assignedTaskCount}
                  </TableCell>
                  <TableCell>
                    <MeterBar
                      value={Math.round(topic.completionRate * 100)}
                      max={100}
                      caption={`${Math.round(topic.completionRate * 100)}%`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
