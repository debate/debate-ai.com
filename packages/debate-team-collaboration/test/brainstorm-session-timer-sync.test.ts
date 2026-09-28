import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC,
  isValidBrainstormSessionTimerSyncPayload,
  MAX_BRAINSTORM_SESSION_TIMER_SECONDS,
  normalizeBrainstormSessionTimerPatch,
  parseBrainstormSessionTimer,
  serializeBrainstormSessionTimer,
} from "../src/lib/brainstorm-session-timer-sync";

const IDLE_TIMER = { durationSeconds: 300, status: "idle" as const, endsAt: null, remainingSecondsWhenPaused: null };
const RUNNING_TIMER = {
  durationSeconds: 300,
  status: "running" as const,
  endsAt: 1_700_000_300_000,
  remainingSecondsWhenPaused: null,
};
const PAUSED_TIMER = {
  durationSeconds: 300,
  status: "paused" as const,
  endsAt: null,
  remainingSecondsWhenPaused: 120,
};

describe("DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC", () => {
  it("defaults to no synced timer", () => {
    expect(DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC).toEqual({ brainstormSessionTimer: null });
  });
});

describe("isValidBrainstormSessionTimerSyncPayload", () => {
  it("accepts an idle timer", () => {
    expect(isValidBrainstormSessionTimerSyncPayload(IDLE_TIMER)).toBe(true);
  });

  it("accepts a running timer", () => {
    expect(isValidBrainstormSessionTimerSyncPayload(RUNNING_TIMER)).toBe(true);
  });

  it("accepts a paused timer", () => {
    expect(isValidBrainstormSessionTimerSyncPayload(PAUSED_TIMER)).toBe(true);
  });

  it("accepts a duration exactly at the max", () => {
    expect(
      isValidBrainstormSessionTimerSyncPayload({
        durationSeconds: MAX_BRAINSTORM_SESSION_TIMER_SECONDS,
        status: "idle",
        endsAt: null,
        remainingSecondsWhenPaused: null,
      }),
    ).toBe(true);
  });

  it("rejects a duration exceeding the max", () => {
    expect(
      isValidBrainstormSessionTimerSyncPayload({
        durationSeconds: MAX_BRAINSTORM_SESSION_TIMER_SECONDS + 1,
        status: "idle",
        endsAt: null,
        remainingSecondsWhenPaused: null,
      }),
    ).toBe(false);
  });

  it("rejects a negative duration", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE_TIMER, durationSeconds: -1 })).toBe(false);
  });

  it("rejects a non-integer/NaN duration", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE_TIMER, durationSeconds: Number.NaN })).toBe(false);
  });

  it("rejects an unrecognized status", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE_TIMER, status: "stopped" })).toBe(false);
  });

  it("rejects a negative endsAt", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...RUNNING_TIMER, endsAt: -1 })).toBe(false);
  });

  it("rejects a negative remainingSecondsWhenPaused", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...PAUSED_TIMER, remainingSecondsWhenPaused: -1 })).toBe(false);
  });

  it("rejects a missing field", () => {
    const { status: _status, ...withoutStatus } = IDLE_TIMER;
    expect(isValidBrainstormSessionTimerSyncPayload(withoutStatus)).toBe(false);
  });

  it("rejects an unrecognized field, e.g. a smuggled userId", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE_TIMER, userId: "someone-else" })).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isValidBrainstormSessionTimerSyncPayload(null)).toBe(false);
    expect(isValidBrainstormSessionTimerSyncPayload("timer")).toBe(false);
    expect(isValidBrainstormSessionTimerSyncPayload([IDLE_TIMER])).toBe(false);
  });
});

describe("normalizeBrainstormSessionTimerPatch", () => {
  it("accepts null as a clear instruction", () => {
    const result = normalizeBrainstormSessionTimerPatch({ brainstormSessionTimer: null });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ brainstormSessionTimer: null });
  });

  it("accepts a well-formed timer", () => {
    const result = normalizeBrainstormSessionTimerPatch({ brainstormSessionTimer: RUNNING_TIMER });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ brainstormSessionTimer: RUNNING_TIMER });
  });

  it("rejects a malformed timer with an error message and leaves valid empty", () => {
    const result = normalizeBrainstormSessionTimerPatch({
      brainstormSessionTimer: { ...IDLE_TIMER, status: "stopped" },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.valid).toEqual({});
  });

  it("omits the field entirely when absent from the input", () => {
    const result = normalizeBrainstormSessionTimerPatch({ debateStyle: 1 });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({});
  });

  it("rejects a non-object request body", () => {
    const result = normalizeBrainstormSessionTimerPatch("not an object");
    expect(result.errors).toHaveLength(1);
    expect(result.valid).toEqual({});
  });
});

describe("serializeBrainstormSessionTimer / parseBrainstormSessionTimer", () => {
  it("round-trips a timer", () => {
    expect(parseBrainstormSessionTimer(serializeBrainstormSessionTimer(PAUSED_TIMER))).toEqual(PAUSED_TIMER);
  });

  it("serializes null to null and parses null/empty back to null", () => {
    expect(serializeBrainstormSessionTimer(null)).toBeNull();
    expect(parseBrainstormSessionTimer(null)).toBeNull();
    expect(parseBrainstormSessionTimer(undefined)).toBeNull();
    expect(parseBrainstormSessionTimer("")).toBeNull();
  });

  it("parses corrupt JSON back to null rather than throwing", () => {
    expect(parseBrainstormSessionTimer("{not json")).toBeNull();
  });

  it("parses a stored value that fails validation back to null", () => {
    expect(parseBrainstormSessionTimer(JSON.stringify({ ...IDLE_TIMER, status: "stopped" }))).toBeNull();
  });
});
