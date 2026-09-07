import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedSprintSessionFromAccount,
  listSavedSprintSessions,
  saveSprintSessionToAccount,
} from "../src/lib/sprint-sessions-client";
import type { SprintSession } from "../src/lib/team-collaboration-mode";

const SESSION: SprintSession = {
  id: "session-1",
  topic: "solvency",
  title: "Kickoff — divide up cards",
  scheduledDayKey: "2026-09-10",
  createdAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSavedSprintSessions", () => {
  it("GETs the endpoint and returns the parsed session list", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [SESSION],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSavedSprintSessions();

    expect(result).toEqual([SESSION]);
    expect(fetchMock).toHaveBeenCalledWith("/api/sprint-sessions");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await listSavedSprintSessions()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedSprintSessions()).rejects.toThrow("Something broke.");
  });
});

describe("saveSprintSessionToAccount", () => {
  it("PUTs to the session's id-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveSprintSessionToAccount(SESSION);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/sprint-sessions/session-1");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ session: SESSION });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid session." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveSprintSessionToAccount(SESSION)).rejects.toThrow("Invalid session.");
  });
});

describe("deleteSavedSprintSessionFromAccount", () => {
  it("DELETEs the session's id-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteSavedSprintSessionFromAccount(SESSION.id);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/sprint-sessions/session-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to remove." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteSavedSprintSessionFromAccount(SESSION.id)).rejects.toThrow("Failed to remove.");
  });
});
