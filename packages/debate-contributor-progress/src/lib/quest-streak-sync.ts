/**
 * @fileoverview Account-synced personal quest-streak preferences — the
 * "account-syncing reminder opt-ins/streak freezes across devices"
 * follow-up named under the "🎮 Gamified Quests" bullet (Research
 * Crowdsourcing Organizer Features) in TODO.md.
 * `state/streakLapseReminders.ts`'s opt-in flag and `state/streakFreezes.ts`'s
 * spent-freeze dayKeys already persist per contributor in localStorage; this
 * module adds the pure validation/serialization half needed to also sync the
 * signed-in visitor's own copy of both onto their `user_settings` row,
 * mirroring `research-progress-goal-sync.ts`'s split exactly (shared by the
 * `/api/settings` D1-backed route in `apps/debate-ai.com` and
 * `hooks/useQuestStreakSync.ts`).
 *
 * Like `ResearchProgressGoalSyncPayload`, this omits `contributorId` — the
 * account row already scopes it to one signed-in user — and bundles both
 * preferences into one JSON value rather than two columns, since they're
 * always synced together for the same contributor.
 *
 * @module lib/quest-streak-sync
 */

/** The synced subset of a contributor's quest-streak preferences. */
export type QuestStreakSyncPayload = {
  lapseReminderEnabled: boolean;
  /** UTC calendar days (`YYYY-MM-DD`) this contributor has already spent a streak freeze on. */
  freezeDayKeys: string[];
};

export type QuestStreakSyncPatch = {
  /** `null` clears the synced value; an object replaces it. */
  questStreakSync: QuestStreakSyncPayload | null;
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_QUEST_STREAK_SYNC: QuestStreakSyncPatch = {
  questStreakSync: null,
};

/** A year's worth of freeze dayKeys is already far more than `MAX_STREAK_FREEZES_PER_WINDOW` could ever produce — generous but bounded against a malicious client. */
export const MAX_QUEST_STREAK_FREEZE_DAY_KEYS = 366;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDayKey(value: unknown): value is string {
  return typeof value === "string" && DAY_KEY_PATTERN.test(value);
}

function isValidFreezeDayKeys(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_QUEST_STREAK_FREEZE_DAY_KEYS && value.every(isValidDayKey);
}

const ALLOWED_QUEST_STREAK_SYNC_KEYS = new Set(["lapseReminderEnabled", "freezeDayKeys"]);

export function isValidQuestStreakSyncPayload(value: unknown): value is QuestStreakSyncPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (!Object.keys(payload).every((key) => ALLOWED_QUEST_STREAK_SYNC_KEYS.has(key))) return false;
  if (typeof payload.lapseReminderEnabled !== "boolean") return false;
  if (!isValidFreezeDayKeys(payload.freezeDayKeys)) return false;
  return true;
}

export type QuestStreakSyncPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<QuestStreakSyncPatch>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch:
 * `questStreakSync` is accepted as `null` (clear) or a well-formed payload,
 * mirroring `normalizeResearchProgressGoalPatch`'s "replace the full value
 * in one PUT" shape.
 */
export function normalizeQuestStreakSyncPatch(input: unknown): QuestStreakSyncPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<QuestStreakSyncPatch> = {};
  const errors: string[] = [];

  if ("questStreakSync" in record) {
    const raw = record.questStreakSync;
    if (raw === null || isValidQuestStreakSyncPayload(raw)) {
      valid.questStreakSync = raw as QuestStreakSyncPayload | null;
    } else {
      errors.push(
        '"questStreakSync" must be null (to clear) or a { lapseReminderEnabled: boolean, freezeDayKeys: string[] } object, with each freezeDayKeys entry a YYYY-MM-DD day key.',
      );
    }
  }

  return { valid, errors };
}

/** Serializes a payload for the `quest_streak_sync` D1 column: `null` clears it, matching every other nullable column here. */
export function serializeQuestStreakSync(value: QuestStreakSyncPayload | null): string | null {
  return value === null ? null : JSON.stringify(value);
}

/** Parses the `quest_streak_sync` D1 column back into a payload. Never throws — a null, malformed, or invalid-shape value reads back as `null` rather than erroring the request. */
export function parseQuestStreakSync(raw: string | null | undefined): QuestStreakSyncPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidQuestStreakSyncPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
