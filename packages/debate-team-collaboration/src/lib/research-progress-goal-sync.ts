/**
 * @fileoverview Account-synced personal research-progress goal — the
 * "account-syncing the goal across devices" follow-up named under the "📈
 * Research Progress Tracking" bullet (Research Crowdsourcing Organizer
 * Features) in TODO.md. `state/researchProgressGoals.ts`'s
 * `ResearchProgressGoal` (defined in `lib/research-progress.ts`) already
 * persists at most one goal per contributor in localStorage; this module adds
 * the pure validation/serialization half needed to also sync the signed-in
 * visitor's own goal onto their `user_settings` row, mirroring
 * `argument-library-collections.ts`'s split exactly (shared by the
 * `/api/settings` D1-backed route in `apps/debate-ai.com` and
 * `hooks/useResearchProgressGoalSync.ts`).
 *
 * Unlike `SavedArgumentCollection`, this is a single nullable value rather
 * than a named list — a contributor has at most one goal at a time — so the
 * synced shape omits `contributorId` (the account row already scopes it to
 * one user) and `null` means "no goal set", matching the local store's own
 * "undefined means no goal" semantics.
 *
 * @module lib/research-progress-goal-sync
 */

/** The synced subset of `ResearchProgressGoal` — everything but `contributorId`, which the account row already scopes. */
export type ResearchProgressGoalSyncPayload = {
  targetCompletedTaskCount: number;
  topic?: string;
  targetDate?: string;
};

export type ResearchProgressGoalPatch = {
  /** `null` clears the synced goal; an object replaces it. */
  researchProgressGoal: ResearchProgressGoalSyncPayload | null;
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_RESEARCH_PROGRESS_GOAL_SYNC: ResearchProgressGoalPatch = {
  researchProgressGoal: null,
};

/** Generous but bounded, so a buggy or malicious client can't set an absurd target. */
export const MAX_GOAL_TARGET_COMPLETED_TASK_COUNT = 100_000;
const MAX_GOAL_TOPIC_LENGTH = 80;
/** Covers an ISO date (`2026-01-05`) or full timestamp string generously. */
const MAX_GOAL_TARGET_DATE_LENGTH = 40;

function isValidTargetCompletedTaskCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_GOAL_TARGET_COMPLETED_TASK_COUNT
  );
}

function isValidOptionalString(value: unknown, maxLength: number): boolean {
  if (value === undefined) return true;
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

const ALLOWED_GOAL_KEYS = new Set(["targetCompletedTaskCount", "topic", "targetDate"]);

export function isValidResearchProgressGoalSyncPayload(
  value: unknown,
): value is ResearchProgressGoalSyncPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const goal = value as Record<string, unknown>;
  if (!Object.keys(goal).every((key) => ALLOWED_GOAL_KEYS.has(key))) return false;
  if (!isValidTargetCompletedTaskCount(goal.targetCompletedTaskCount)) return false;
  if (!isValidOptionalString(goal.topic, MAX_GOAL_TOPIC_LENGTH)) return false;
  if (!isValidOptionalString(goal.targetDate, MAX_GOAL_TARGET_DATE_LENGTH)) return false;
  return true;
}

export type ResearchProgressGoalPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<ResearchProgressGoalPatch>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch:
 * `researchProgressGoal` is accepted as `null` (clear) or a well-formed goal
 * object, mirroring `normalizeSavedArgumentCollectionsPatch`'s "replace the
 * full value in one PUT" shape.
 */
export function normalizeResearchProgressGoalPatch(input: unknown): ResearchProgressGoalPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<ResearchProgressGoalPatch> = {};
  const errors: string[] = [];

  if ("researchProgressGoal" in record) {
    const raw = record.researchProgressGoal;
    if (raw === null || isValidResearchProgressGoalSyncPayload(raw)) {
      valid.researchProgressGoal = raw as ResearchProgressGoalSyncPayload | null;
    } else {
      errors.push(
        `"researchProgressGoal" must be null (to clear) or a { targetCompletedTaskCount, topic?, targetDate? } object, with a positive integer target (max ${MAX_GOAL_TARGET_COMPLETED_TASK_COUNT}) and non-empty optional topic/targetDate strings.`,
      );
    }
  }

  return { valid, errors };
}

/** Serializes a goal for the `research_progress_goal` D1 column: `null` clears it, matching every other nullable column here. */
export function serializeResearchProgressGoal(goal: ResearchProgressGoalSyncPayload | null): string | null {
  return goal === null ? null : JSON.stringify(goal);
}

/** Parses the `research_progress_goal` D1 column back into a goal. Never throws — a null, malformed, or invalid-shape value reads back as `null` rather than erroring the request. */
export function parseResearchProgressGoal(raw: string | null | undefined): ResearchProgressGoalSyncPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidResearchProgressGoalSyncPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
