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
 * `getPersistedContributorProgress` closes follow-up (c), "feeding a
 * contributor's topic-progress history back into `progress-unlocks.ts`'s
 * tier computation": it builds one contributor's `ContributorProgress`
 * (their `totalCompletedTasks` in particular) directly from this store's
 * completed/active assignments, filtered to that contributor up front
 * rather than building the whole board and searching it. `lib/unlock-streak-status.ts`'s
 * `buildContributorUnlockStatusWithStreakFromStore` reads it to gate a
 * contributor's unlock tier on their completed-task count via the new
 * `lib/unlock-progress-status.ts` slice.
 *
 * @module state/researchProgress
 */

import {
  buildContributorProgress,
  buildResearchProgressBoard,
  type ContributorProgress,
  type TrackedTopicAssignment,
} from "../lib/research-progress";
import { DEFAULT_HELPFULNESS_WEIGHTS, type HelpfulnessWeights } from "../lib/community-rating";
import type { RoutedAssignment } from "../lib/research-task-routing";
import { listContributions, listContributionsByContributor } from "./contributions";
import { completePersistedRoutedTask, listRoutedTaskQueues } from "./routedTaskQueues";

/** One completed research task, remembered after `completePersistedRoutedTask` removes it from its active queue. */
export interface CompletedTaskRecord {
  topic: string;
  assignment: RoutedAssignment;
  completedAt: string;
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
 * Builds one contributor's `ContributorProgress` directly from real,
 * persisted state, filtered to that contributor before composing
 * `lib/research-progress.ts`'s pure `buildContributorProgress` — cheaper
 * than building the whole `buildPersistedResearchProgressBoard` and
 * searching it when only one contributor's standing (in particular their
 * `totalCompletedTasks`) is needed, e.g. to gate their unlock tier via
 * `lib/unlock-progress-status.ts`. Returns a progress record with empty
 * topics/zero completed tasks (never throws) for a contributor with no
 * persisted contributions or assignments.
 */
export function getPersistedContributorProgress(
  contributorId: string,
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): ContributorProgress {
  const completed: TrackedTopicAssignment[] = readAll()
    .filter((record) => record.assignment.contributorId === contributorId)
    .map((record) => ({ topic: record.topic, assignment: record.assignment, completedAt: record.completedAt }));

  const active: TrackedTopicAssignment[] = listRoutedTaskQueues().flatMap(({ topicId, result }) =>
    result.assignments
      .filter((assignment) => assignment.contributorId === contributorId)
      .map((assignment) => ({ topic: topicId, assignment })),
  );

  return buildContributorProgress(contributorId, listContributionsByContributor(contributorId), [...completed, ...active], weights);
}
