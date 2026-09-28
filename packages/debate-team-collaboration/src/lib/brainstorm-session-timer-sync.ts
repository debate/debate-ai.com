/**
 * @fileoverview Account-synced Team Brainstorm Assist session timer — closes
 * `packages/debate-help-docs/content/docs/features/brainstorm-board.mdx`'s
 * "The session timer is `localStorage`-only, not account-synced" Known gap.
 * `state/brainstormSessionTimer.ts` already persists at most one squad
 * session timer per browser in `localStorage`; this module adds the pure
 * validation/serialization half needed to also sync the signed-in visitor's
 * own timer onto their `user_settings` row, mirroring
 * `research-progress-goal-sync.ts`'s split exactly (shared by the
 * `/api/settings` D1-backed route in `apps/debate-ai.com` and
 * `hooks/useBrainstormSessionTimerSync.ts`).
 *
 * Like `ResearchProgressGoalSyncPayload`, this is a single nullable value
 * rather than a named list — a browser has at most one session timer at a
 * time — so a PUT replaces the whole stored value rather than resolving an
 * op against it: unlike the op-based fields in `/api/settings`, a session
 * timer has one moderator driving it at a time, so the "two tabs/devices
 * edit the same field at once" race those exist for doesn't apply here.
 *
 * @module lib/brainstorm-session-timer-sync
 */

import type { BrainstormSessionTimerState } from "./brainstorm-session-timer";

/** The synced shape — identical to `BrainstormSessionTimerState`, kept as its own type so a future divergence doesn't ripple silently. */
export type BrainstormSessionTimerSyncPayload = BrainstormSessionTimerState;

export type BrainstormSessionTimerPatch = {
  /** `null` clears the synced timer; an object replaces it. */
  brainstormSessionTimer: BrainstormSessionTimerSyncPayload | null;
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC: BrainstormSessionTimerPatch = {
  brainstormSessionTimer: null,
};

/** Generous but bounded (24h), so a buggy or malicious client can't set an absurd countdown. */
export const MAX_BRAINSTORM_SESSION_TIMER_SECONDS = 24 * 60 * 60;

const VALID_STATUSES = new Set(["idle", "running", "paused"]);
const ALLOWED_TIMER_KEYS = new Set(["durationSeconds", "status", "endsAt", "remainingSecondsWhenPaused"]);

function isValidSeconds(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_BRAINSTORM_SESSION_TIMER_SECONDS
  );
}

function isValidNullableSeconds(value: unknown): boolean {
  return value === null || isValidSeconds(value);
}

/** `endsAt` is an epoch-ms timestamp, not a duration, so it isn't bounded by `MAX_BRAINSTORM_SESSION_TIMER_SECONDS`. */
function isValidNullableTimestamp(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

export function isValidBrainstormSessionTimerSyncPayload(
  value: unknown,
): value is BrainstormSessionTimerSyncPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if (!Object.keys(state).every((key) => ALLOWED_TIMER_KEYS.has(key))) return false;
  if (!isValidSeconds(state.durationSeconds)) return false;
  if (typeof state.status !== "string" || !VALID_STATUSES.has(state.status)) return false;
  if (!isValidNullableTimestamp(state.endsAt)) return false;
  if (!isValidNullableSeconds(state.remainingSecondsWhenPaused)) return false;
  return true;
}

export type BrainstormSessionTimerPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<BrainstormSessionTimerPatch>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch:
 * `brainstormSessionTimer` is accepted as `null` (clear) or a well-formed
 * timer state object, mirroring `normalizeResearchProgressGoalPatch`'s
 * "replace the full value in one PUT" shape.
 */
export function normalizeBrainstormSessionTimerPatch(input: unknown): BrainstormSessionTimerPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<BrainstormSessionTimerPatch> = {};
  const errors: string[] = [];

  if ("brainstormSessionTimer" in record) {
    const raw = record.brainstormSessionTimer;
    if (raw === null || isValidBrainstormSessionTimerSyncPayload(raw)) {
      valid.brainstormSessionTimer = raw as BrainstormSessionTimerSyncPayload | null;
    } else {
      errors.push(
        `"brainstormSessionTimer" must be null (to clear) or a { durationSeconds, status, endsAt, remainingSecondsWhenPaused } object, with a non-negative duration (max ${MAX_BRAINSTORM_SESSION_TIMER_SECONDS}), status one of "idle"/"running"/"paused", and endsAt/remainingSecondsWhenPaused each a non-negative number or null.`,
      );
    }
  }

  return { valid, errors };
}

/** Serializes a timer for the `brainstorm_session_timer` D1 column: `null` clears it, matching every other nullable column here. */
export function serializeBrainstormSessionTimer(state: BrainstormSessionTimerSyncPayload | null): string | null {
  return state === null ? null : JSON.stringify(state);
}

/** Parses the `brainstorm_session_timer` D1 column back into a timer state. Never throws — a null, malformed, or invalid-shape value reads back as `null` rather than erroring the request. */
export function parseBrainstormSessionTimer(raw: string | null | undefined): BrainstormSessionTimerSyncPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidBrainstormSessionTimerSyncPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
