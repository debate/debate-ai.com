// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `DailyQuestsPanel` — the quest board, the
 * add-quest form, topic-coverage seeding/preview, the streak recorder, the
 * expired-quest cleanup, the difficulty filter and the team competition.
 * Drives the panel against the real localStorage-backed stores (no mocks),
 * with `Date` pinned so "today" and every `custom-${Date.now()}` id is
 * deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC } from "react";

import { DailyQuestsPanel } from "../src/panels/DailyQuestsPanel";
import { saveContribution } from "@debate/research-evidence/src/state/contributions";
import { saveTrackedArgument } from "@debate/research-evidence/src/state/trackedArguments";
import {
  listQuestTeams,
  listQuestTemplates,
  saveQuestTemplate,
} from "@debate/team-collaboration/src/state/dailyQuests";
import {
  buildPersistedContributorQuestStreak,
  listDailyMissionResultsForContributor,
  saveDailyMissionResult,
} from "../src/state/dailyMissionResults";
import { buildStreakRewardText } from "../src/lib/gamified-quests";
import type { AttributedContribution } from "@debate/research-evidence/src/lib/contribution-leaderboard";
import { buttonByText, buttonsByText, click, flush, mount, query, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

const NOW = new Date("2026-03-10T12:00:00Z");
const TODAY = "2026-03-10";

function submitted(id: string, contributorId: string, kind: AttributedContribution["kind"] = "card") {
  saveContribution({
    id,
    contributorId,
    kind,
    likes: 0,
    saves: 0,
    qualitySignals: [],
    reviewerEndorsements: [],
    submittedAt: NOW.getTime(),
  } as AttributedContribution & { submittedAt: number });
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The panel with its optional props spelled out, so `createElement` can type-check them. */
const Panel = DailyQuestsPanel as FC<NonNullable<Parameters<typeof DailyQuestsPanel>[0]>>;

let view: Mounted;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
  vi.useRealTimers();
});

const text = () => view.container.textContent ?? "";
const input = (id: string) => query<HTMLInputElement>(view.container, `#${id}`);

describe("DailyQuestsPanel board and add-quest form", () => {
  it("shows the empty board and no-teams copy on a fresh store", async () => {
    view = await mount(createElement(Panel));
    expect(text()).toContain("Daily Quests");
    expect(text()).toContain("No quests yet.");
    expect(text()).toContain("No teams yet.");
  });

  it("validates the description and target count before saving", async () => {
    view = await mount(createElement(Panel));

    await click(buttonByText(view.container, "Add quest"));
    expect(text()).toContain("Description is required.");

    await type(input("quest-description"), "Find solvency cards");
    await type(input("quest-target-count"), "0");
    await click(buttonByText(view.container, "Add quest"));
    expect(text()).toContain("Target count must be a positive number.");
    expect(listQuestTemplates()).toEqual([]);
  });

  it("saves a custom quest with kind, arg block, difficulty, expiry and recurrence, then removes it", async () => {
    view = await mount(createElement(Panel));

    await type(input("quest-description"), "  Add frontlines  ");
    await click(buttonByText(view.container, "Refutation"));
    await type(input("quest-argblock"), " Solvency ");
    await type(input("quest-target-count"), "2");
    await click(buttonByText(view.container, "Hard"));
    // The "Recurs" chooser only appears once an expiry is set.
    expect(buttonsByText(view.container, "Weekly")).toHaveLength(0);
    await type(input("quest-expires-on"), "2026-03-20");
    await click(buttonByText(view.container, "Weekly"));
    await click(buttonByText(view.container, "Add quest"));

    const [saved] = listQuestTemplates();
    expect(saved).toMatchObject({
      id: `custom-${NOW.getTime()}`,
      description: "Add frontlines",
      target: { kind: "refutation", argBlock: "Solvency" },
      targetCount: 2,
      difficulty: "hard",
      expiresOn: "2026-03-20",
      recurrence: "weekly",
    });
    // The form resets after a save.
    expect(input("quest-description").value).toBe("");
    expect(text()).toContain("Add frontlines");
    expect(text()).toContain("0/2");
    expect(text()).toContain("Expires 2026-03-20");
    expect(text()).toContain("Recurs weekly");

    await click(buttonByText(view.container, "Remove"));
    expect(listQuestTemplates()).toEqual([]);
    expect(text()).toContain("No quests yet.");
  });

  it("omits the arg block, expiry and recurrence when they are left blank", async () => {
    view = await mount(createElement(Panel));
    await type(input("quest-description"), "Cut cards");
    await click(buttonByText(view.container, "Add quest"));

    const [saved] = listQuestTemplates();
    expect(saved.target).toEqual({ kind: "card" });
    expect(saved.difficulty).toBe("medium");
    expect(saved).not.toHaveProperty("expiresOn");
    expect(saved).not.toHaveProperty("recurrence");
  });

  it("marks a quest complete from today's submissions and filters the board by difficulty", async () => {
    saveQuestTemplate({
      id: "q-easy",
      description: "One card",
      target: { kind: "card" },
      targetCount: 1,
      difficulty: "easy",
    });
    saveQuestTemplate({
      id: "q-hard",
      description: "Five summaries",
      target: { kind: "summary" },
      targetCount: 5,
      difficulty: "hard",
    });
    submitted("c1", "alice");

    view = await mount(createElement(Panel));
    expect(text()).toContain("Complete");
    expect(text()).toContain("0/5");
    expect(text()).toContain("One card");
    expect(text()).toContain("Five summaries");

    await click(buttonByText(view.container, "Easy"));
    // "Easy" appears in both the form and the filter; the form's comes first.
    const filterEasy = buttonsByText(view.container, "Easy").at(-1)!;
    await click(filterEasy);
    expect(text()).toContain("One card");
    expect(text()).not.toContain("Five summaries");

    await click(buttonsByText(view.container, "All").at(-1)!);
    expect(text()).toContain("Five summaries");
  });

  it("prunes expired quests and reports how many were removed", async () => {
    view = await mount(createElement(Panel));
    await click(buttonByText(view.container, "Clean up expired quests"));
    expect(text()).toContain("No expired quests to clean up.");

    saveQuestTemplate({
      id: "old-1",
      description: "Old",
      target: { kind: "card" },
      targetCount: 1,
      expiresOn: "2026-03-01",
    });
    saveQuestTemplate({
      id: "old-2",
      description: "Older",
      target: { kind: "card" },
      targetCount: 1,
      expiresOn: "2026-02-01",
    });
    await click(buttonByText(view.container, "Clean up expired quests"));
    expect(text()).toContain("Removed 2 expired quests.");
    expect(listQuestTemplates()).toEqual([]);

    saveQuestTemplate({
      id: "old-3",
      description: "Oldest",
      target: { kind: "card" },
      targetCount: 1,
      expiresOn: "2026-01-01",
    });
    await click(buttonByText(view.container, "Clean up expired quests"));
    expect(text()).toContain("Removed 1 expired quest.");
  });

  it("refreshes the board when another tab writes to storage", async () => {
    view = await mount(createElement(Panel));
    expect(text()).toContain("No quests yet.");

    saveQuestTemplate({ id: "remote", description: "From another tab", target: { kind: "card" }, targetCount: 1 });
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-key" }));
    });
    expect(text()).not.toContain("From another tab");

    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(text()).toContain("From another tab");
  });
});

describe("DailyQuestsPanel topic-coverage seeding", () => {
  it("requires a topic for both preview and seed", async () => {
    view = await mount(createElement(Panel));
    await click(buttonByText(view.container, "Preview"));
    expect(text()).toContain("Enter a topic to preview quests from its coverage gaps.");
    await click(buttonByText(view.container, "Seed quests"));
    expect(text()).toContain("Enter a topic to seed quests from its coverage gaps.");
  });

  it("previews nothing for a topic with no tracked gaps", async () => {
    view = await mount(createElement(Panel));
    await type(input("quest-seed-topic"), "Nothing Here");
    await click(buttonByText(view.container, "Preview"));
    expect(text()).toContain('Nothing under-covered for "Nothing Here"');
  });

  it("previews the quests a gap would seed, then seeds them onto the board", async () => {
    saveTrackedArgument({ id: "t1", topic: "Energy Policy", argBlock: "Warming DA" });
    view = await mount(createElement(Panel));

    await type(input("quest-seed-topic"), "Energy Policy");
    await click(buttonByText(view.container, "Preview"));
    expect(text()).toContain("Seeding would add 1 new quest (1 total");
    expect(text()).toContain("New");
    expect(listQuestTemplates()).toEqual([]);

    // Editing the topic clears a stale preview.
    await type(input("quest-seed-topic"), "Energy Policy ");
    expect(text()).not.toContain("Seeding would add");

    await click(buttonByText(view.container, "Seed quests"));
    expect(listQuestTemplates()).toHaveLength(1);
    expect(text()).toContain("Warming DA");

    await click(buttonByText(view.container, "Preview"));
    expect(text()).toContain("Seeding would add 0 new quests (1 total");
    expect(text()).toContain("Already on board");
  });
});

describe("DailyQuestsPanel streak recorder", () => {
  it("requires a contributor id to record a mission", async () => {
    view = await mount(createElement(Panel));
    await click(buttonByText(view.container, "Record today's mission"));
    expect(text()).toContain("Contributor id is required.");
  });

  it("prefills from the signed-in contributor id and shows their streak", async () => {
    view = await mount(createElement(Panel, { signedInContributorId: "alice" }));
    expect(input("quest-streak-contributor").value).toBe("alice");
    expect(text()).toContain("Prefilled from your signed-in account");
    expect(text()).toContain("Complete today's quests to start a streak.");
  });

  it("records a completed mission and highlights the badge earned today", async () => {
    saveQuestTemplate({ id: "q1", description: "One card", target: { kind: "card" }, targetCount: 1 });
    submitted("c1", "alice");
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-03-08", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-03-09", isComplete: true });

    view = await mount(createElement(Panel));
    await type(input("quest-streak-contributor"), "alice");
    await click(buttonByText(view.container, "Record today's mission"));

    expect(listDailyMissionResultsForContributor("alice").find((r) => r.dayKey === TODAY)?.isComplete).toBe(true);
    const streak = buildPersistedContributorQuestStreak("alice", TODAY);
    expect(streak.streak.currentStreak).toBe(3);
    expect(text()).toContain(buildStreakRewardText(streak, true));
    const badge = Array.from(view.container.querySelectorAll("[title='Earned today']"));
    expect(badge.map((el) => el.textContent)).toEqual(["✨ 3-Day Streak"]);

    // The live-update listener also refreshes the streak for the typed id.
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(text()).toContain("✨ 3-Day Streak");
  });

  it("shows earned badges without the fresh marker when the latest completed day isn't today", async () => {
    // A record dated after "today" (e.g. written by a device with a skewed
    // clock) makes the latest completed day differ from today, so the panel
    // treats today's mission as not-yet-complete even mid-streak.
    for (const day of ["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10", "2026-03-11"]) {
      saveDailyMissionResult({ contributorId: "bo", dayKey: day, isComplete: true });
    }
    view = await mount(createElement(Panel));
    await type(input("quest-streak-contributor"), "bo");
    expect(text()).toContain("4-day streak — complete today's quests to keep it going.");
    expect(text()).toContain("3-Day Streak");
    expect(view.container.querySelector("[title='Earned today']")).toBeNull();

    // Clearing the field clears the streak readout.
    await type(input("quest-streak-contributor"), "");
    expect(text()).not.toContain("4-day streak");
  });
});

describe("DailyQuestsPanel team competition", () => {
  it("validates, ranks and removes teams", async () => {
    saveQuestTemplate({ id: "q1", description: "One card", target: { kind: "card" }, targetCount: 1 });
    submitted("c1", "alice");
    view = await mount(createElement(Panel));

    await click(buttonByText(view.container, "Add team"));
    expect(text()).toContain("Team name is required.");
    await type(input("quest-team-name"), "Alpha");
    await type(input("quest-team-members"), " , ");
    await click(buttonByText(view.container, "Add team"));
    expect(text()).toContain("Enter at least one contributor id, comma-separated.");

    await type(input("quest-team-members"), "alice, , carol");
    await click(buttonByText(view.container, "Add team"));
    expect(listQuestTeams()).toEqual([
      { id: `team-${NOW.getTime()}`, name: "Alpha", contributorIds: ["alice", "carol"] },
    ]);
    expect(input("quest-team-name").value).toBe("");

    vi.setSystemTime(new Date(NOW.getTime() + 1000));
    await type(input("quest-team-name"), "Beta");
    await type(input("quest-team-members"), "dan");
    await click(buttonByText(view.container, "Add team"));

    expect(text()).toContain("🏆");
    expect(text()).toContain("Alpha");
    expect(text()).toContain("Beta");
    expect(text()).toMatch(/alice: \d+\/\d+/);
    expect(text()).toContain("dan: 0/");

    const removeButtons = buttonsByText(view.container, "Remove");
    // Last two "Remove"s belong to the team rows (the first is the quest row).
    await click(removeButtons.at(-1)!);
    await click(buttonsByText(view.container, "Remove").at(-1)!);
    expect(listQuestTeams()).toEqual([]);
    expect(text()).toContain("No teams yet.");
  });
});
