import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC,
  isValidBrainstormSessionTimerSyncPayload,
  MAX_BRAINSTORM_SESSION_TIMER_SECONDS,
  normalizeBrainstormSessionTimerPatch,
  parseBrainstormSessionTimer,
  serializeBrainstormSessionTimer,
} from "../src/lib/brainstorm-session-timer-sync";

const IDLE = { durationSeconds: 300, status: "idle" as const, endsAt: null, remainingSecondsWhenPaused: null };
const RUNNING = { durationSeconds: 300, status: "running" as const, endsAt: 1_700_000_300_000, remainingSecondsWhenPaused: null };
const PAUSED = { durationSeconds: 300, status: "paused" as const, endsAt: null, remainingSecondsWhenPaused: 120 };

describe("DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC", () => {
  it("defaults to no synced timer", () => {
    expect(DEFAULT_BRAINSTORM_SESSION_TIMER_SYNC).toEqual({ brainstormSessionTimer: null });
  });
});

describe("isValidBrainstormSessionTimerSyncPayload", () => {
  it("accepts a well-formed idle timer", () => {
    expect(isValidBrainstormSessionTimerSyncPayload(IDLE)).toBe(true);
  });

  it("accepts a well-formed running timer", () => {
    expect(isValidBrainstormSessionTimerSyncPayload(RUNNING)).toBe(true);
  });

  it("accepts a well-formed paused timer", () => {
    expect(isValidBrainstormSessionTimerSyncPayload(PAUSED)).toBe(true);
  });

  it("accepts a duration exactly at the max", () => {
    expect(
      isValidBrainstormSessionTimerSyncPayload({ ...IDLE, durationSeconds: MAX_BRAINSTORM_SESSION_TIMER_SECONDS }),
    ).toBe(true);
  });

  it("rejects a duration exceeding the max", () => {
    expect(
      isValidBrainstormSessionTimerSyncPayload({
        ...IDLE,
        durationSeconds: MAX_BRAINSTORM_SESSION_TIMER_SECONDS + 1,
      }),
    ).toBe(false);
  });

  it("rejects a zero or negative duration", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE, durationSeconds: 0 })).toBe(false);
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE, durationSeconds: -5 })).toBe(false);
  });

  it("rejects a non-integer duration", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE, durationSeconds: 2.5 })).toBe(false);
  });

  it("rejects an unrecognized status", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE, status: "stopped" })).toBe(false);
  });

  it("rejects a running timer missing endsAt", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...RUNNING, endsAt: null })).toBe(false);
  });

  it("rejects a running timer that also carries remainingSecondsWhenPaused", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...RUNNING, remainingSecondsWhenPaused: 30 })).toBe(false);
  });

  it("rejects a paused timer missing remainingSecondsWhenPaused", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...PAUSED, remainingSecondsWhenPaused: null })).toBe(false);
  });

  it("rejects a paused timer that also carries endsAt", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...PAUSED, endsAt: 1_700_000_000_000 })).toBe(false);
  });

  it("rejects an idle timer with a stale endsAt", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE, endsAt: 1_700_000_000_000 })).toBe(false);
  });

  it("rejects an idle timer with a stale remainingSecondsWhenPaused", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE, remainingSecondsWhenPaused: 30 })).toBe(false);
  });

  it("rejects an unrecognized field", () => {
    expect(isValidBrainstormSessionTimerSyncPayload({ ...IDLE, contributorId: "someone-else" })).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isValidBrainstormSessionTimerSyncPayload(null)).toBe(false);
    expect(isValidBrainstormSessionTimerSyncPayload("timer")).toBe(false);
    expect(isValidBrainstormSessionTimerSyncPayload([IDLE])).toBe(false);
  });
});

describe("normalizeBrainstormSessionTimerPatch", () => {
  it("accepts null as a clear instruction", () => {
    const result = normalizeBrainstormSessionTimerPatch({ brainstormSessionTimer: null });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ brainstormSessionTimer: null });
  });

  it("accepts a well-formed timer", () => {
    const result = normalizeBrainstormSessionTimerPatch({ brainstormSessionTimer: RUNNING });
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual({ brainstormSessionTimer: RUNNING });
  });

  it("rejects a malformed timer with an error message and leaves valid empty", () => {
    const result = normalizeBrainstormSessionTimerPatch({ brainstormSessionTimer: { ...IDLE, status: "bogus" } });
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
    expect(parseBrainstormSessionTimer(serializeBrainstormSessionTimer(RUNNING))).toEqual(RUNNING);
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
    expect(parseBrainstormSessionTimer(JSON.stringify({ ...IDLE, status: "bogus" }))).toBeNull();
  });
});
