import { describe, expect, it } from "vitest";
import {
  applyQuestStreakFreezeOp,
  applyQuestStreakMissionResultOp,
  applyQuestStreakReminderOp,
  DEFAULT_QUEST_STREAK_SYNC,
  isValidQuestStreakSyncPayload,
  MAX_QUEST_STREAK_FREEZE_DAY_KEYS,
  MAX_QUEST_STREAK_MISSION_RESULT_DAYS,
  normalizeQuestStreakFreezeOpPatch,
  normalizeQuestStreakMissionResultOpPatch,
  normalizeQuestStreakReminderOpPatch,
  normalizeQuestStreakSyncPatch,
  parseQuestStreakSync,
  serializeQuestStreakSync,
} from "../src/lib/quest-streak-sync";

describe("DEFAULT_QUEST_STREAK_SYNC", () => {
  it("defaults to nothing synced", () => {
    expect(DEFAULT_QUEST_STREAK_SYNC).toEqual({ questStreakSync: null });
  });
});

describe("isValidQuestStreakSyncPayload", () => {
  it("accepts a reminder-only payload with no freezes", () => {
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: true, freezeDayKeys: [] })).toBe(true);
  });

  it("accepts a payload with freeze day keys", () => {
    expect(
      isValidQuestStreakSyncPayload({ lapseReminderEnabled: false, freezeDayKeys: ["2026-08-09", "2026-08-15"] }),
    ).toBe(true);
  });

  it("accepts exactly the maximum number of freeze day keys", () => {
    const freezeDayKeys = Array.from(
      { length: MAX_QUEST_STREAK_FREEZE_DAY_KEYS },
      (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    );
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: false, freezeDayKeys })).toBe(true);
  });

  it("rejects more than the maximum number of freeze day keys", () => {
    const freezeDayKeys = Array.from(
      { length: MAX_QUEST_STREAK_FREEZE_DAY_KEYS + 1 },
      (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    );
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: false, freezeDayKeys })).toBe(false);
  });

  it("rejects a malformed day key", () => {
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: false, freezeDayKeys: ["not-a-day"] })).toBe(false);
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: false, freezeDayKeys: ["2026-8-9"] })).toBe(false);
  });

  it("rejects a non-boolean lapseReminderEnabled", () => {
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: "yes", freezeDayKeys: [] })).toBe(false);
  });

  it("rejects a missing field", () => {
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: true })).toBe(false);
    expect(isValidQuestStreakSyncPayload({ freezeDayKeys: [] })).toBe(false);
  });

  it("rejects freezeDayKeys that isn't an array", () => {
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: true, freezeDayKeys: "2026-08-09" })).toBe(false);
  });

  it("rejects an unrecognized field, e.g. a smuggled contributorId", () => {
    expect(
      isValidQuestStreakSyncPayload({
        lapseReminderEnabled: true,
        freezeDayKeys: [],
        contributorId: "someone-else",
      }),
    ).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isValidQuestStreakSyncPayload(null)).toBe(false);
    expect(isValidQuestStreakSyncPayload("payload")).toBe(false);
    expect(isValidQuestStreakSyncPayload([{ lapseReminderEnabled: true, freezeDayKeys: [] }])).toBe(false);
  });

  it("accepts a payload with no missionResultDays field at all (the pre-existing shape)", () => {
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: true, freezeDayKeys: [] })).toBe(true);
  });

  it("accepts a payload with missionResultDays", () => {
    expect(
      isValidQuestStreakSyncPayload({
        lapseReminderEnabled: true,
        freezeDayKeys: [],
        missionResultDays: [
          { dayKey: "2026-08-09", isComplete: true },
          { dayKey: "2026-08-10", isComplete: false },
        ],
      }),
    ).toBe(true);
  });

  it("accepts exactly the maximum number of missionResultDays entries", () => {
    const missionResultDays = Array.from(
      { length: MAX_QUEST_STREAK_MISSION_RESULT_DAYS },
      (_, i) => ({ dayKey: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, isComplete: i % 2 === 0 }),
    );
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: false, freezeDayKeys: [], missionResultDays })).toBe(
      true,
    );
  });

  it("rejects more than the maximum number of missionResultDays entries", () => {
    const missionResultDays = Array.from(
      { length: MAX_QUEST_STREAK_MISSION_RESULT_DAYS + 1 },
      (_, i) => ({ dayKey: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, isComplete: true }),
    );
    expect(isValidQuestStreakSyncPayload({ lapseReminderEnabled: false, freezeDayKeys: [], missionResultDays })).toBe(
      false,
    );
  });

  it("rejects a missionResultDays entry with a malformed day key", () => {
    expect(
      isValidQuestStreakSyncPayload({
        lapseReminderEnabled: false,
        freezeDayKeys: [],
        missionResultDays: [{ dayKey: "not-a-day", isComplete: true }],
      }),
    ).toBe(false);
  });

  it("rejects a missionResultDays entry with a non-boolean isComplete", () => {
    expect(
      isValidQuestStreakSyncPayload({
        lapseReminderEnabled: false,
        freezeDayKeys: [],
        missionResultDays: [{ dayKey: "2026-08-09", isComplete: "yes" }],
      }),
    ).toBe(false);
  });

  it("rejects a missionResultDays entry with an extra field", () => {
    expect(
      isValidQuestStreakSyncPayload({
        lapseReminderEnabled: false,
        freezeDayKeys: [],
        missionResultDays: [{ dayKey: "2026-08-09", isComplete: true, contributorId: "smuggled" }],
      }),
    ).toBe(false);
  });

  it("rejects missionResultDays that isn't an array", () => {
    expect(
      isValidQuestStreakSyncPayload({ lapseReminderEnabled: false, freezeDayKeys: [], missionResultDays: "nope" }),
    ).toBe(false);
  });
});

describe("normalizeQuestStreakSyncPatch", () => {
  it("accepts null as a clear instruction", () => {
    const result = normalizeQuestStreakSyncPatch({ questStreakSync: null });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ questStreakSync: null });
  });

  it("accepts a well-formed payload", () => {
    const payload = { lapseReminderEnabled: true, freezeDayKeys: ["2026-08-09"] };
    const result = normalizeQuestStreakSyncPatch({ questStreakSync: payload });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ questStreakSync: payload });
  });

  it("rejects a malformed payload with an error message and leaves valid empty", () => {
    const result = normalizeQuestStreakSyncPatch({ questStreakSync: { lapseReminderEnabled: "nope" } });
    expect(result.errors).toHaveLength(1);
    expect(result.valid).toEqual({});
  });

  it("omits the field entirely when absent from the input", () => {
    const result = normalizeQuestStreakSyncPatch({ debateStyle: 1 });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({});
  });

  it("rejects a non-object request body", () => {
    const result = normalizeQuestStreakSyncPatch("not an object");
    expect(result.errors).toHaveLength(1);
    expect(result.valid).toEqual({});
  });
});

describe("serializeQuestStreakSync / parseQuestStreakSync", () => {
  it("round-trips a payload", () => {
    const payload = { lapseReminderEnabled: true, freezeDayKeys: ["2026-08-09", "2026-08-15"] };
    expect(parseQuestStreakSync(serializeQuestStreakSync(payload))).toEqual(payload);
  });

  it("serializes null to null and parses null/empty back to null", () => {
    expect(serializeQuestStreakSync(null)).toBeNull();
    expect(parseQuestStreakSync(null)).toBeNull();
    expect(parseQuestStreakSync(undefined)).toBeNull();
    expect(parseQuestStreakSync("")).toBeNull();
  });

  it("parses corrupt JSON back to null rather than throwing", () => {
    expect(parseQuestStreakSync("{not json")).toBeNull();
  });

  it("parses a stored value that fails validation back to null", () => {
    expect(parseQuestStreakSync(JSON.stringify({ lapseReminderEnabled: "nope", freezeDayKeys: [] }))).toBeNull();
  });

  it("round-trips a payload carrying missionResultDays", () => {
    const payload = {
      lapseReminderEnabled: false,
      freezeDayKeys: ["2026-08-09"],
      missionResultDays: [{ dayKey: "2026-08-09", isComplete: true }],
    };
    expect(parseQuestStreakSync(serializeQuestStreakSync(payload))).toEqual(payload);
  });

  it("parses a pre-existing stored value with no missionResultDays field back unchanged", () => {
    const stored = JSON.stringify({ lapseReminderEnabled: true, freezeDayKeys: ["2026-08-09"] });
    expect(parseQuestStreakSync(stored)).toEqual({ lapseReminderEnabled: true, freezeDayKeys: ["2026-08-09"] });
  });
});

describe("normalizeQuestStreakFreezeOpPatch", () => {
  it("accepts a valid recordStreakFreezeDayKey op", () => {
    expect(normalizeQuestStreakFreezeOpPatch({ recordStreakFreezeDayKey: "2026-08-09" })).toEqual({
      valid: { recordStreakFreezeDayKey: "2026-08-09" },
      errors: [],
    });
  });

  it("returns no valid op and no errors when the field is absent", () => {
    expect(normalizeQuestStreakFreezeOpPatch({ debateStyle: 1 })).toEqual({ valid: {}, errors: [] });
  });

  it("rejects a malformed day key", () => {
    const result = normalizeQuestStreakFreezeOpPatch({ recordStreakFreezeDayKey: "not-a-day" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object request body", () => {
    const result = normalizeQuestStreakFreezeOpPatch("not an object");
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });
});

describe("applyQuestStreakFreezeOp", () => {
  it("appends a new day key to an existing payload", () => {
    const current = { lapseReminderEnabled: true, freezeDayKeys: ["2026-08-09"] };
    expect(applyQuestStreakFreezeOp(current, { recordStreakFreezeDayKey: "2026-08-15" })).toEqual({
      lapseReminderEnabled: true,
      freezeDayKeys: ["2026-08-09", "2026-08-15"],
    });
  });

  it("builds a fresh payload (opted-out default) when nothing is stored yet", () => {
    expect(applyQuestStreakFreezeOp(null, { recordStreakFreezeDayKey: "2026-08-09" })).toEqual({
      lapseReminderEnabled: false,
      freezeDayKeys: ["2026-08-09"],
    });
  });

  it("returns the same reference when the day key is already recorded", () => {
    const current = { lapseReminderEnabled: false, freezeDayKeys: ["2026-08-09"] };
    expect(applyQuestStreakFreezeOp(current, { recordStreakFreezeDayKey: "2026-08-09" })).toBe(current);
  });

  it("returns the same reference for an invalid day key", () => {
    const current = { lapseReminderEnabled: false, freezeDayKeys: ["2026-08-09"] };
    expect(applyQuestStreakFreezeOp(current, { recordStreakFreezeDayKey: "not-a-day" })).toBe(current);
  });

  it("silently drops an add once freezeDayKeys is at MAX_QUEST_STREAK_FREEZE_DAY_KEYS", () => {
    const freezeDayKeys = Array.from(
      { length: MAX_QUEST_STREAK_FREEZE_DAY_KEYS },
      (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    );
    const current = { lapseReminderEnabled: false, freezeDayKeys };
    expect(applyQuestStreakFreezeOp(current, { recordStreakFreezeDayKey: "2027-01-01" })).toBe(current);
  });

  it("two concurrent freeze spends resolve onto the same starting payload without dropping either", () => {
    const start = { lapseReminderEnabled: false, freezeDayKeys: ["2026-08-09"] };
    const afterFirst = applyQuestStreakFreezeOp(start, { recordStreakFreezeDayKey: "2026-08-15" });
    const afterSecond = applyQuestStreakFreezeOp(start, { recordStreakFreezeDayKey: "2026-08-20" });
    expect(afterFirst.freezeDayKeys).toEqual(["2026-08-09", "2026-08-15"]);
    expect(afterSecond.freezeDayKeys).toEqual(["2026-08-09", "2026-08-20"]);
  });
});

describe("normalizeQuestStreakReminderOpPatch", () => {
  it("accepts a valid setLapseReminderEnabled op", () => {
    expect(normalizeQuestStreakReminderOpPatch({ setLapseReminderEnabled: true })).toEqual({
      valid: { setLapseReminderEnabled: true },
      errors: [],
    });
  });

  it("returns no valid op and no errors when the field is absent", () => {
    expect(normalizeQuestStreakReminderOpPatch({ debateStyle: 1 })).toEqual({ valid: {}, errors: [] });
  });

  it("rejects a non-boolean value", () => {
    const result = normalizeQuestStreakReminderOpPatch({ setLapseReminderEnabled: "yes" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object request body", () => {
    const result = normalizeQuestStreakReminderOpPatch("not an object");
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });
});

describe("applyQuestStreakReminderOp", () => {
  it("replaces lapseReminderEnabled while leaving freezeDayKeys untouched", () => {
    const current = { lapseReminderEnabled: false, freezeDayKeys: ["2026-08-09"] };
    expect(applyQuestStreakReminderOp(current, { setLapseReminderEnabled: true })).toEqual({
      lapseReminderEnabled: true,
      freezeDayKeys: ["2026-08-09"],
    });
  });

  it("builds a fresh payload with an empty freezeDayKeys when nothing is stored yet", () => {
    expect(applyQuestStreakReminderOp(null, { setLapseReminderEnabled: true })).toEqual({
      lapseReminderEnabled: true,
      freezeDayKeys: [],
    });
  });

  it("never drops a freeze spent on another device just because the reminder is toggled here", () => {
    // The exact race this op closes: device A spends a freeze, device B
    // (whose local copy never had that freeze) toggles its reminder next —
    // the toggle must not revert to B's stale, freeze-less view.
    const afterDeviceASpentAFreeze = { lapseReminderEnabled: false, freezeDayKeys: ["2026-09-15"] };
    const afterDeviceBToggles = applyQuestStreakReminderOp(afterDeviceASpentAFreeze, {
      setLapseReminderEnabled: true,
    });
    expect(afterDeviceBToggles.freezeDayKeys).toEqual(["2026-09-15"]);
  });
});

describe("normalizeQuestStreakMissionResultOpPatch", () => {
  it("accepts a valid recordMissionResultDay op", () => {
    expect(
      normalizeQuestStreakMissionResultOpPatch({ recordMissionResultDay: { dayKey: "2026-08-09", isComplete: true } }),
    ).toEqual({
      valid: { recordMissionResultDay: { dayKey: "2026-08-09", isComplete: true } },
      errors: [],
    });
  });

  it("returns no valid op and no errors when the field is absent", () => {
    expect(normalizeQuestStreakMissionResultOpPatch({ debateStyle: 1 })).toEqual({ valid: {}, errors: [] });
  });

  it("rejects a malformed day key", () => {
    const result = normalizeQuestStreakMissionResultOpPatch({
      recordMissionResultDay: { dayKey: "not-a-day", isComplete: true },
    });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-boolean isComplete", () => {
    const result = normalizeQuestStreakMissionResultOpPatch({
      recordMissionResultDay: { dayKey: "2026-08-09", isComplete: "yes" },
    });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object recordMissionResultDay value", () => {
    const result = normalizeQuestStreakMissionResultOpPatch({ recordMissionResultDay: "2026-08-09" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object request body", () => {
    const result = normalizeQuestStreakMissionResultOpPatch("not an object");
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });
});

describe("applyQuestStreakMissionResultOp", () => {
  it("appends a new day to an existing payload", () => {
    const current = { lapseReminderEnabled: true, freezeDayKeys: [], missionResultDays: [{ dayKey: "2026-08-09", isComplete: true }] };
    expect(
      applyQuestStreakMissionResultOp(current, { recordMissionResultDay: { dayKey: "2026-08-10", isComplete: false } }),
    ).toEqual({
      lapseReminderEnabled: true,
      freezeDayKeys: [],
      missionResultDays: [
        { dayKey: "2026-08-09", isComplete: true },
        { dayKey: "2026-08-10", isComplete: false },
      ],
    });
  });

  it("builds a fresh payload (opted-out default) when nothing is stored yet", () => {
    expect(
      applyQuestStreakMissionResultOp(null, { recordMissionResultDay: { dayKey: "2026-08-09", isComplete: true } }),
    ).toEqual({
      lapseReminderEnabled: false,
      freezeDayKeys: [],
      missionResultDays: [{ dayKey: "2026-08-09", isComplete: true }],
    });
  });

  it("upserts an existing day's isComplete rather than duplicating it", () => {
    const current = {
      lapseReminderEnabled: false,
      freezeDayKeys: [],
      missionResultDays: [{ dayKey: "2026-08-09", isComplete: false }],
    };
    expect(
      applyQuestStreakMissionResultOp(current, { recordMissionResultDay: { dayKey: "2026-08-09", isComplete: true } }),
    ).toEqual({
      lapseReminderEnabled: false,
      freezeDayKeys: [],
      missionResultDays: [{ dayKey: "2026-08-09", isComplete: true }],
    });
  });

  it("leaves lapseReminderEnabled and freezeDayKeys untouched", () => {
    const current = { lapseReminderEnabled: true, freezeDayKeys: ["2026-08-01"], missionResultDays: [] };
    const result = applyQuestStreakMissionResultOp(current, {
      recordMissionResultDay: { dayKey: "2026-08-09", isComplete: true },
    });
    expect(result.lapseReminderEnabled).toBe(true);
    expect(result.freezeDayKeys).toEqual(["2026-08-01"]);
  });

  it("returns the same reference when the day is already recorded with the same isComplete value", () => {
    const current = {
      lapseReminderEnabled: false,
      freezeDayKeys: [],
      missionResultDays: [{ dayKey: "2026-08-09", isComplete: true }],
    };
    expect(
      applyQuestStreakMissionResultOp(current, { recordMissionResultDay: { dayKey: "2026-08-09", isComplete: true } }),
    ).toBe(current);
  });

  it("returns the same reference for an invalid day key", () => {
    const current = { lapseReminderEnabled: false, freezeDayKeys: [], missionResultDays: [] };
    expect(
      applyQuestStreakMissionResultOp(current, { recordMissionResultDay: { dayKey: "not-a-day", isComplete: true } }),
    ).toBe(current);
  });

  it("silently drops a new day once missionResultDays is at MAX_QUEST_STREAK_MISSION_RESULT_DAYS", () => {
    const missionResultDays = Array.from(
      { length: MAX_QUEST_STREAK_MISSION_RESULT_DAYS },
      (_, i) => ({ dayKey: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, isComplete: true }),
    );
    const current = { lapseReminderEnabled: false, freezeDayKeys: [], missionResultDays };
    expect(
      applyQuestStreakMissionResultOp(current, { recordMissionResultDay: { dayKey: "2027-01-01", isComplete: true } }),
    ).toBe(current);
  });

  it("still upserts an already-recorded day's isComplete even once at capacity", () => {
    const missionResultDays = Array.from(
      { length: MAX_QUEST_STREAK_MISSION_RESULT_DAYS },
      (_, i) => ({ dayKey: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, isComplete: false }),
    );
    const current = { lapseReminderEnabled: false, freezeDayKeys: [], missionResultDays };
    const result = applyQuestStreakMissionResultOp(current, {
      recordMissionResultDay: { dayKey: missionResultDays[0].dayKey, isComplete: true },
    });
    expect(result.missionResultDays).toHaveLength(MAX_QUEST_STREAK_MISSION_RESULT_DAYS);
    expect(result.missionResultDays?.[0]).toEqual({ dayKey: missionResultDays[0].dayKey, isComplete: true });
  });
});
