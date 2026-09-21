/**
 * @fileoverview Account-synced brainstorm session timer — closes
 * `brainstorm-board.mdx`'s Known gaps entry "The session timer is
 * `localStorage`-only, not account-synced." `state/brainstormSessionTimer.ts`
 * already persists the single squad-wide countdown in localStorage; this
 * module adds the pure validation/serialization half needed to also mirror
 * the signed-in visitor's own timer onto their `user_settings` row,
 * mirroring `research-progress-goal-sync.ts`'s split exactly (shared by the
 * `/api/settings` D1-backed route in `apps/debate-ai.com` and
 * `hooks/useBrainstormSessionTimerSync.ts`).
 *
 * Unlike `ResearchProgressGoalSyncPayload`, this mirrors every field of
 * `BrainstormSessionTimerState` (`lib/brainstorm-session-timer.ts`)
 * unchanged rather than a subset — there's no per-contributor id to omit,
 * since the timer is a single value shared by whoever has the board open,
 * same as the local store. `endsAt` is an absolute epoch-ms timestamp, so it
 * carries across devices correctly without any clock-skew adjustment, the
 * same way it already works across tabs on one device via the local store's
 * `storage` event.
 *
 * @module lib/brainstorm-session-timer-sync
 */

import type { BrainstormSessionTimerState } from "./brainstorm-session-timer";

/** The synced shape — identical to {@link BrainstormSessionTimerState}, kept as its own type so this module doesn't need to import the local-store wrapper. */
export type BrainstormSessionTimerSyncPayload = BrainstormSessionTimerState;

export type BrainstormSessionTimerPatch = {
  /** `null` clears the synced timer; an object replaces it. */
  brainstormSessionTimer: BrainstormSessionTimerSyncPayload | null;
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC: BrainstormSessionTimerPatch = {
  brainstormSessionTimer: null,
};

/** Generous but bounded (24 hours) so a buggy or malicious client can't set an absurd duration or paused-remaining value. */
export const MAX_BRAINSTORM_SESSION_TIMER_SECONDS = 24 * 60 * 60;

const ALLOWED_TIMER_KEYS = new Set(["durationSeconds", "status", "endsAt", "remainingSecondsWhenPaused"]);
const VALID_STATUSES = new Set(["idle", "running", "paused"]);

function isValidSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_BRAINSTORM_SESSION_TIMER_SECONDS;
}

function isValidEpochMs(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Validates the full shape, including the same status-dependent field
 * invariants `lib/brainstorm-session-timer.ts`'s own transitions maintain
 * (`endsAt` set only while `"running"`, `remainingSecondsWhenPaused` only
 * while `"paused"`) — a stricter check than `research-progress-goal-sync.ts`
 * needs, since a corrupt cross-field combination here (e.g. `"idle"` with a
 * stale `endsAt`) would otherwise resurrect a countdown that should have
 * ended.
 */
export function isValidBrainstormSessionTimerSyncPayload(
  value: unknown,
): value is BrainstormSessionTimerSyncPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const timer = value as Record<string, unknown>;
  if (!Object.keys(timer).every((key) => ALLOWED_TIMER_KEYS.has(key))) return false;
  if (!isValidSeconds(timer.durationSeconds)) return false;
  if (typeof timer.status !== "string" || !VALID_STATUSES.has(timer.status)) return false;

  if (timer.status === "running") {
    if (!isValidEpochMs(timer.endsAt)) return false;
    if (timer.remainingSecondsWhenPaused !== null) return false;
  } else if (timer.status === "paused") {
    if (timer.endsAt !== null) return false;
    if (!isValidSeconds(timer.remainingSecondsWhenPaused)) return false;
  } else {
    if (timer.endsAt !== null) return false;
    if (timer.remainingSecondsWhenPaused !== null) return false;
  }

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
 * timer state, mirroring `normalizeResearchProgressGoalPatch`'s "replace the
 * full value in one PUT" shape — a session timer is a single low-frequency
 * write, so there's no op-based conflict resolution to add here.
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
        '"brainstormSessionTimer" must be null (to clear) or a { durationSeconds, status, endsAt, remainingSecondsWhenPaused } object matching the timer state machine.',
      );
    }
  }

  return { valid, errors };
}

/** Serializes a timer state for the `brainstorm_session_timer` D1 column: `null` clears it, matching every other nullable column here. */
export function serializeBrainstormSessionTimer(timer: BrainstormSessionTimerSyncPayload | null): string | null {
  return timer === null ? null : JSON.stringify(timer);
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
