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
 * @module panels/ResearchProgressPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/primitives/table"
import {
  buildPersistedResearchProgressBoard,
  deleteCompletedTaskHistoryForTopic,
} from "../state/researchProgress"
import { isOwnContributorRow } from "../lib/session-identity"
import { isResearchProgressLiveUpdateStorageEvent } from "../state/live-update"
import type { ContributorProgress } from "../lib/research-progress"

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
    deleteCompletedTaskHistoryForTopic(topic)
    setRoster(buildPersistedResearchProgressBoard())
  }

  if (roster === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading research progress…</div>
  }

  if (roster.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No progress yet. This fills in once contributors submit contributions or have research
        tasks routed to them.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Research Progress</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Each contributor's contribution history and per-topic task completion.
      </p>
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
    </div>
  )
}
