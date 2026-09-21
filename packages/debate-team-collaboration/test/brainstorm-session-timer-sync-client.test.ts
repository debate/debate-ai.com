import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBrainstormSessionTimer, saveBrainstormSessionTimer } from "../src/lib/brainstorm-session-timer-sync-client";
import type { BrainstormSessionTimerSyncPayload } from "../src/lib/brainstorm-session-timer-sync";

const TIMER: BrainstormSessionTimerSyncPayload = {
  durationSeconds: 300,
  status: "running",
  endsAt: 1_700_000_300_000,
  remainingSecondsWhenPaused: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchBrainstormSessionTimer", () => {
  it("GETs /api/settings and returns the parsed timer", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ brainstormSessionTimer: TIMER }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBrainstormSessionTimer();

    expect(result).toEqual({ timer: TIMER });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/settings");
  });

  it("fetches from a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await fetchBrainstormSessionTimer("/custom-endpoint");

    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/custom-endpoint");
  });

  it("resolves to { timer: null } when signed in with nothing synced yet", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchBrainstormSessionTimer()).toEqual({ timer: null });
  });

  it("returns null (not a rejection) when signed out", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to load your account settings." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchBrainstormSessionTimer()).toBeNull();
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid JSON body." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchBrainstormSessionTimer()).rejects.toThrow("Invalid JSON body.");
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchBrainstormSessionTimer()).rejects.toThrow("Failed to load account settings.");
  });
});

describe("saveBrainstormSessionTimer", () => {
  it("PUTs the timer as JSON to /api/settings", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveBrainstormSessionTimer(TIMER);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/settings");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ brainstormSessionTimer: TIMER });
  });

  it("sends null to clear the synced timer", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveBrainstormSessionTimer(null);

    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ brainstormSessionTimer: null });
  });

  it("saves to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveBrainstormSessionTimer(TIMER, "/custom-endpoint");

    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: '"brainstormSessionTimer" must be null (to clear) or a valid timer object.',
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveBrainstormSessionTimer(TIMER)).rejects.toThrow(
      '"brainstormSessionTimer" must be null (to clear) or a valid timer object.',
    );
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveBrainstormSessionTimer(TIMER)).rejects.toThrow("Failed to save account settings.");
  });
});
