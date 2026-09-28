import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBrainstormSessionTimer,
  saveBrainstormSessionTimer,
} from "../src/lib/brainstorm-session-timer-sync-client";

const RUNNING_TIMER = {
  durationSeconds: 300,
  status: "running" as const,
  endsAt: 1_700_000_300_000,
  remainingSecondsWhenPaused: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchBrainstormSessionTimer", () => {
  it("returns the synced timer from a successful response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ brainstormSessionTimer: RUNNING_TIMER }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchBrainstormSessionTimer()).toEqual({ timer: RUNNING_TIMER });
  });

  it("returns { timer: null } when the field is absent from the response", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchBrainstormSessionTimer()).toEqual({ timer: null });
  });

  it("returns null when signed out (401)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchBrainstormSessionTimer()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchBrainstormSessionTimer()).rejects.toThrow("boom");
  });
});

describe("saveBrainstormSessionTimer", () => {
  it("PUTs the timer state to the endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveBrainstormSessionTimer(RUNNING_TIMER);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/settings");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ brainstormSessionTimer: RUNNING_TIMER });
  });

  it("PUTs null to clear the synced timer", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveBrainstormSessionTimer(null);

    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ brainstormSessionTimer: null });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "nope" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveBrainstormSessionTimer(RUNNING_TIMER)).rejects.toThrow("nope");
  });
});
