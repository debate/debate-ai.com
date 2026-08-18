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
 * @module panels/ResearchProgressPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-ui/src/primitives/table"
import { buildPersistedResearchProgressBoard } from "../state/researchProgress"
import type { ContributorProgress } from "../lib/research-progress"

/**
 * Renders the Research Progress roster: every contributor with either a
 * scored contribution or a routed task assignment, their contribution
 * history, and their per-topic task-completion counts.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function ResearchProgressPanel() {
  const [roster, setRoster] = useState<ContributorProgress[] | null>(null)

  useEffect(() => {
    setRoster(buildPersistedResearchProgressBoard())
  }, [])

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
          {roster.map((progress) => (
            <TableRow key={progress.contributorId}>
              <TableCell className="font-medium">{progress.contributorId}</TableCell>
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
                      <Badge key={topic.topic} variant="outline" className="whitespace-nowrap">
                        {topic.topic}: {topic.completedTaskCount}/{topic.assignedTaskCount}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
