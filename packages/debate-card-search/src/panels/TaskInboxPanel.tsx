/**
 * @fileoverview Task Inbox panel — the UI follow-up named "(c) a
 * task-assignment/inbox UI" under the "Research Task Routing" bullet in
 * TODO.md.
 *
 * Reads every persisted routed task queue via `state/routedTaskQueues.ts`'s
 * `buildTaskInboxView` (itself a thin composition of `listRoutedTaskQueues`
 * against the persisted `contributorAvailability.ts` store for each
 * assignee's current skill level) and renders it grouped by topic: each
 * assignment can be marked complete, which calls the already-persisted
 * `completePersistedRoutedTask` — removing it from the stored queue and
 * decrementing the assignee's stored `activeTaskCount` — rather than
 * introducing new mutation logic here.
 *
 * @module panels/TaskInboxPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { buildTaskInboxView, completePersistedRoutedTask, type TaskInboxTopic } from "../state/routedTaskQueues"
import type { CoverageLevel } from "../lib/topic-coverage"

const LEVEL_VARIANT: Record<CoverageLevel, "default" | "secondary" | "outline"> = {
  missing: "default",
  thin: "secondary",
  covered: "outline",
}

/**
 * Renders the Task Inbox: every topic with a persisted routed task queue,
 * its assignments (contributor, task, required skill) with a "Mark
 * complete" action, and any tasks nobody was eligible/available for.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function TaskInboxPanel() {
  const [topics, setTopics] = useState<TaskInboxTopic[] | null>(null)

  useEffect(() => {
    setTopics(buildTaskInboxView())
  }, [])

  const handleComplete = (topicId: string, argBlock: string) => {
    completePersistedRoutedTask(topicId, argBlock)
    setTopics(buildTaskInboxView())
  }

  if (topics === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading task inbox…</div>
  }

  if (topics.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No research tasks routed yet. The inbox fills in once a topic's coverage gaps are routed to
        contributors.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Task Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Research tasks routed to contributors, grouped by topic. Mark a task complete once it's done.
        </p>
      </div>
      {topics.map((topic) => (
        <div key={topic.topicId} className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{topic.topicId}</h2>
          {topic.assignments.length === 0 && topic.unassignedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks routed for this topic.</p>
          ) : (
            <div className="space-y-2">
              {topic.assignments.map((assignment) => (
                <div
                  key={assignment.task.argBlock}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{assignment.task.argBlock}</span>
                    <Badge variant={LEVEL_VARIANT[assignment.task.level]}>{assignment.task.level}</Badge>
                    <span className="text-muted-foreground">assigned to</span>
                    <span className="font-medium text-foreground">{assignment.contributorId}</span>
                    {assignment.contributorSkillLevel && (
                      <Badge variant="outline" className="capitalize">
                        {assignment.contributorSkillLevel}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleComplete(topic.topicId, assignment.task.argBlock)}
                  >
                    Mark complete
                  </Button>
                </div>
              ))}
              {topic.unassignedTasks.map((task) => (
                <div
                  key={task.argBlock}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium text-foreground">{task.argBlock}</span>
                  <Badge variant={LEVEL_VARIANT[task.level]}>{task.level}</Badge>
                  <span className="text-muted-foreground">
                    unassigned — no eligible contributor available
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
