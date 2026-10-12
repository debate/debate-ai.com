// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `QuestStreaksPanel` — the streak roster,
 * the "Run check" mission recorder, the streak-freeze ("grace day") action,
 * the lapse-reminder toggle, and the signed-in contributor's account sync
 * (the hook's `/api/settings` calls are served by a stubbed `fetch`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC } from "react";

import { QuestStreaksPanel } from "../src/panels/QuestStreaksPanel";
import {
  listDailyMissionResultsForContributor,
  saveDailyMissionResult,
} from "../src/state/dailyMissionResults";
import { listStreakFreezeDayKeysForContributor } from "../src/state/streakFreezes";
import { isStreakLapseReminderEnabled } from "../src/state/streakLapseReminders";
import { saveQuestTemplate } from "@debate/team-collaboration/src/state/dailyQuests";
import { saveContribution } from "@debate/research-evidence/src/state/contributions";
import type { AttributedContribution } from "@debate/research-evidence/src/lib/contribution-leaderboard";
import { buttonByText, buttonsByText, click, flush, mount, query, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The panel with its optional props spelled out, so `createElement` can type-check them. */
const Panel = QuestStreaksPanel as FC<NonNullable<Parameters<typeof QuestStreaksPanel>[0]>>;

const NOW = new Date("2026-03-10T12:00:00Z");

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;
let fetchMock: FetchMock;
let view: Mounted;
const text = () => view.container.textContent ?? "";

function complete(contributorId: string, ...dayKeys: string[]) {
  for (const dayKey of dayKeys) saveDailyMissionResult({ contributorId, dayKey, isComplete: true });
}

function rowFor(contributorId: string): HTMLTableRowElement {
  const row = Array.from(view.container.querySelectorAll("tbody tr")).find(
    (tr) => tr.querySelector("td")?.textContent?.startsWith(contributorId),
  );
  if (!row) throw new Error(`No row for ${contributorId}`);
  return row as HTMLTableRowElement;
}

const putBodies = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT").map(([, init]) => JSON.parse(String(init?.body)));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "PUT" ? new Response("{}") : new Response(null, { status: 401 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("QuestStreaksPanel", () => {
  it("shows the empty state and requires a contributor id to run a check", async () => {
    view = await mount(createElement(Panel));
    expect(text()).toContain("No streaks yet.");
    await click(buttonByText(view.container, "Run check"));
    expect(text()).toContain("Contributor id is required.");
  });

  it("runs today's mission check and adds the contributor to the roster", async () => {
    saveQuestTemplate({ id: "q1", description: "One card", target: { kind: "card" }, targetCount: 1 });
    saveContribution({
      id: "c1",
      contributorId: "alice",
      kind: "card",
      likes: 0,
      saves: 0,
      qualitySignals: [],
      reviewerEndorsements: [],
      submittedAt: NOW.getTime(),
    } as AttributedContribution & { submittedAt: number });
    view = await mount(createElement(Panel));

    await type(query<HTMLInputElement>(view.container, "#quest-streak-contributor"), " alice ");
    await click(buttonByText(view.container, "Run check"));

    expect(listDailyMissionResultsForContributor("alice")).toEqual([
      expect.objectContaining({ dayKey: "2026-03-10", isComplete: true }),
    ]);
    const row = rowFor("alice");
    expect(row.textContent).toContain("🔥 1");
    expect(row.textContent).toContain("2026-03-10");
    // Not signed in, so nothing is pushed to the account.
    expect(putBodies()).toEqual([]);
  });

  it("renders streaks, badges, freezes and the lapse reminder per row", async () => {
    complete("alice", "2026-03-07", "2026-03-08");
    complete("bob", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09");
    complete("eve", "2026-03-08", "2026-03-09", "2026-03-10");
    saveDailyMissionResult({ contributorId: "carol", dayKey: "2026-03-01", isComplete: false });
    view = await mount(createElement(Panel));

    const eve = rowFor("eve");
    expect(eve.textContent).toContain("🔥 3");
    expect(eve.textContent).toContain("3-Day Streak");
    expect(eve.textContent).toContain("2026-03-10");

    // Bob hasn't completed today, so his current streak shows "—" but his
    // longest (5) and last-completed day remain.
    const bobCells = Array.from(rowFor("bob").querySelectorAll("td")).map((td) => td.textContent);
    expect(bobCells.slice(1, 4)).toEqual(["—", "5", "2026-03-09"]);

    const carolCells = Array.from(rowFor("carol").querySelectorAll("td")).map((td) => td.textContent);
    expect(carolCells.slice(1, 5)).toEqual(["—", "0", "—", "—"]);

    // Alice missed yesterday after completing the day before: a grace day is offered.
    expect(rowFor("alice").textContent).toContain("2 streak freezes available");
    const freeze = buttonByText(rowFor("alice"), "Use a grace day for 2026-03-09");
    await click(freeze);
    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual(["2026-03-09"]);
    expect(rowFor("alice").textContent).toContain("1 streak freeze available");
    expect(buttonsByText(rowFor("alice"), "Use a grace day for 2026-03-09")).toHaveLength(0);

    // Bob's streak is at risk today; turning the reminder on shows the banner.
    await click(buttonByText(rowFor("bob"), "🔕 Remind me"));
    expect(isStreakLapseReminderEnabled("bob")).toBe(true);
    expect(rowFor("bob").textContent).toContain("⏰ Your 5-day streak will end today unless you complete today's quests!");
    await click(buttonByText(rowFor("bob"), "🔔 Reminder on"));
    expect(isStreakLapseReminderEnabled("bob")).toBe(false);
    expect(rowFor("bob").textContent).not.toContain("⏰");
  });

  it("reports a denied freeze when the gap was already frozen in another tab", async () => {
    complete("alice", "2026-03-07", "2026-03-08");
    view = await mount(createElement(Panel));
    const freeze = buttonByText(rowFor("alice"), "Use a grace day for 2026-03-09");

    // Another tab marks yesterday complete without a storage event reaching us.
    complete("alice", "2026-03-09");
    await click(freeze);
    expect(text()).toContain("alice: That day's mission was already completed.");
  });

  it("refreshes the roster on a watched storage event", async () => {
    view = await mount(createElement(Panel));
    complete("dana", "2026-03-10");
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    });
    expect(text()).toContain("No streaks yet.");
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(rowFor("dana").textContent).toContain("🔥 1");
  });

  it("highlights and syncs the signed-in contributor's own row", async () => {
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "PUT"
        ? new Response("{}")
        : new Response(
            JSON.stringify({
              questStreakSync: {
                lapseReminderEnabled: false,
                freezeDayKeys: [],
                missionResultDays: [
                  { dayKey: "2026-03-07", isComplete: true },
                  { dayKey: "2026-03-08", isComplete: true },
                ],
              },
            }),
          ),
    );
    complete("zed", "2026-03-08");
    view = await mount(createElement(Panel, { signedInContributorId: "me" }));
    await flush(async () => {});

    // The merged remote history put "me" on the roster.
    const me = rowFor("me");
    expect(me.textContent).toContain("You");
    expect(me.className).toContain("bg-primary/5");
    expect(rowFor("zed").textContent).not.toContain("You");

    await click(buttonByText(rowFor("me"), "Use a grace day for 2026-03-09"));
    await click(buttonByText(rowFor("me"), "🔕 Remind me"));
    await type(query<HTMLInputElement>(view.container, "#quest-streak-contributor"), "me");
    await click(buttonByText(view.container, "Run check"));
    // Another contributor's changes stay local-only.
    await click(buttonByText(rowFor("zed"), "🔕 Remind me"));
    await flush(async () => {});

    expect(putBodies()).toEqual([
      { recordStreakFreezeDayKey: "2026-03-09" },
      { setLapseReminderEnabled: true },
      { recordMissionResultDay: { dayKey: "2026-03-10", isComplete: false } },
    ]);
  });
});
