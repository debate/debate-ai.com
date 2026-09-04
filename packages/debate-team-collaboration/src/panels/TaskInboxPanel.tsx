/**
 * @fileoverview Task Inbox panel — the UI follow-up named "(c) a
 * task-assignment/inbox UI" under the "Research Task Routing" bullet in
 * TODO.md.
 *
 * Reads every persisted routed task queue via `state/routedTaskQueues.ts`'s
 * `buildTaskInboxView` (itself a thin composition of `listRoutedTaskQueues`
 * against the persisted `contributorAvailability.ts` store for each
 * assignee's current skill level) and renders it grouped by topic: each
 * assignment can be marked done, which calls
 * `state/pendingTaskVerifications.ts`'s `markRoutedTaskAwaitingVerification`
 * — it removes the assignment from the stored queue and decrements the
 * assignee's stored `activeTaskCount` the same way `completePersistedRoutedTask`
 * always did, but doesn't credit it yet.
 *
 * A "Awaiting verification" section closes the "No reviewer/verification
 * step before a task is marked complete" Known gap recorded in
 * `docs/features/task-inbox.md`: a task marked done sits here until a
 * *different* contributor types their own id and verifies it, via
 * `state/researchProgress.ts`'s `verifyAndRecordResearchTask` (gated by
 * `lib/task-verification.ts`'s `assertVerifierAllowed` — the assignee
 * themself can't verify their own task). Only once verified does
 * `panels/ResearchProgressPanel.tsx` see the completion in its history.
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
 * A contributor types their own `contributorId` into a field, and the panel
 * scopes the rendered view to it via `filterTaskInboxViewByContributor`.
 *
 * A later slice wires that field to a real signed-in identity where one is
 * available: an optional `signedInContributorId` prop (built from
 * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`
 * against `apps/debate-ai.com`'s real better-auth session) seeds the
 * field's *initial* value only — a visitor who edits it keeps whatever they
 * typed, so this is a prefill, not a login.
 *
 * The same `signedInContributorId` also gates — not just prefills — each
 * pending verification's "Verifier id" field via `lib/session-identity.ts`'s
 * `deriveLockedVerifierId`: a signed-in visitor's verifier field is locked
 * to their own id (read-only), and verifying a task they completed
 * themself is disabled with an inline explanation instead of only failing
 * `assertVerifierAllowed` after the click. A signed-out visitor keeps the
 * original fully free-form field, unchanged.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isTaskInboxLiveUpdateStorageEvent`, so a topic routed, task marked done,
 * or task verified in another tab refreshes this panel's view without a
 * manual reload — closing the "Every other localStorage-backed panel in
 * this repo still has no cross-tab live-update mechanism" Known gap noted
 * in `shared-flow-sync.md`, for this panel.
 *
 * Every assignment and unassigned task also carries a "Reassign" control —
 * a free-form contributor-id field plus button — closing the "a
 * coach-facing override/reassign control" follow-up named under the
 * "Research Task Routing" bullet in TODO.md's Product Feature Ideas list.
 * It calls `state/routedTaskQueues.ts`'s `reassignPersistedRoutedTask`,
 * which moves the task to the typed contributor regardless of
 * `routeTasks`'s own skill/capacity rules — an intentional override, not
 * another routing pass.
 *
 * Every assignment also has a "Flag high priority"/"Unflag" toggle, closing
 * the "a task-priority indicator" follow-up named under the same bullet — a
 * flagged assignment carries a "High priority" badge and sorts ahead of its
 * topic-mates (`state/routedTaskQueues.ts`'s
 * `setPersistedRoutedTaskPriority`, backed by
 * `research-task-routing.ts`'s `setAssignmentPriority`/
 * `sortAssignmentsByPriority`), mirroring `PrepNotesPanel.tsx`'s identical
 * priority-flag control for Strategy Sync Notes. An unassigned task has no
 * flag control — there's no assignee yet to attach a priority to.
 *
 * @module panels/TaskInboxPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import { Button } from "debate-research-evidence/src/ui/primitives/button"
import { Input } from "debate-research-evidence/src/ui/primitives/input"
import { Label } from "debate-research-evidence/src/ui/primitives/label"
import {
  buildTaskInboxView,
  filterTaskInboxViewByContributor,
  reassignPersistedRoutedTask,
  routePersistedTopicTasks,
  setPersistedRoutedTaskPriority,
  type TaskInboxTopic,
} from "../state/routedTaskQueues"
import { verifyAndRecordResearchTask } from "../state/researchProgress"
import {
  listPendingTaskVerifications,
  markRoutedTaskAwaitingVerification,
  type PendingTaskVerification,
} from "../state/pendingTaskVerifications"
import { listTrackedTopics } from "debate-research-evidence/src/state/trackedArguments"
import { deriveLockedVerifierId, isOwnContributorRow } from "debate-research-evidence/src/lib/session-identity"
import { isTaskInboxLiveUpdateStorageEvent } from "debate-research-evidence/src/state/live-update"
import type { CoverageLevel } from "debate-research-evidence/src/lib/topic-coverage"

const LEVEL_VARIANT: Record<CoverageLevel, "default" | "secondary" | "outline"> = {
  missing: "default",
  thin: "secondary",
  covered: "outline",
}

export interface TaskInboxPanelProps {
  /**
   * A contributor id to prefill the "My tasks" field with, typically
   * derived from a real signed-in session via
   * `deriveContributorIdFromSessionIdentity`. Only seeds that field's
   * initial value — once a visitor edits it by hand, this prop is ignored
   * for the rest of the panel's life so it never overwrites what they typed.
   *
   * Every pending verification's "Verifier id" field is treated
   * differently: when set, that field is locked to this id (not just
   * prefilled) via `deriveLockedVerifierId`, and verifying a task assigned
   * to this same id is disabled outright. A signed-out visitor (this prop
   * unset) keeps the original fully free-form verifier field.
   */
  signedInContributorId?: string
}

/**
 * Renders the Task Inbox: every topic with a persisted routed task queue,
 * its assignments (contributor, task, required skill) with a "Mark
 * complete" action, and any tasks nobody was eligible/available for.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function TaskInboxPanel({ signedInContributorId }: TaskInboxPanelProps = {}) {
  const [topics, setTopics] = useState<TaskInboxTopic[] | null>(null)
  const [pending, setPending] = useState<PendingTaskVerification[]>([])
  const [trackedTopics, setTrackedTopics] = useState<string[]>([])
  const [routeTopic, setRouteTopic] = useState("")
  const [routeError, setRouteError] = useState<string | null>(null)
  const [myContributorId, setMyContributorId] = useState("")
  const [hasEditedMyId, setHasEditedMyId] = useState(false)
  const [verifierIds, setVerifierIds] = useState<Record<string, string>>({})
  const [verifyErrors, setVerifyErrors] = useState<Record<string, string>>({})
  const [reassignInputs, setReassignInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    setTopics(buildTaskInboxView())
    setPending(listPendingTaskVerifications())
    setTrackedTopics(listTrackedTopics())
  }, [])

  useEffect(() => {
    if (!hasEditedMyId && signedInContributorId) {
      setMyContributorId(signedInContributorId)
    }
  }, [signedInContributorId, hasEditedMyId])

  /**
   * Live-update the inbox when another browser tab routes a topic, marks a
   * task done, or verifies one. A `storage` event never fires in the tab
   * that made the write, only in other tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isTaskInboxLiveUpdateStorageEvent(event)) return
      setTopics(buildTaskInboxView())
      setPending(listPendingTaskVerifications())
      setTrackedTopics(listTrackedTopics())
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const pendingKey = (topicId: string, argBlock: string) => `${topicId}::${argBlock}`

  const handleMarkDone = (topicId: string, argBlock: string) => {
    markRoutedTaskAwaitingVerification(topicId, argBlock, new Date().toISOString())
    setTopics(buildTaskInboxView())
    setPending(listPendingTaskVerifications())
  }

  const handleVerify = (topicId: string, argBlock: string, verifierIdOverride?: string) => {
    const key = pendingKey(topicId, argBlock)
    const verifierId = (verifierIdOverride ?? verifierIds[key] ?? "").trim()
    try {
      verifyAndRecordResearchTask(topicId, argBlock, verifierId, new Date().toISOString())
      setPending(listPendingTaskVerifications())
      setVerifierIds((prev) => ({ ...prev, [key]: "" }))
      setVerifyErrors((prev) => ({ ...prev, [key]: "" }))
    } catch (error) {
      setVerifyErrors((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Could not verify this task.",
      }))
    }
  }

  const handleTogglePriority = (topicId: string, argBlock: string, currentPriority?: "normal" | "high") => {
    setPersistedRoutedTaskPriority(topicId, argBlock, currentPriority === "high" ? "normal" : "high")
    setTopics(buildTaskInboxView())
  }

  const handleReassign = (topicId: string, argBlock: string) => {
    const key = pendingKey(topicId, argBlock)
    const newContributorId = (reassignInputs[key] ?? "").trim()
    if (!newContributorId) return
    reassignPersistedRoutedTask(topicId, argBlock, newContributorId)
    setReassignInputs((prev) => ({ ...prev, [key]: "" }))
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
        onChange={(e) => {
          setHasEditedMyId(true)
          setMyContributorId(e.target.value)
        }}
        placeholder="alice"
        className="max-w-sm"
      />
      <p className="text-xs text-muted-foreground">
        {signedInContributorId
          ? "Prefilled from your signed-in account — edit it if your tasks were routed under a different contributor id."
          : "Enter your contributor id to scope the inbox below to just your own assignments. This is a free-form filter, not a login."}
      </p>
    </div>
  )

  if (topics.length === 0) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-foreground">Task Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Research tasks routed to contributors, grouped by topic. Mark a task done once it's finished,
            then a different contributor verifies it before it counts as complete.
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
      {pending.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Awaiting verification</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            A task marked done doesn't count as complete until a different contributor verifies it.
          </p>
          <div className="space-y-2">
            {pending.map((record) => {
              const key = pendingKey(record.topicId, record.assignment.task.argBlock)
              const isSelfAssignment = isOwnContributorRow(
                record.assignment.contributorId,
                signedInContributorId,
              )
              const lockedVerifierId = deriveLockedVerifierId(
                record.assignment.contributorId,
                signedInContributorId,
              )
              const verifierValue = lockedVerifierId || (verifierIds[key] ?? "")
              return (
                <div
                  key={key}
                  className="flex flex-col gap-2 rounded-md border border-dashed border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{record.assignment.task.argBlock}</span>
                    <span className="text-muted-foreground">({record.topicId}) — done by</span>
                    <span className="font-medium text-foreground">{record.assignment.contributorId}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={verifierValue}
                      onChange={(e) => setVerifierIds((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Verifier id"
                      className="h-8 max-w-[10rem]"
                      disabled={!!lockedVerifierId || isSelfAssignment}
                      readOnly={!!lockedVerifierId}
                    />
                    <Button
                      size="sm"
                      disabled={isSelfAssignment}
                      onClick={() =>
                        handleVerify(record.topicId, record.assignment.task.argBlock, lockedVerifierId || undefined)
                      }
                    >
                      Verify
                    </Button>
                  </div>
                  {isSelfAssignment && (
                    <p className="w-full text-xs text-muted-foreground">
                      You completed this task — a different contributor must verify it.
                    </p>
                  )}
                  {!isSelfAssignment && lockedVerifierId && (
                    <p className="w-full text-xs text-muted-foreground">
                      Verifying as your signed-in id.
                    </p>
                  )}
                  {verifyErrors[key] && (
                    <p className="w-full text-xs text-destructive">{verifyErrors[key]}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {visibleTopics.map((topic) => (
        <div key={topic.topicId} className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{topic.topicId}</h2>
          {topic.assignments.length === 0 && topic.unassignedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks routed for this topic.</p>
          ) : (
            <div className="space-y-2">
              {topic.assignments.map((assignment) => {
                const key = pendingKey(topic.topicId, assignment.task.argBlock)
                return (
                  <div
                    key={assignment.task.argBlock}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">{assignment.task.argBlock}</span>
                      <Badge variant={LEVEL_VARIANT[assignment.task.level]}>{assignment.task.level}</Badge>
                      {assignment.priority === "high" && <Badge variant="destructive">High priority</Badge>}
                      <span className="text-muted-foreground">assigned to</span>
                      <span className="font-medium text-foreground">{assignment.contributorId}</span>
                      {assignment.contributorSkillLevel && (
                        <Badge variant="outline" className="capitalize">
                          {assignment.contributorSkillLevel}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={reassignInputs[key] ?? ""}
                        onChange={(e) => setReassignInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Reassign to…"
                        className="h-8 max-w-[10rem]"
                        aria-label={`Reassign ${assignment.task.argBlock} to`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!(reassignInputs[key] ?? "").trim()}
                        onClick={() => handleReassign(topic.topicId, assignment.task.argBlock)}
                      >
                        Reassign
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleTogglePriority(topic.topicId, assignment.task.argBlock, assignment.priority)
                        }
                      >
                        {assignment.priority === "high" ? "Unflag" : "Flag high priority"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkDone(topic.topicId, assignment.task.argBlock)}
                      >
                        Mark done
                      </Button>
                    </div>
                  </div>
                )
              })}
              {topic.unassignedTasks.map((task) => {
                const key = pendingKey(topic.topicId, task.argBlock)
                return (
                  <div
                    key={task.argBlock}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">{task.argBlock}</span>
                    <Badge variant={LEVEL_VARIANT[task.level]}>{task.level}</Badge>
                    <span className="text-muted-foreground">
                      unassigned — no eligible contributor available
                    </span>
                    <Input
                      value={reassignInputs[key] ?? ""}
                      onChange={(e) => setReassignInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Assign to…"
                      className="h-8 max-w-[10rem]"
                      aria-label={`Assign ${task.argBlock} to`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!(reassignInputs[key] ?? "").trim()}
                      onClick={() => handleReassign(topic.topicId, task.argBlock)}
                    >
                      Assign
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
