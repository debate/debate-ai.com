/**
 * @fileoverview Account-linked routed-task-queue sync — the
 * "account-syncing routed queues across devices" follow-up named under the
 * "🧭 Research Task Routing" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features. Pure validation helpers shared by the
 * `/api/routed-task-queues` D1-backed routes (`apps/debate-ai.com`) and
 * `hooks/useRoutedTaskQueues.ts`, mirroring `state/savedDrillSets.ts`'s
 * split — kept framework/fetch-free so both sides agree on what a valid
 * synced record is without duplicating logic.
 *
 * Like `saved_drill_sets`, a `RoutedTaskQueueRecord`'s payload is small (a
 * topic's routed assignments and unassigned tasks) so
 * `GET /api/routed-task-queues` returns every record in full — there is no
 * separate summary/label concept here.
 *
 * @module state/savedRoutedTaskQueues
 */

import type { CoverageLevel } from "debate-research-evidence/src/lib/topic-coverage";
import type { ResearchTask, RoutedAssignment, SkillLevel, TaskPriority } from "debate-research-evidence/src/lib/research-task-routing";
import type { RoutedTaskQueueRecord } from "./routedTaskQueues";

/** Hard cap on a single routed task queue's JSON size — generous for even a large topic, well short of D1's row-size limits. */
export const MAX_SAVED_ROUTED_TASK_QUEUE_BYTES = 200_000;

const COVERAGE_LEVELS: readonly CoverageLevel[] = ["missing", "thin", "covered"];
const SKILL_LEVELS: readonly SkillLevel[] = ["novice", "intermediate", "advanced"];
const TASK_PRIORITIES: readonly TaskPriority[] = ["normal", "high"];

function isValidResearchTask(value: unknown): value is ResearchTask {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.argBlock === "string" &&
    (task.category === undefined || typeof task.category === "string") &&
    typeof task.level === "string" &&
    (COVERAGE_LEVELS as string[]).includes(task.level) &&
    typeof task.requiredSkill === "string" &&
    (SKILL_LEVELS as string[]).includes(task.requiredSkill)
  );
}

function isValidRoutedAssignment(value: unknown): value is RoutedAssignment {
  if (typeof value !== "object" || value === null) return false;
  const assignment = value as Record<string, unknown>;
  return (
    isValidResearchTask(assignment.task) &&
    typeof assignment.contributorId === "string" &&
    (assignment.priority === undefined ||
      (typeof assignment.priority === "string" && (TASK_PRIORITIES as string[]).includes(assignment.priority)))
  );
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `RoutedTaskQueueRecord`.
 */
export function isValidRoutedTaskQueueRecord(value: unknown): value is RoutedTaskQueueRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.topicId !== "string" || record.topicId.trim().length === 0) return false;
  if (typeof record.result !== "object" || record.result === null) return false;

  const result = record.result as Record<string, unknown>;
  if (!Array.isArray(result.assignments) || !result.assignments.every(isValidRoutedAssignment)) return false;
  if (!Array.isArray(result.unassignedTasks) || !result.unassignedTasks.every(isValidResearchTask)) return false;
  if (record.updatedAt !== undefined && typeof record.updatedAt !== "number") return false;

  return true;
}
