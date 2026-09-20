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
 * in one PUT" shape. Kept for a caller that genuinely needs a whole-value
 * replace, the same carve-out `normalizeFavoriteToolsPatch` documents — a
 * single freeze-day spend or reminder toggle should use
 * {@link normalizeQuestStreakFreezeOpPatch}/{@link normalizeQuestStreakReminderOpPatch}
 * instead, which avoid this path's lost-update race (see their docstrings).
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

/**
 * A single "spend a streak freeze on this day" operation, applied
 * server-side against the caller's *currently stored* `questStreakSync`
 * payload rather than a client-computed whole-value replacement — the fix
 * for the "two tabs/devices spend a streak freeze on different days at the
 * same time" lost-update race {@link normalizeQuestStreakSyncPatch}'s
 * whole-value replace is exposed to: `useQuestStreakSync.ts#pushLocalState`
 * used to PUT the browser's *entire* current `freezeDayKeys` list, so a tab
 * whose local copy was already behind another tab's latest freeze would
 * silently overwrite that other tab's newly-spent freeze — and since
 * `canApplyStreakFreeze` validates against this same list, the dropped
 * freeze could let a user "re-spend" one they'd already used. Add-only,
 * mirroring `news-stream-sync.ts#NewsReadOp` — spending a freeze has no
 * "un-spend" counterpart.
 */
export type QuestStreakFreezeOp = { recordStreakFreezeDayKey: string };

export type QuestStreakFreezeOpPatchResult = {
  /** Only the op, if present in `input` *and* valid. */
  valid: Partial<QuestStreakFreezeOp>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON)
 * `{ recordStreakFreezeDayKey }` patch, mirroring
 * `news-stream-sync.ts#normalizeNewsReadOpPatch`'s shape.
 */
export function normalizeQuestStreakFreezeOpPatch(input: unknown): QuestStreakFreezeOpPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  if (!("recordStreakFreezeDayKey" in record)) return { valid: {}, errors: [] };

  return isValidDayKey(record.recordStreakFreezeDayKey)
    ? { valid: { recordStreakFreezeDayKey: record.recordStreakFreezeDayKey }, errors: [] }
    : { valid: {}, errors: ['"recordStreakFreezeDayKey" must be a single YYYY-MM-DD day key.'] };
}

/**
 * Applies one validated `recordStreakFreezeDayKey` op to a currently stored
 * `questStreakSync` payload: appends the day key to `freezeDayKeys` if not
 * already present, capped at {@link MAX_QUEST_STREAK_FREEZE_DAY_KEYS}, and
 * leaves `lapseReminderEnabled` at its current stored value — defaulting to
 * `false` (matching `state/streakLapseReminders.ts`'s own opted-out default)
 * when nothing is stored yet. Pure and idempotent — returns the same `current`
 * reference (or an equivalent freshly-built default) when the day key is
 * already recorded, the list is already at capacity, or the day key is
 * invalid, mirroring `news-stream-sync.ts#applyNewsReadOp`.
 */
export function applyQuestStreakFreezeOp(
  current: QuestStreakSyncPayload | null,
  op: QuestStreakFreezeOp,
): QuestStreakSyncPayload {
  const base: QuestStreakSyncPayload = current ?? { lapseReminderEnabled: false, freezeDayKeys: [] };
  if (
    !isValidDayKey(op.recordStreakFreezeDayKey) ||
    base.freezeDayKeys.includes(op.recordStreakFreezeDayKey) ||
    base.freezeDayKeys.length >= MAX_QUEST_STREAK_FREEZE_DAY_KEYS
  ) {
    return base;
  }
  return { ...base, freezeDayKeys: [...base.freezeDayKeys, op.recordStreakFreezeDayKey] };
}

/**
 * A single "set my streak-lapse reminder opt-in" operation, applied
 * server-side against the caller's *currently stored* `questStreakSync`
 * payload rather than a client-computed whole-value replacement. Without
 * this, a reminder toggle on one device — which previously also resent that
 * device's entire local `freezeDayKeys` copy — could silently revert a
 * freeze another device had just spent, the same lost-update shape
 * {@link applyQuestStreakFreezeOp} closes for concurrent freeze spends.
 */
export type QuestStreakReminderOp = { setLapseReminderEnabled: boolean };

export type QuestStreakReminderOpPatchResult = {
  /** Only the op, if present in `input` *and* valid. */
  valid: Partial<QuestStreakReminderOp>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON)
 * `{ setLapseReminderEnabled }` patch.
 */
export function normalizeQuestStreakReminderOpPatch(input: unknown): QuestStreakReminderOpPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  if (!("setLapseReminderEnabled" in record)) return { valid: {}, errors: [] };

  return typeof record.setLapseReminderEnabled === "boolean"
    ? { valid: { setLapseReminderEnabled: record.setLapseReminderEnabled }, errors: [] }
    : { valid: {}, errors: ['"setLapseReminderEnabled" must be a boolean.'] };
}

/**
 * Applies one validated `setLapseReminderEnabled` op to a currently stored
 * `questStreakSync` payload: replaces just `lapseReminderEnabled`, leaving
 * `freezeDayKeys` at its current stored value (defaulting to `[]` when
 * nothing is stored yet) untouched.
 */
export function applyQuestStreakReminderOp(
  current: QuestStreakSyncPayload | null,
  op: QuestStreakReminderOp,
): QuestStreakSyncPayload {
  const base: QuestStreakSyncPayload = current ?? { lapseReminderEnabled: false, freezeDayKeys: [] };
  return { ...base, lapseReminderEnabled: op.setLapseReminderEnabled };
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
