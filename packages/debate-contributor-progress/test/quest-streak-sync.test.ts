import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUEST_STREAK_SYNC,
  isValidQuestStreakSyncPayload,
  MAX_QUEST_STREAK_FREEZE_DAY_KEYS,
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
});
