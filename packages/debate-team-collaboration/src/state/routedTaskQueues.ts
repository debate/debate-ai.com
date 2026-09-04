/**
 * @fileoverview Persistent storage for `research-task-routing.ts`'s
 * `RoutingResult`, keyed by a caller-supplied `topicId` — the other half of
 * the "(a) persisted contributor profiles (active task count — skill level
 * is now derived) and a persisted task queue" follow-up named in the
 * "Research Task Routing" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features list (the contributor-profile half is already covered
 * by `contributorAvailability.ts`). Stores a topic's most recently routed
 * task queue in localStorage, mirroring the existing `drillSets.ts`/
 * `flowSummaries.ts` persistence convention (SSR/no-storage-safe, corrupt or
 * missing JSON degrades to an empty list rather than throwing). This is a
 * persistence slice only — it stores whatever `RoutingResult` a caller
 * passes in verbatim (`buildRoutingResult`/`routeTasks` themselves are
 * unchanged).
 *
 * `buildAndPersistRoutingResult`/`completePersistedRoutedTask` close the "(a)
 * wiring real task-assignment/completion events to keep a persisted
 * profile's `activeTaskCount` accurate" follow-up named under the "Research
 * Task Routing" bullet in TODO.md — they route (or complete) tasks directly
 * against the persisted `contributorAvailability.ts` and `routedTaskQueues.ts`
 * stores, applying `contributorAvailability.ts`'s `recordPersistedTaskAssigned`/
 * `recordPersistedTaskCompleted` on every real assignment/completion instead
 * of leaving a stored profile's `activeTaskCount` to drift out of sync with
 * what was actually routed, mirroring `dailyMissionResults.ts`'s
 * `computeAndSavePersistedDailyMissionResult` "compose the pure function
 * directly against the persisted store" convention on the write side.
 *
 * `buildTaskInboxView` closes the "(c) a task-assignment/inbox UI" follow-up
 * named under the same bullet — it flattens every persisted routed queue
 * into a panel-ready view, tagging each assignment with its topic and the
 * assignee's current skill level. `panels/TaskInboxPanel.tsx` renders it and
 * calls `completePersistedRoutedTask` when a user marks an assignment done.
 *
 * `routePersistedTopicTasks` closes the "(d) a task-routing trigger UI to
 * actually populate a topic's queue" follow-up named under the same bullet
 * (also tracked as `docs/features/task-inbox.md`'s "No task-routing trigger
 * UI yet" known gap) — it composes `trackedArguments.ts`'s
 * `buildPersistedTopicCoverageReport` (a topic's checklist against the
 * shared evidence library) directly with `buildAndPersistRoutingResult`, so
 * a caller (the Task Inbox panel) can route a topic's queue from nothing but
 * a `topicId`, instead of needing to separately build a coverage report
 * first.
 *
 * `reassignPersistedRoutedTask` closes the "a coach-facing override/
 * reassign control" follow-up named under the same bullet in TODO.md's
 * Product Feature Ideas list — a coach can move an already-routed (or
 * still-unassigned) task to a different contributor by id, bypassing
 * `routeTasks`'s own skill/capacity-based pick, with each affected
 * contributor's persisted `activeTaskCount` kept in sync the same way a
 * normal assignment/completion is.
 *
 * `setPersistedRoutedTaskPriority` closes the "a task-priority indicator"
 * follow-up named under the same bullet in TODO.md's Product Feature Ideas
 * list — an already-routed assignment can be flagged high priority
 * (`lib/research-task-routing.ts`'s `setAssignmentPriority`), and
 * `buildTaskInboxView` now sorts each topic's assignments high-priority
 * first (`sortAssignmentsByPriority`) so a flagged task surfaces above its
 * topic-mates, mirroring `strategy-sync-notes.ts`'s `setNotePriority`/
 * `sortNotesByPriorityThenCreatedAt` convention for Strategy Sync Notes.
 *
 * `buildTeamCapacityView` closes the "a capacity-aware view of routing load
 * across the team" follow-up named under the "Research Task Routing" bullet
 * in TODO.md's Research Crowdsourcing Organizer Features list. This repo
 * still has no UI to create/manage a `ContributorAvailability` profile, so
 * rather than depending on one existing for every contributor, load is
 * tallied straight from the actually-persisted routed queues — the same
 * "work off arbitrary typed ids" convention `reassignPersistedRoutedTask`
 * already established — and enriched with `skillLevel`/`maxConcurrentTasks`
 * only for whichever contributors happen to have a persisted availability
 * profile.
 *
 * @module state/routedTaskQueues
 */

import {
  buildRoutingResult,
  setAssignmentPriority,
  sortAssignmentsByPriority,
  type RoutedAssignment,
  type ResearchTask,
  type RoutingResult,
  type SkillLevel,
  type TaskPriority,
} from "debate-research-evidence/src/lib/research-task-routing";
import type { CoverageThresholds, TopicCoverageReport } from "debate-research-evidence/src/lib/topic-coverage";
import { listContributorAvailability, recordPersistedTaskAssigned, recordPersistedTaskCompleted } from "./contributorAvailability";
import { buildPersistedTopicCoverageReport } from "debate-research-evidence/src/state/trackedArguments";

export type RoutedTaskQueueRecord = {
  topicId: string;
  result: RoutingResult;
};

const STORAGE_KEY = "routedTaskQueues";

function readAll(): RoutedTaskQueueRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoutedTaskQueueRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: RoutedTaskQueueRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted routed task queue, across all topics. */
export function listRoutedTaskQueues(): RoutedTaskQueueRecord[] {
  return readAll();
}

/** Looks up the persisted routed task queue for a topic, if any. */
export function getRoutedTaskQueue(topicId: string): RoutedTaskQueueRecord | undefined {
  return readAll().find((record) => record.topicId === topicId);
}

/** Saves a topic's routed task queue, overwriting any existing record for that `topicId`. */
export function saveRoutedTaskQueue(record: RoutedTaskQueueRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.topicId === record.topicId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a topic's persisted routed task queue; a no-op if it isn't stored. */
export function deleteRoutedTaskQueue(topicId: string): void {
  writeAll(readAll().filter((record) => record.topicId !== topicId));
}

/**
 * Routes a topic's coverage-gap tasks against the currently persisted
 * `ContributorAvailability` profiles (`contributorAvailability.ts`), records
 * every resulting assignment against its contributor's stored
 * `activeTaskCount` via `recordPersistedTaskAssigned`, and saves the routed
 * queue here under `topicId` — composing `buildRoutingResult` directly
 * against both persisted stores instead of requiring the caller to read the
 * contributor list, route, update each contributor's count, and save the
 * queue themselves. Returns the routing result.
 */
export function buildAndPersistRoutingResult(report: TopicCoverageReport, topicId: string): RoutingResult {
  const contributors = listContributorAvailability();
  const result = buildRoutingResult(report, contributors);

  for (const assignment of result.assignments) {
    recordPersistedTaskAssigned(assignment.contributorId);
  }

  saveRoutedTaskQueue({ topicId, result });
  return result;
}

/**
 * Routes a topic's coverage gaps entirely from persisted stores: builds the
 * topic's live coverage report from its tracked-argument checklist and the
 * shared evidence library (`trackedArguments.ts`'s
 * `buildPersistedTopicCoverageReport`), then routes and persists it the same
 * way `buildAndPersistRoutingResult` always has. This is the composition a
 * "route this topic's tasks" trigger UI needs — a topic id in, a saved,
 * panel-ready `RoutingResult` out.
 */
export function routePersistedTopicTasks(topicId: string, thresholds?: CoverageThresholds): RoutingResult {
  const report = buildPersistedTopicCoverageReport(topicId, thresholds);
  return buildAndPersistRoutingResult(report, topicId);
}

/**
 * Marks one task in a topic's persisted routed queue as complete: removes
 * the matching assignment (by `argBlock`) from the stored queue, decrements
 * its contributor's stored `activeTaskCount` via `recordPersistedTaskCompleted`,
 * and saves the updated queue. Returns the completed assignment, or
 * `undefined` — leaving both stores untouched — if the topic has no
 * persisted queue or no assignment for that `argBlock`.
 */
export function completePersistedRoutedTask(topicId: string, argBlock: string): RoutedAssignment | undefined {
  const queue = getRoutedTaskQueue(topicId);
  if (!queue) return undefined;

  const index = queue.result.assignments.findIndex((a) => a.task.argBlock === argBlock);
  if (index === -1) return undefined;

  const assignment = queue.result.assignments[index];
  const updatedResult: RoutingResult = {
    ...queue.result,
    assignments: queue.result.assignments.filter((_, i) => i !== index),
  };

  recordPersistedTaskCompleted(assignment.contributorId);
  saveRoutedTaskQueue({ topicId, result: updatedResult });
  return assignment;
}

/**
 * Reassigns one already-routed task to a different contributor — a coach
 * override for `routeTasks`'s own least-loaded-eligible-contributor pick,
 * closing the "a coach-facing override/reassign control" follow-up named
 * under the "Research Task Routing" bullet in TODO.md. Works on a task
 * whether it's currently assigned (moves it from its current assignee to
 * `newContributorId`) or sitting in `unassignedTasks` (assigns it for the
 * first time), matched by `argBlock` either way. Updates each affected
 * contributor's persisted `activeTaskCount` the same way a normal
 * assignment/completion would
 * (`recordPersistedTaskAssigned`/`recordPersistedTaskCompleted`) — a no-op
 * on a profile that isn't persisted, matching every other free-form
 * contributor-id action in this repo (`myContributorId`, "Verifier id"):
 * there's no roster/login requirement to type an id here. No skill or
 * capacity check is applied — an explicit coach override intentionally
 * bypasses `routeTasks`'s own eligibility rules.
 *
 * Returns the reassigned `RoutedAssignment`, or `undefined` — leaving both
 * stores untouched — when `newContributorId` is blank, the topic has no
 * persisted queue, or no assigned or unassigned task matches `argBlock`.
 * Reassigning to the task's current assignee is a no-op that returns the
 * existing assignment unchanged, rather than decrementing and
 * re-incrementing the same contributor's `activeTaskCount`.
 */
export function reassignPersistedRoutedTask(
  topicId: string,
  argBlock: string,
  newContributorId: string,
): RoutedAssignment | undefined {
  const trimmedContributorId = newContributorId.trim();
  if (!trimmedContributorId) return undefined;

  const queue = getRoutedTaskQueue(topicId);
  if (!queue) return undefined;

  const assignedIndex = queue.result.assignments.findIndex((a) => a.task.argBlock === argBlock);
  const unassignedIndex =
    assignedIndex === -1 ? queue.result.unassignedTasks.findIndex((t) => t.argBlock === argBlock) : -1;
  if (assignedIndex === -1 && unassignedIndex === -1) return undefined;

  const previousAssignment = assignedIndex !== -1 ? queue.result.assignments[assignedIndex] : undefined;
  if (previousAssignment?.contributorId === trimmedContributorId) return previousAssignment;

  const task = previousAssignment ? previousAssignment.task : queue.result.unassignedTasks[unassignedIndex];
  const reassignment: RoutedAssignment = { task, contributorId: trimmedContributorId };
  const updatedResult: RoutingResult = {
    assignments: previousAssignment
      ? queue.result.assignments.map((a, i) => (i === assignedIndex ? reassignment : a))
      : [...queue.result.assignments, reassignment],
    unassignedTasks:
      unassignedIndex !== -1
        ? queue.result.unassignedTasks.filter((_, i) => i !== unassignedIndex)
        : queue.result.unassignedTasks,
  };

  if (previousAssignment) recordPersistedTaskCompleted(previousAssignment.contributorId);
  recordPersistedTaskAssigned(trimmedContributorId);

  saveRoutedTaskQueue({ topicId, result: updatedResult });
  return reassignment;
}

/**
 * Flags (or unflags) one already-routed assignment as high priority,
 * closing the "a task-priority indicator" follow-up named under the
 * "Research Task Routing" bullet in TODO.md's Product Feature Ideas list —
 * mirroring `state/prepNotes.ts`'s `updatePersistedPrepNotePriority`. Only
 * applies to an assignment that's actually routed to someone; an
 * `unassignedTasks` entry has no assignment to flag (there's no `contributorId`
 * to attach the flag to yet — assign or reassign it first).
 *
 * Returns the updated `RoutedAssignment`, or `undefined` — leaving storage
 * untouched — when the topic has no persisted queue or no assignment
 * matches that `argBlock`.
 */
export function setPersistedRoutedTaskPriority(
  topicId: string,
  argBlock: string,
  priority: TaskPriority,
): RoutedAssignment | undefined {
  const queue = getRoutedTaskQueue(topicId);
  if (!queue) return undefined;

  const index = queue.result.assignments.findIndex((a) => a.task.argBlock === argBlock);
  if (index === -1) return undefined;

  const updated = setAssignmentPriority(queue.result.assignments[index], priority);
  const updatedResult: RoutingResult = {
    ...queue.result,
    assignments: queue.result.assignments.map((a, i) => (i === index ? updated : a)),
  };

  saveRoutedTaskQueue({ topicId, result: updatedResult });
  return updated;
}

/** One assignment in the task-inbox view, tagged with the topic it was routed under and the assignee's current skill level (if their profile is still persisted). */
export interface TaskInboxAssignment extends RoutedAssignment {
  topicId: string;
  contributorSkillLevel?: SkillLevel;
}

/** One topic's section of the task-inbox view: its routed assignments and any tasks nobody was eligible/available for. */
export interface TaskInboxTopic {
  topicId: string;
  assignments: TaskInboxAssignment[];
  unassignedTasks: ResearchTask[];
}

/**
 * Composes every persisted routed task queue into a flat, panel-ready
 * inbox view, closing the "(c) a task-assignment/inbox UI" follow-up named
 * under the "Research Task Routing" bullet in TODO.md. Each assignment is
 * tagged with its `topicId` (queues are stored per-topic) and the
 * assignee's current persisted `skillLevel`, looked up from
 * `contributorAvailability.ts` — mirroring `contributions.ts`'s
 * `buildPersistedLeaderboard` "compose the pure function directly against
 * the persisted store" convention. Topics are returned in the same order
 * `listRoutedTaskQueues` stores them; a contributor whose profile was since
 * deleted is still listed, just without a `contributorSkillLevel`.
 *
 * Each topic's assignments are ordered high-priority first via
 * `sortAssignmentsByPriority` (stable, so the underlying most-urgent-first
 * routing order survives within a priority tier) — closing the "a
 * task-priority indicator" follow-up named under the same bullet.
 */
export function buildTaskInboxView(): TaskInboxTopic[] {
  const skillByContributor = new Map(
    listContributorAvailability().map((profile) => [profile.contributorId, profile.skillLevel]),
  );

  return listRoutedTaskQueues().map(({ topicId, result }) => ({
    topicId,
    assignments: sortAssignmentsByPriority(result.assignments).map((assignment) => ({
      ...assignment,
      topicId,
      contributorSkillLevel: skillByContributor.get(assignment.contributorId),
    })),
    unassignedTasks: result.unassignedTasks,
  }));
}

/**
 * Scopes a task-inbox view down to one contributor's own assignments,
 * closing the "(e) scoping the inbox to 'my tasks' once contributor
 * identity/auth exists" follow-up named under the "Research Task Routing"
 * bullet in TODO.md. This repo still has no auth/identity system, so — the
 * same free-form-id workaround `flow/prep-note-notifications.ts`'s
 * `getNotificationsForRecipient` already established for "🔄 Strategy Sync
 * Notes" — a contributor is just whoever types their own `contributorId`
 * into the filter.
 *
 * A topic with no assignments for that contributor is dropped entirely
 * (there's nothing "mine" to show for it), and every topic's
 * `unassignedTasks` is cleared, since an unassigned task isn't anyone's yet.
 * `buildTaskInboxView`'s own topic/assignment ordering is otherwise
 * preserved.
 */
export function filterTaskInboxViewByContributor(
  topics: TaskInboxTopic[],
  contributorId: string,
): TaskInboxTopic[] {
  return topics
    .map((topic) => ({
      ...topic,
      assignments: topic.assignments.filter((assignment) => assignment.contributorId === contributorId),
      unassignedTasks: [],
    }))
    .filter((topic) => topic.assignments.length > 0);
}

/** How many of a contributor's currently-routed tasks fall under one topic. */
export interface TeamCapacityTopicLoad {
  topicId: string;
  count: number;
}

/**
 * One row of the team capacity view: a contributor who currently has at
 * least one routed task, their total load across every topic, and a
 * per-topic breakdown of where that load comes from.
 */
export interface TeamCapacityRow {
  contributorId: string;
  /** Total routed tasks currently assigned to this contributor, across every topic. */
  activeTaskCount: number;
  /** Per-topic breakdown, busiest topic first (tie-broken by topicId). */
  topicCounts: TeamCapacityTopicLoad[];
  /** This contributor's persisted skill level, if their availability profile still exists. */
  skillLevel?: SkillLevel;
  /** This contributor's persisted concurrency limit, if their availability profile still exists. */
  maxConcurrentTasks?: number;
  /**
   * `true` when a persisted profile exists and `activeTaskCount` has met or
   * exceeded its `maxConcurrentTasks` — `false` (not "unknown") for a
   * contributor with no persisted profile, since there's no limit to
   * compare against.
   */
  isOverloaded: boolean;
}

/**
 * Builds a capacity-aware view of routing load across the whole team,
 * closing the "a capacity-aware view of routing load across the team"
 * follow-up named under the "Research Task Routing" bullet in TODO.md.
 * Tallies every persisted routed queue's assignments by contributor
 * (regardless of whether that contributor has a persisted
 * `ContributorAvailability` profile — see the module docstring), then
 * enriches each row with `skillLevel`/`maxConcurrentTasks`/`isOverloaded`
 * for whichever contributors do have one. A contributor with zero currently
 * routed tasks (including one with a persisted profile but nothing
 * assigned) is omitted — there's no load to show. Rows are sorted
 * busiest-first, tie-broken by `contributorId`.
 */
export function buildTeamCapacityView(): TeamCapacityRow[] {
  const profileByContributor = new Map(
    listContributorAvailability().map((profile) => [profile.contributorId, profile]),
  );

  const topicCountsByContributor = new Map<string, Map<string, number>>();
  for (const { topicId, result } of listRoutedTaskQueues()) {
    for (const assignment of result.assignments) {
      const byTopic = topicCountsByContributor.get(assignment.contributorId) ?? new Map<string, number>();
      byTopic.set(topicId, (byTopic.get(topicId) ?? 0) + 1);
      topicCountsByContributor.set(assignment.contributorId, byTopic);
    }
  }

  const rows: TeamCapacityRow[] = Array.from(topicCountsByContributor.entries()).map(([contributorId, byTopic]) => {
    const topicCounts = Array.from(byTopic.entries())
      .map(([topicId, count]) => ({ topicId, count }))
      .sort((a, b) => b.count - a.count || a.topicId.localeCompare(b.topicId));
    const activeTaskCount = topicCounts.reduce((sum, topic) => sum + topic.count, 0);
    const profile = profileByContributor.get(contributorId);

    return {
      contributorId,
      activeTaskCount,
      topicCounts,
      skillLevel: profile?.skillLevel,
      maxConcurrentTasks: profile?.maxConcurrentTasks,
      isOverloaded: profile ? activeTaskCount >= profile.maxConcurrentTasks : false,
    };
  });

  return rows.sort((a, b) => b.activeTaskCount - a.activeTaskCount || a.contributorId.localeCompare(b.contributorId));
}
