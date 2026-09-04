/**
 * @fileoverview Persistent storage for a contributor's own personal
 * completed-task goal — the "personal goal-setting UI" follow-up named
 * under the "📈 Research Progress Tracking" bullet in TODO.md.
 * `lib/research-progress.ts`'s `ResearchProgressGoal`/`computeGoalProgress`
 * are pure; this module persists one goal per contributor in localStorage,
 * mirroring `streakFreezes.ts`'s "array of records filtered by
 * `contributorId`" persistence convention (SSR/no-storage-safe, corrupt or
 * missing JSON degrades to an empty list rather than throwing). Deliberately
 * local-only, not account-synced: like `streakLapseReminders.ts`/
 * `streakFreezes.ts`, this is a lightweight per-visitor preference, not a
 * cross-tool record a coach needs to see — a future run can add account sync
 * (mirroring `wordLimitPresets.ts`'s split) if that turns out to matter.
 *
 * `getPersistedGoalProgressForContributor` composes `computeGoalProgress`
 * directly against `state/researchProgress.ts`'s
 * `buildPersistedResearchProgressBoard`, so a caller doesn't need to look up
 * the contributor's own `ContributorProgress` row itself — mirroring
 * `streakFreezes.ts#buildContributorQuestStreakWithFreezes`'s "compose the
 * pure function directly against the persisted stores" convention. A
 * contributor with no board row at all (no contributions or assignments
 * yet) still gets a `GoalProgress` with `currentCompletedTaskCount: 0`
 * rather than `undefined`, since setting a goal before doing any tracked
 * work is a normal starting point.
 *
 * @module state/researchProgressGoals
 */

import { computeGoalProgress, type ContributorProgress, type GoalProgress, type ResearchProgressGoal } from "../lib/research-progress";
import { buildPersistedResearchProgressBoard } from "./researchProgress";

/** Thrown when a goal is set with a non-positive target — a goal always needs something to count toward. */
export class InvalidGoalTargetError extends Error {
  constructor(targetCompletedTaskCount: number) {
    super(`Goal target must be a positive number of tasks, got ${targetCompletedTaskCount}`);
    this.name = "InvalidGoalTargetError";
  }
}

const STORAGE_KEY = "researchProgressGoals";

function readAll(): ResearchProgressGoal[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ResearchProgressGoal[]) : [];
  } catch {
    return [];
  }
}

function writeAll(goals: ResearchProgressGoal[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

/** Lists every persisted goal, across all contributors. */
export function listResearchProgressGoals(): ResearchProgressGoal[] {
  return readAll();
}

/** Reads a single contributor's persisted goal, or `undefined` if they haven't set one. */
export function getGoalForContributor(contributorId: string): ResearchProgressGoal | undefined {
  return readAll().find((goal) => goal.contributorId === contributorId);
}

/**
 * Sets (or replaces) a contributor's goal — at most one is tracked per
 * contributor at a time, so setting a new one for an id that already has a
 * goal overwrites it. Throws `InvalidGoalTargetError`, leaving the store
 * untouched, if `targetCompletedTaskCount` isn't a positive number.
 */
export function setGoalForContributor(goal: ResearchProgressGoal): void {
  if (!(goal.targetCompletedTaskCount > 0)) {
    throw new InvalidGoalTargetError(goal.targetCompletedTaskCount);
  }
  const others = readAll().filter((existing) => existing.contributorId !== goal.contributorId);
  writeAll([...others, goal]);
}

/** Clears a contributor's persisted goal, if any. A no-op if they don't have one. */
export function clearGoalForContributor(contributorId: string): void {
  writeAll(readAll().filter((goal) => goal.contributorId !== contributorId));
}

/**
 * Builds a contributor's progress toward their own persisted goal, composed
 * directly against the real, persisted research-progress board. Returns
 * `undefined` if the contributor hasn't set a goal.
 */
export function getPersistedGoalProgressForContributor(contributorId: string): GoalProgress | undefined {
  const goal = getGoalForContributor(contributorId);
  if (!goal) return undefined;

  const board = buildPersistedResearchProgressBoard();
  const progress: ContributorProgress =
    board.find((entry) => entry.contributorId === contributorId) ?? {
      contributorId,
      contributionStats: null,
      topics: [],
      totalAssignedTasks: 0,
      totalCompletedTasks: 0,
      overallCompletionRate: 0,
    };

  return computeGoalProgress(progress, goal);
}
