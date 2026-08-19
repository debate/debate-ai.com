/**
 * @fileoverview Task Inbox panel — the UI follow-up named "(c) a
 * task-assignment/inbox UI" under the "Research Task Routing" bullet in
 * TODO.md.
 *
 * Reads every persisted routed task queue via `state/routedTaskQueues.ts`'s
 * `buildTaskInboxView` (itself a thin composition of `listRoutedTaskQueues`
 * against the persisted `contributorAvailability.ts` store for each
 * assignee's current skill level) and renders it grouped by topic: each
 * assignment can be marked complete, which calls
 * `state/researchProgress.ts`'s `completeAndRecordResearchTask` — it removes
 * the assignment from the stored queue and decrements the assignee's stored
 * `activeTaskCount` the same way `completePersistedRoutedTask` always did,
 * and additionally records the completion event so
 * `panels/ResearchProgressPanel.tsx` can show real task-completion history
 * instead of nothing.
 *
 * A "Route tasks" form closes the "(d) a task-routing trigger UI to
 * actually populate a topic's queue" follow-up named under the "Research
 * Task Routing" bullet in TODO.md — entering a topic id and submitting
 * calls `routePersistedTopicTasks`, which routes that topic's coverage gaps
 * against the persisted contributor list and saves the resulting queue, the
 * same composition `state/trackedArguments.ts`/`panels/
 * TopicCoverageDashboardPanel.tsx` already track that topic's checklist
 * under.
 *
 * A "My tasks" filter closes the "(e) scoping the inbox to 'my tasks' once
 * contributor identity/auth exists" follow-up named under the same bullet.
 * This repo still has no auth/identity system, so — mirroring the "🔄
 * Strategy Sync Notes" assignee-notification slice's identical free-form-id
 * workaround — a contributor just types their own `contributorId` into a
 * field, and the panel scopes the rendered view to it via
 * `filterTaskInboxViewByContributor`.
 *
 * @module panels/TaskInboxPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import {
  buildTaskInboxView,
  filterTaskInboxViewByContributor,
  routePersistedTopicTasks,
  type TaskInboxTopic,
} from "../state/routedTaskQueues"
import { completeAndRecordResearchTask } from "../state/researchProgress"
import { listTrackedTopics } from "../state/trackedArguments"
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
  const [trackedTopics, setTrackedTopics] = useState<string[]>([])
  const [routeTopic, setRouteTopic] = useState("")
  const [routeError, setRouteError] = useState<string | null>(null)
  const [myContributorId, setMyContributorId] = useState("")

  useEffect(() => {
    setTopics(buildTaskInboxView())
    setTrackedTopics(listTrackedTopics())
  }, [])

  const handleComplete = (topicId: string, argBlock: string) => {
    completeAndRecordResearchTask(topicId, argBlock, new Date().toISOString())
    setTopics(buildTaskInboxView())
  }

  const handleRoute = (topicId: string) => {
    const trimmed = topicId.trim()
    if (!trimmed) {
      setRouteError("Enter a topic to route.")
      return
    }
    routePersistedTopicTasks(trimmed)
    setRouteError(null)
    setRouteTopic("")
    setTopics(buildTaskInboxView())
    setTrackedTopics(listTrackedTopics())
  }

  if (topics === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading task inbox…</div>
  }

  const routeForm = (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="task-inbox-route-topic">Route a topic's tasks</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="task-inbox-route-topic"
            value={routeTopic}
            onChange={(e) => setRouteTopic(e.target.value)}
            placeholder="Energy Policy"
            className="max-w-sm"
          />
          <Button onClick={() => handleRoute(routeTopic)}>Route tasks</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Routes that topic's under-covered arguments (from the Topic Coverage Dashboard checklist) to
          the least-loaded eligible contributor and adds them to the inbox below.
        </p>
      </div>
      {trackedTopics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {trackedTopics.map((existing) => (
            <Button key={existing} size="sm" variant="outline" onClick={() => handleRoute(existing)}>
              {existing}
            </Button>
          ))}
        </div>
      )}
      {routeError && <p className="text-sm text-destructive">{routeError}</p>}
    </div>
  )

  const myTasksFilter = (
    <div className="rounded-lg border border-border p-4 space-y-1.5">
      <Label htmlFor="task-inbox-my-id">My tasks</Label>
      <Input
        id="task-inbox-my-id"
        value={myContributorId}
        onChange={(e) => setMyContributorId(e.target.value)}
        placeholder="alice"
        className="max-w-sm"
      />
      <p className="text-xs text-muted-foreground">
        Enter your contributor id to scope the inbox below to just your own assignments. This repo
        has no auth/identity system, so this is a free-form filter, not a login.
      </p>
    </div>
  )

  if (topics.length === 0) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-foreground">Task Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Research tasks routed to contributors, grouped by topic. Mark a task complete once it's done.
          </p>
        </div>
        {routeForm}
        <div className="p-6 text-center text-sm text-muted-foreground">
          No research tasks routed yet. Route a topic above, or the inbox fills in once a topic's
          coverage gaps are routed to contributors some other way.
        </div>
      </div>
    )
  }

  const trimmedMyId = myContributorId.trim()
  const visibleTopics = trimmedMyId ? filterTaskInboxViewByContributor(topics, trimmedMyId) : topics

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Task Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Research tasks routed to contributors, grouped by topic. Mark a task complete once it's done.
        </p>
      </div>
      {routeForm}
      {myTasksFilter}
      {trimmedMyId && visibleTopics.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No tasks routed to "{trimmedMyId}" right now.
        </div>
      )}
      {visibleTopics.map((topic) => (
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
