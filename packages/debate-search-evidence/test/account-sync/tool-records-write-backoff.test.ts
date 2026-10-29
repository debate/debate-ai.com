/**
 * @fileoverview Covers the write pause in `state/tool-records-client.ts`: one
 * server error is retried at once, but a collection whose writes keep failing
 * stops sending requests for a while instead of re-hitting a broken route on
 * every auto-sync tick.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ToolRecordSyncError,
  WRITE_BACKOFF_MS,
  WRITE_FAILURES_BEFORE_BACKOFF,
  resetToolRecordWriteBackoff,
  saveToolRecordsToAccount,
} from "../../src/account-sync/tool-records-client";

let statuses: number[];
let calls: number;

beforeEach(() => {
  vi.useFakeTimers();
  resetToolRecordWriteBackoff();
  calls = 0;
  statuses = [];
  vi.stubGlobal("fetch", async () => {
    calls += 1;
    const status = statuses.shift() ?? 200;
    return new Response(JSON.stringify(status === 200 ? { ok: true } : { error: "nope" }), { status });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetToolRecordWriteBackoff();
});

const push = () => saveToolRecordsToAccount("debateVideoWatchHistory", [{ videoId: "a" }]);

describe("tool-record write backoff", () => {
  it("keeps retrying immediately below the threshold", async () => {
    statuses = Array(WRITE_FAILURES_BEFORE_BACKOFF - 1).fill(500);
    for (let i = 0; i < WRITE_FAILURES_BEFORE_BACKOFF - 1; i++) await expect(push()).rejects.toThrow();
    await expect(push()).resolves.toBeUndefined();
    expect(calls).toBe(WRITE_FAILURES_BEFORE_BACKOFF);
  });

  it("pauses a collection after repeated server errors, then resumes", async () => {
    statuses = Array(WRITE_FAILURES_BEFORE_BACKOFF).fill(500);
    for (let i = 0; i < WRITE_FAILURES_BEFORE_BACKOFF; i++) await expect(push()).rejects.toThrow();
    expect(calls).toBe(WRITE_FAILURES_BEFORE_BACKOFF);

    const paused = await push().catch((error: unknown) => error);
    expect(paused).toBeInstanceOf(ToolRecordSyncError);
    expect((paused as ToolRecordSyncError).status).toBe(503);
    expect(calls).toBe(WRITE_FAILURES_BEFORE_BACKOFF);

    // Other collections are unaffected.
    await saveToolRecordsToAccount("flowAnnotations", [{ id: "x" }]);
    expect(calls).toBe(WRITE_FAILURES_BEFORE_BACKOFF + 1);

    vi.advanceTimersByTime(WRITE_BACKOFF_MS);
    await expect(push()).resolves.toBeUndefined();
    // A success clears the streak entirely.
    statuses = [500];
    await expect(push()).rejects.toThrow();
    await expect(push()).resolves.toBeUndefined();
  });

  it("does not count client errors toward the pause", async () => {
    statuses = Array(WRITE_FAILURES_BEFORE_BACKOFF + 1).fill(413);
    for (let i = 0; i <= WRITE_FAILURES_BEFORE_BACKOFF; i++) await expect(push()).rejects.toThrow();
    expect(calls).toBe(WRITE_FAILURES_BEFORE_BACKOFF + 1);
  });
});
