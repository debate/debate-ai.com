// @vitest-environment jsdom
/**
 * @fileoverview Tests for `hooks/useQuestStreakSync.ts` — the mount-time
 * merge of a contributor's account-synced streak freezes, reminder opt-in
 * and mission-result days into the local stores, and the best-effort push
 * helpers that are no-ops until the account fetch has succeeded.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import { useQuestStreakSync, type UseQuestStreakSyncResult } from "../src/hooks/useQuestStreakSync";
import { listStreakFreezeDayKeysForContributor } from "../src/state/streakFreezes";
import { isStreakLapseReminderEnabled } from "../src/state/streakLapseReminders";
import { listDailyMissionResultsForContributor } from "../src/state/dailyMissionResults";
import { flush, mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: UseQuestStreakSyncResult;
function Harness({ contributorId, onMerged }: { contributorId?: string; onMerged?: () => void }) {
  latest = useQuestStreakSync(contributorId, onMerged);
  return null;
}

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;
let fetchMock: FetchMock;
let view: Mounted;

function respondWith(get: () => Response) {
  fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "PUT" ? new Response("{}", { status: 200 }) : get(),
  );
  vi.stubGlobal("fetch", fetchMock);
}

const putBodies = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT").map(([, init]) => JSON.parse(String(init?.body)));

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useQuestStreakSync", () => {
  it("is immediately loaded with no fetch and no-op pushes when no contributor is given", async () => {
    respondWith(() => new Response("{}"));
    view = await mount(createElement(Harness, {}));
    expect(latest.loaded).toBe(true);
    latest.pushFreezeDayKey("2026-01-01");
    latest.pushLapseReminderEnabled(true);
    latest.pushMissionResultDay({ dayKey: "2026-01-01", isComplete: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("merges every remote field into the local stores and reports the merge", async () => {
    respondWith(
      () =>
        new Response(
          JSON.stringify({
            questStreakSync: {
              lapseReminderEnabled: true,
              freezeDayKeys: ["2026-01-05"],
              missionResultDays: [{ dayKey: "2026-01-04", isComplete: true }],
            },
          }),
        ),
    );
    const onMerged = vi.fn();
    view = await mount(createElement(Harness, { contributorId: "alice", onMerged }));
    await flush(async () => {});

    expect(latest.loaded).toBe(true);
    expect(onMerged).toHaveBeenCalledTimes(1);
    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual(["2026-01-05"]);
    expect(isStreakLapseReminderEnabled("alice")).toBe(true);
    expect(listDailyMissionResultsForContributor("alice").map((r) => r.dayKey)).toEqual(["2026-01-04"]);

    // Remote is now known to be available, so pushes go out.
    latest.pushFreezeDayKey("2026-01-06");
    latest.pushLapseReminderEnabled(false);
    latest.pushMissionResultDay({ dayKey: "2026-01-06", isComplete: false });
    await flush(async () => {});
    expect(putBodies()).toEqual([
      { recordStreakFreezeDayKey: "2026-01-06" },
      { setLapseReminderEnabled: false },
      { recordMissionResultDay: { dayKey: "2026-01-06", isComplete: false } },
    ]);
  });

  it("doesn't call onMerged when the remote payload adds nothing new", async () => {
    respondWith(
      () => new Response(JSON.stringify({ questStreakSync: { lapseReminderEnabled: false, freezeDayKeys: [] } })),
    );
    const onMerged = vi.fn();
    view = await mount(createElement(Harness, { contributorId: "bob", onMerged }));
    await flush(async () => {});
    expect(latest.loaded).toBe(true);
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("treats an account with no stored payload as available but merges nothing", async () => {
    respondWith(() => new Response(JSON.stringify({})));
    const onMerged = vi.fn();
    view = await mount(createElement(Harness, { contributorId: "carol", onMerged }));
    await flush(async () => {});
    expect(onMerged).not.toHaveBeenCalled();
    latest.pushFreezeDayKey("2026-01-07");
    await flush(async () => {});
    expect(putBodies()).toEqual([{ recordStreakFreezeDayKey: "2026-01-07" }]);
  });

  it("stays local-only when signed out", async () => {
    respondWith(() => new Response(null, { status: 401 }));
    view = await mount(createElement(Harness, { contributorId: "dan" }));
    await flush(async () => {});
    expect(latest.loaded).toBe(true);
    latest.pushFreezeDayKey("2026-01-08");
    latest.pushLapseReminderEnabled(true);
    latest.pushMissionResultDay({ dayKey: "2026-01-08", isComplete: true });
    await flush(async () => {});
    expect(putBodies()).toEqual([]);
  });

  it("still finishes loading when the account fetch fails", async () => {
    respondWith(() => new Response(JSON.stringify({ error: "boom" }), { status: 500 }));
    view = await mount(createElement(Harness, { contributorId: "erin" }));
    await flush(async () => {});
    expect(latest.loaded).toBe(true);
    latest.pushFreezeDayKey("2026-01-09");
    await flush(async () => {});
    expect(putBodies()).toEqual([]);
  });

  it("swallows a failed push", async () => {
    fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "PUT"
        ? new Response(JSON.stringify({ error: "nope" }), { status: 500 })
        : new Response(JSON.stringify({})),
    );
    vi.stubGlobal("fetch", fetchMock);
    view = await mount(createElement(Harness, { contributorId: "gil" }));
    await flush(async () => {});
    latest.pushFreezeDayKey("2026-01-10");
    latest.pushLapseReminderEnabled(true);
    latest.pushMissionResultDay({ dayKey: "2026-01-10", isComplete: true });
    await flush(async () => {});
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(3);
  });

  it("ignores a fetch that resolves after the contributor changed", async () => {
    let resolveFirst: (response: Response) => void = () => {};
    fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "PUT"
          ? Promise.resolve(new Response("{}"))
          : fetchMock.mock.calls.length === 1
            ? new Promise<Response>((resolve) => {
                resolveFirst = resolve;
              })
            : Promise.resolve(new Response(null, { status: 401 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onMerged = vi.fn();
    view = await mount(createElement(Harness, { contributorId: "first", onMerged }));
    await view.rerender(createElement(Harness, { contributorId: "second", onMerged }));
    await flush(async () => {
      resolveFirst(
        new Response(JSON.stringify({ questStreakSync: { lapseReminderEnabled: true, freezeDayKeys: ["2026-01-01"] } })),
      );
    });
    await flush(async () => {});
    expect(onMerged).not.toHaveBeenCalled();
    expect(listStreakFreezeDayKeysForContributor("first")).toEqual([]);
    expect(latest.loaded).toBe(true);
  });
});
