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
 * @module state/routedTaskQueues
 */

import { buildRoutingResult, type RoutedAssignment, type ResearchTask, type RoutingResult, type SkillLevel } from "../lib/research-task-routing";
import type { TopicCoverageReport } from "../lib/topic-coverage";
import { listContributorAvailability, recordPersistedTaskAssigned, recordPersistedTaskCompleted } from "./contributorAvailability";

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
 */
export function buildTaskInboxView(): TaskInboxTopic[] {
  const skillByContributor = new Map(
    listContributorAvailability().map((profile) => [profile.contributorId, profile.skillLevel]),
  );

  return listRoutedTaskQueues().map(({ topicId, result }) => ({
    topicId,
    assignments: result.assignments.map((assignment) => ({
      ...assignment,
      topicId,
      contributorSkillLevel: skillByContributor.get(assignment.contributorId),
    })),
    unassignedTasks: result.unassignedTasks,
  }));
}
