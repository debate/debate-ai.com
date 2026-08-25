/**
 * @fileoverview Persistent "awaiting verification" queue for routed research
 * tasks — closes the "No reviewer/verification step before a task is marked
 * complete; any visitor can mark any assignment done" Known gap recorded in
 * `docs/features/task-inbox.md` under the "🧭 Research Task Routing" bullet
 * in TODO.md.
 *
 * `markRoutedTaskAwaitingVerification` is the new "mark done" step
 * `panels/TaskInboxPanel.tsx` calls instead of `state/researchProgress.ts`'s
 * `completeAndRecordResearchTask` directly: it still removes the assignment
 * from its topic's active routed queue and decrements the assignee's stored
 * `activeTaskCount` the same way `completePersistedRoutedTask` always did
 * (freeing their capacity right away), but instead of immediately crediting
 * the completion, it stores the assignment here, pending a different
 * contributor's confirmation via `state/researchProgress.ts`'s new
 * `verifyAndRecordResearchTask` (gated by `lib/task-verification.ts`'s
 * `assertVerifierAllowed`). `completeAndRecordResearchTask` itself is
 * unchanged and still available for direct, unverified completion by any
 * other caller (tests, or a future trusted integration) — this is an
 * additive, opt-in gate the UI now uses, not a breaking change to the
 * existing completion API.
 *
 * Mirrors `routedTaskQueues.ts`'s persistence convention (SSR/no-storage-safe,
 * corrupt or missing JSON degrades to an empty list rather than throwing).
 *
 * @module state/pendingTaskVerifications
 */

import type { RoutedAssignment } from "../lib/research-task-routing";
import { completePersistedRoutedTask } from "./routedTaskQueues";

/** One routed task marked done, awaiting a different contributor's verification. */
export interface PendingTaskVerification {
  topicId: string;
  assignment: RoutedAssignment;
  markedDoneAt: string;
}

const STORAGE_KEY = "pendingTaskVerifications";

function readAll(): PendingTaskVerification[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingTaskVerification[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: PendingTaskVerification[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every task currently awaiting verification, across all topics. */
export function listPendingTaskVerifications(): PendingTaskVerification[] {
  return readAll();
}

/** Looks up the pending verification record for one topic's task by `argBlock`, if any. */
export function getPendingTaskVerification(topicId: string, argBlock: string): PendingTaskVerification | undefined {
  return readAll().find((record) => record.topicId === topicId && record.assignment.task.argBlock === argBlock);
}

/** Removes a pending verification record; a no-op if none matches. */
export function removePendingTaskVerification(topicId: string, argBlock: string): void {
  writeAll(readAll().filter((record) => !(record.topicId === topicId && record.assignment.task.argBlock === argBlock)));
}

/**
 * Marks a routed task done, pending verification: removes it from its
 * topic's stored active queue and decrements its assignee's stored
 * `activeTaskCount` via `completePersistedRoutedTask` (identical side
 * effects to today's direct completion), then stores it here instead of
 * crediting it immediately. Returns the completed assignment, or
 * `undefined` — leaving both stores untouched — if the topic has no
 * persisted queue or no assignment for that `argBlock`.
 */
export function markRoutedTaskAwaitingVerification(
  topicId: string,
  argBlock: string,
  markedDoneAt: string,
): RoutedAssignment | undefined {
  const assignment = completePersistedRoutedTask(topicId, argBlock);
  if (!assignment) return undefined;

  const records = readAll();
  records.push({ topicId, assignment, markedDoneAt });
  writeAll(records);
  return assignment;
}
