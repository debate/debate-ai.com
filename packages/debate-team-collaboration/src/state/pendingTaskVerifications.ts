/**
 * @fileoverview Persistent "awaiting verification" queue for routed research
 * tasks — closes the "No reviewer/verification step before a task is marked
 * complete; any visitor can mark any assignment done" Known gap recorded in
 * `packages/debate-help-docs/content/docs/features/task-inbox.mdx` under the "🧭 Research Task Routing" bullet
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
 * `PendingTaskVerification.id` closes the "per-browser localStorage, not
 * account-synced" gap: like `state/coachingSessions.ts`'s
 * `CoachingSessionRecord` before it, this store used to be keyed only by the
 * `(topicId, argBlock)` pair with no single stable string field, so
 * `debate-data-sync`'s `saved_tool_records` catalog (which requires every
 * record to carry one) couldn't key a row for it.
 * `markRoutedTaskAwaitingVerification` now stamps every record with a
 * derived `${topicId}::${argBlock}` id, and `pendingTaskVerifications` is
 * registered in `TOOL_RECORD_COLLECTIONS`, so a task a contributor marks
 * done on one device still shows up "Awaiting verification" for a teammate
 * on another.
 *
 * @module state/pendingTaskVerifications
 */

import type { RoutedAssignment } from "debate-research-evidence/src/lib/research-task-routing";
import { completePersistedRoutedTask } from "./routedTaskQueues";

/** One routed task marked done, awaiting a different contributor's verification. */
export interface PendingTaskVerification {
  /**
   * Stable id this record is keyed by — `${topicId}::${argBlock}` — what
   * lets it join `debate-data-sync`'s account-sync allowlist (see
   * `state/toolRecordCollections.ts`'s `pendingTaskVerifications` entry).
   * `markRoutedTaskAwaitingVerification` always derives and stamps this
   * rather than trusting a caller-supplied value. A record persisted before
   * this field existed has none and is simply never matched by id: it stays
   * valid and locally readable, just un-synced, mirroring how every other
   * `TOOL_RECORD_COLLECTIONS` store tolerates a pre-existing id-less record.
   */
  id: string;
  topicId: string;
  assignment: RoutedAssignment;
  markedDoneAt: string;
}

const STORAGE_KEY = "pendingTaskVerifications";

/** The stable id a topic+argBlock pair's `PendingTaskVerification` is always stamped with. */
function pendingTaskVerificationId(topicId: string, argBlock: string): string {
  return `${topicId}::${argBlock}`;
}

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
  records.push({ id: pendingTaskVerificationId(topicId, argBlock), topicId, assignment, markedDoneAt });
  writeAll(records);
  return assignment;
}
