/**
 * @fileoverview Tests for `lib/quest-streak-sync-client.ts` — the thin
 * `fetch` wrappers over `/api/settings` that `useQuestStreakSync` uses to
 * load and push a contributor's streak freezes, reminder opt-in and mission
 * results. `fetch` is stubbed per test; no network is touched.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchQuestStreakSync,
  saveLapseReminderEnabledOp,
  saveMissionResultDayOp,
  saveQuestStreakSync,
  saveStreakFreezeDayKeyOp,
} from "../src/lib/quest-streak-sync-client";

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchQuestStreakSync", () => {
  it("returns null when signed out", async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 401 }));
    await expect(fetchQuestStreakSync()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/settings");
  });

  it("returns the stored payload, or null when the account has none", async () => {
    const payload = { lapseReminderEnabled: true, freezeDayKeys: ["2026-01-02"] };
    stubFetch(() => json({ questStreakSync: payload, theme: "dark" }));
    await expect(fetchQuestStreakSync("/custom")).resolves.toEqual({ questStreakSync: payload });

    stubFetch(() => json({ theme: "dark" }));
    await expect(fetchQuestStreakSync()).resolves.toEqual({ questStreakSync: null });
  });

  it("throws the server's error message, or a fallback when the body isn't JSON", async () => {
    stubFetch(() => json({ error: "Database unavailable" }, 500));
    await expect(fetchQuestStreakSync()).rejects.toThrow("Database unavailable");

    stubFetch(() => new Response("oops", { status: 500 }));
    await expect(fetchQuestStreakSync()).rejects.toThrow("Failed to load account settings.");

    stubFetch(() => json({}, 503));
    await expect(fetchQuestStreakSync()).rejects.toThrow("Failed to load account settings.");
  });
});

describe("PUT helpers", () => {
  const cases: [string, () => Promise<void>, unknown][] = [
    [
      "saveQuestStreakSync",
      () => saveQuestStreakSync({ lapseReminderEnabled: false, freezeDayKeys: [] }),
      { questStreakSync: { lapseReminderEnabled: false, freezeDayKeys: [] } },
    ],
    ["saveStreakFreezeDayKeyOp", () => saveStreakFreezeDayKeyOp("2026-02-03"), { recordStreakFreezeDayKey: "2026-02-03" }],
    ["saveLapseReminderEnabledOp", () => saveLapseReminderEnabledOp(true), { setLapseReminderEnabled: true }],
    [
      "saveMissionResultDayOp",
      () => saveMissionResultDayOp({ dayKey: "2026-02-04", isComplete: true }),
      { recordMissionResultDay: { dayKey: "2026-02-04", isComplete: true } },
    ],
  ];

  it.each(cases)("%s PUTs its JSON body to /api/settings", async (_name, call, body) => {
    const fetchMock = stubFetch(() => json({ ok: true }));
    await call();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/settings");
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });

  it.each(cases)("%s surfaces the server error, falling back to a generic message", async (_name, call) => {
    stubFetch(() => json({ error: "Nope" }, 400));
    await expect(call()).rejects.toThrow("Nope");
    stubFetch(() => new Response("not json", { status: 500 }));
    await expect(call()).rejects.toThrow("Failed to save account settings.");
  });

  it("saveQuestStreakSync accepts a custom endpoint and a null payload", async () => {
    const fetchMock = stubFetch(() => json({}));
    await saveQuestStreakSync(null, "/elsewhere");
    expect(fetchMock.mock.calls[0][0]).toBe("/elsewhere");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ questStreakSync: null });
  });
});
