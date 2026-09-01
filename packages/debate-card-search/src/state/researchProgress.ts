/**
 * @fileoverview Persistent completed-task history plus a live progress board
 * for the "Research Progress Tracking" idea under Research Crowdsourcing
 * Organizer Features in TODO.md ("Show each debater's progress across
 * topics, task completion, and contribution history"). `lib/research-progress.ts`
 * already builds a `ContributorProgress` board from a caller-supplied
 * contribution list and a caller-supplied, topic-tagged, completion-stamped
 * assignment list — this module supplies both from real, persisted state
 * instead.
 *
 * `completeAndRecordResearchTask` closes the "(a) wiring real
 * task-completion events into a persisted assignment/completion history"
 * follow-up: it wraps the existing `routedTaskQueues.ts`'s
 * `completePersistedRoutedTask` (which only removes a finished assignment
 * from its topic's active queue) and additionally appends a
 * `CompletedTaskRecord` here, so a completed task is remembered instead of
 * just disappearing. `panels/TaskInboxPanel.tsx`'s "Mark complete" action
 * now calls this instead of `completePersistedRoutedTask` directly.
 *
 * `buildPersistedResearchProgressBoard` closes the "(b) a progress
 * dashboard/roster UI" follow-up's data half: it composes the persisted
 * `state/contributions.ts` contribution list with every persisted completed
 * task here plus every still-active assignment in
 * `state/routedTaskQueues.ts`, then hands the combined lists to
 * `lib/research-progress.ts`'s pure `buildResearchProgressBoard` — mirroring
 * `dailyMissionResults.ts`'s "compose the pure function directly against the
 * persisted store" convention. `panels/ResearchProgressPanel.tsx` renders it.
 *
 * Follow-up (c), feeding a contributor's topic-progress history back into
 * `progress-unlocks.ts`'s tier computation, remains open — not started.
 *
 * `verifyAndRecordResearchTask` closes the "No reviewer/verification step
 * before a task is marked complete" Known gap recorded in
 * `docs/features/task-inbox.md`: it credits a task marked done through
 * `state/pendingTaskVerifications.ts`'s `markRoutedTaskAwaitingVerification`
 * only once a *different* contributor confirms it, gated by
 * `lib/task-verification.ts`'s `assertVerifierAllowed`. This is additive —
 * `completeAndRecordResearchTask` is unchanged and still credits a
 * completion immediately, with no verification required.
 *
 * @module state/researchProgress
 */

import {
  buildResearchProgressBoard,
  type ContributorProgress,
  type TrackedTopicAssignment,
} from "../lib/research-progress";
import {
  buildLeaderboard,
  filterContributionsByRange,
  isWithinLeaderboardRange,
  type ContributorStats,
  type LeaderboardRange,
} from "../lib/contribution-leaderboard";
import { DEFAULT_HELPFULNESS_WEIGHTS, type HelpfulnessWeights } from "../lib/community-rating";
import type { RoutedAssignment } from "../lib/research-task-routing";
import { assertVerifierAllowed } from "../lib/task-verification";
import { listContributions } from "./contributions";
import { completePersistedRoutedTask, getRoutedTaskQueue, listRoutedTaskQueues } from "./routedTaskQueues";
import { getPendingTaskVerification, removePendingTaskVerification } from "./pendingTaskVerifications";

/** One completed research task, remembered after `completePersistedRoutedTask` removes it from its active queue. */
export interface CompletedTaskRecord {
  topic: string;
  assignment: RoutedAssignment;
  completedAt: string;
  /** When this task was marked done, before verification. Only set for a task completed through `verifyAndRecordResearchTask` — a direct `completeAndRecordResearchTask` call has no separate "marked done" moment. */
  markedDoneAt?: string;
  /** Free-text id of whoever verified this completion. Only set for a task completed through `verifyAndRecordResearchTask`. */
  verifiedBy?: string;
}

const STORAGE_KEY = "completedResearchTasks";

function readAll(): CompletedTaskRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CompletedTaskRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: CompletedTaskRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted completed-task record, across all topics and contributors. */
export function listCompletedTaskHistory(): CompletedTaskRecord[] {
  return readAll();
}

/**
 * Deletes every persisted completed-task record for one topic, leaving every
 * other topic's history (and the active-queue store) untouched; a no-op if
 * the topic has no completed-task history. Mirrors `routedTaskQueues.ts`'s
 * `deleteRoutedTaskQueue(topicId)` — closes the "a completed task's history
 * record is never deleted" Known gap in `docs/features/research-progress-tracking.md`.
 */
export function deleteCompletedTaskHistoryForTopic(topic: string): void {
  writeAll(readAll().filter((record) => record.topic !== topic));
}

/**
 * Completes a routed task the same way `completePersistedRoutedTask` does
 * (removes it from its topic's stored active queue, decrements the
 * assignee's stored `activeTaskCount`) and, on success, additionally
 * appends a `CompletedTaskRecord` stamped with `completedAt` here. Returns
 * the completed assignment, or `undefined` — leaving both stores untouched
 * — if the topic has no persisted queue or no assignment for that
 * `argBlock`.
 */
export function completeAndRecordResearchTask(
  topicId: string,
  argBlock: string,
  completedAt: string,
): RoutedAssignment | undefined {
  const assignment = completePersistedRoutedTask(topicId, argBlock);
  if (!assignment) return undefined;

  const records = readAll();
  records.push({ topic: topicId, assignment, completedAt });
  writeAll(records);
  return assignment;
}

/**
 * Verifies a task previously marked done via
 * `state/pendingTaskVerifications.ts`'s `markRoutedTaskAwaitingVerification`,
 * crediting it only once — closing the "No reviewer/verification step
 * before a task is marked complete" Known gap recorded in
 * `docs/features/task-inbox.md`. Requires a `verifierId` different from the
 * assignment's own `contributorId` (via `assertVerifierAllowed`); throws
 * `VerifierIdRequiredError`/`SelfVerificationNotAllowedError` and leaves both
 * the pending and completed stores untouched if the guard fails. Returns
 * `undefined` — recording nothing — if no task is pending verification for
 * that `topicId`/`argBlock`.
 */
export function verifyAndRecordResearchTask(
  topicId: string,
  argBlock: string,
  verifierId: string,
  verifiedAt: string,
): CompletedTaskRecord | undefined {
  const pending = getPendingTaskVerification(topicId, argBlock);
  if (!pending) return undefined;

  const trimmedVerifierId = assertVerifierAllowed(pending.assignment, verifierId);

  const record: CompletedTaskRecord = {
    topic: topicId,
    assignment: pending.assignment,
    completedAt: verifiedAt,
    markedDoneAt: pending.markedDoneAt,
    verifiedBy: trimmedVerifierId,
  };

  const records = readAll();
  records.push(record);
  writeAll(records);
  removePendingTaskVerification(topicId, argBlock);
  return record;
}

/**
 * Builds the full research-progress board directly from real, persisted
 * state — every completed task recorded here (each carrying its
 * `completedAt` stamp), every assignment still active in any persisted
 * `routedTaskQueues.ts` queue (not yet completed, so no `completedAt`), and
 * every persisted contribution in `state/contributions.ts` — composing
 * `lib/research-progress.ts`'s pure `buildResearchProgressBoard` rather than
 * requiring a caller to assemble these lists themselves. An empty store
 * returns an empty board rather than throwing.
 */
export function buildPersistedResearchProgressBoard(
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): ContributorProgress[] {
  const completed: TrackedTopicAssignment[] = readAll().map((record) => ({
    topic: record.topic,
    assignment: record.assignment,
    completedAt: record.completedAt,
  }));

  const active: TrackedTopicAssignment[] = listRoutedTaskQueues().flatMap(({ topicId, result }) =>
    result.assignments.map((assignment) => ({ topic: topicId, assignment })),
  );

  return buildResearchProgressBoard(listContributions(), [...completed, ...active], weights);
}

/**
 * The same completed-plus-active composition `buildPersistedResearchProgressBoard`
 * builds across every topic, scoped down to one topic — the assignment
 * source `state/topicSprints.ts`'s `buildPersistedTopicSprint` needs for a
 * single topic sprint's progress board, without pulling in every other
 * topic's assignments.
 */
export function listTrackedAssignmentsForTopic(topic: string): TrackedTopicAssignment[] {
  const completed: TrackedTopicAssignment[] = readAll()
    .filter((record) => record.topic === topic)
    .map((record) => ({ topic: record.topic, assignment: record.assignment, completedAt: record.completedAt }));

  const active: TrackedTopicAssignment[] = (getRoutedTaskQueue(topic)?.result.assignments ?? []).map(
    (assignment) => ({ topic, assignment }),
  );

  return [...completed, ...active];
}

/**
 * Builds the Contribution Leaderboard with each contributor's completed
 * research-task count folded in — closes the "(b) a 'completed tasks'
 * signal once a research-task system exists" follow-up named under the
 * "Contribution Leaderboard" bullet in TODO.md. Composes
 * `state/contributions.ts`'s persisted contribution list with this store's
 * own persisted completed-task history (grouped by `contributorId`) through
 * `contribution-leaderboard.ts`'s pure `buildLeaderboard`. Lives here,
 * rather than alongside `buildPersistedLeaderboard` in
 * `state/contributions.ts`, because this store is the one that already
 * reads the completed-task history — `state/contributions.ts` doesn't
 * depend on it, and importing it there would create a circular import
 * between the two state modules (this module already imports
 * `listContributions`).
 *
 * `range` closes the "weekly/monthly/all-time range filters" follow-up named
 * under the "Contribution Leaderboard" bullet in TODO.md: both the
 * contribution list (via `contribution-leaderboard.ts`'s
 * `filterContributionsByRange`, keyed off each contribution's `submittedAt`)
 * and this store's own completed-task counts (keyed off each record's
 * `completedAt`) are narrowed to the same trailing window before scoring, so
 * switching range changes every column consistently. Defaults to
 * `"all-time"`, matching the leaderboard's original unscoped behavior.
 */
export function buildPersistedLeaderboardWithCompletedTasks(
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
  range: LeaderboardRange = "all-time",
  now: number = Date.now(),
): ContributorStats[] {
  const completedTaskCounts = new Map<string, number>();
  for (const record of readAll()) {
    if (!isWithinLeaderboardRange(new Date(record.completedAt).getTime(), range, now)) continue;
    const contributorId = record.assignment.contributorId;
    completedTaskCounts.set(contributorId, (completedTaskCounts.get(contributorId) ?? 0) + 1);
  }
  return buildLeaderboard(filterContributionsByRange(listContributions(), range, now), weights, completedTaskCounts);
}
