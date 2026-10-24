// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `CoachingProgramRosterAnalyticsPanel` — the
 * program picker, the per-member streak/challenge/drill table, the recent
 * challenge digest (with its 10-entry cap), and the program calendar with
 * caller-supplied drill reviews and topic sprint notes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC } from "react";

import { CoachingProgramRosterAnalyticsPanel } from "../src/panels/CoachingProgramRosterAnalyticsPanel";
import { saveDailyMissionResult } from "../src/state/dailyMissionResults";
import { saveCoachingProgram } from "@debate-ai/team-collaboration/src/state/coachingPrograms";
import { saveGroupChallenge } from "@debate-ai/team-collaboration/src/state/groupChallenges";
import { recordChallengeWinEvent } from "@debate-ai/team-collaboration/src/state/challengeWinEvents";
import { saveSprintNote } from "@debate-ai/team-collaboration/src/state/sprintNotes";
import type { GroupChallenge } from "@debate-ai/team-collaboration/src/lib/group-challenges";
import { flush, mount, query, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The panel with its optional props spelled out, so `createElement` can type-check them. */
const Panel = CoachingProgramRosterAnalyticsPanel as FC<
  NonNullable<Parameters<typeof CoachingProgramRosterAnalyticsPanel>[0]>
>;

const NOW = new Date("2026-09-10T12:00:00Z");

function challenge(id: string, memberIds: string[], overrides: Partial<GroupChallenge> = {}): GroupChallenge {
  return {
    id,
    title: `Challenge ${id}`,
    goal: { kind: "win_target", targetCount: 1 },
    memberIds,
    startsAt: Date.UTC(2026, 8, 1),
    endsAt: Date.UTC(2026, 8, 8),
    ...overrides,
  };
}

let view: Mounted;
const text = () => view.container.textContent ?? "";
const cells = (contributorId: string) => {
  const row = Array.from(view.container.querySelectorAll("tbody tr")).find(
    (tr) => tr.querySelector("td")?.textContent === contributorId,
  );
  if (!row) throw new Error(`No row for ${contributorId}`);
  return Array.from(row.querySelectorAll("td")).map((td) => td.textContent);
};

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

describe("CoachingProgramRosterAnalyticsPanel", () => {
  it("shows the no-programs empty state", async () => {
    view = await mount(createElement(Panel));
    expect(text()).toContain("No coaching programs yet.");
  });

  it("renders the first program's roster with streaks, challenge standings and drill status", async () => {
    saveCoachingProgram({ id: "varsity", name: "Varsity", memberIds: ["alice", "bob"] });
    saveGroupChallenge(challenge("c1", ["alice", "bob"], { goal: { kind: "win_target", targetCount: 2 } }));
    recordChallengeWinEvent("alice", Date.UTC(2026, 8, 2));
    recordChallengeWinEvent("alice", Date.UTC(2026, 8, 3));
    for (const day of ["2026-09-08", "2026-09-09", "2026-09-10"]) {
      saveDailyMissionResult({ contributorId: "alice", dayKey: day, isComplete: true });
    }

    view = await mount(
      createElement(Panel, {
        memberDrillPracticeStatus: {
          alice: { completedDrills: 2, totalDrills: 5, practiceRoundRecorded: true, practiceRoundHasFeedback: true },
          bob: { completedDrills: 0, totalDrills: 0, practiceRoundRecorded: true, practiceRoundHasFeedback: false },
        },
      }),
    );

    expect(query<HTMLSelectElement>(view.container, "#roster-analytics-program").value).toBe("varsity");
    expect(cells("alice")).toEqual(["alice", "🔥 3", "3", "3-Day Streak", "1/1", "🏆 1", "2/5", "+ feedback"]);
    expect(cells("bob")).toEqual(["bob", "—", "0", "—", "1/1", "—", "—", "Recorded"]);

    expect(text()).toContain('"Challenge c1" complete! (2/2) — top contributor: alice');
    expect(text()).not.toContain("most recent of");

    expect(text()).toContain("Challenge starts");
    expect(text()).toContain("Challenge ends");
  });

  it("switches programs, showing an empty roster and an empty digest/calendar", async () => {
    saveCoachingProgram({ id: "varsity", name: "Varsity", memberIds: ["alice"] });
    saveCoachingProgram({ id: "empty", name: "Zeta (empty)", memberIds: [] });
    view = await mount(createElement(Panel));
    expect(cells("alice")[0]).toBe("alice");

    await type(query<HTMLSelectElement>(view.container, "#roster-analytics-program"), "empty");
    expect(text()).toContain("This program has no roster members yet.");
    expect(text()).toContain("No completed group challenges for this program's roster yet.");
    expect(text()).toContain("No dated events yet");
  });

  it("caps the digest at the 10 most recent results", async () => {
    saveCoachingProgram({ id: "varsity", name: "Varsity", memberIds: ["alice"] });
    for (let i = 0; i < 11; i += 1) saveGroupChallenge(challenge(`c${i}`, ["alice"]));
    recordChallengeWinEvent("alice", Date.UTC(2026, 8, 2));
    view = await mount(createElement(Panel));

    expect(text()).toContain("Showing the 10 most recent of 11 results.");
    const digestItems = Array.from(view.container.querySelectorAll("li")).filter((li) =>
      li.textContent?.includes("complete!"),
    );
    expect(digestItems).toHaveLength(10);
  });

  it("folds drill reviews and a typed topic's sprint notes into the calendar", async () => {
    saveCoachingProgram({ id: "varsity", name: "Varsity", memberIds: ["alice"] });
    saveSprintNote({
      id: "note-1",
      topic: "Warming",
      authorId: "alice",
      text: "Need more impact cards.",
      status: "open",
      createdAt: Date.UTC(2026, 8, 3),
      updatedAt: Date.UTC(2026, 8, 3),
    });
    view = await mount(createElement(Panel));
    expect(text()).toContain("No dated events yet");

    await view.rerender(
      createElement(Panel, {
        drillReviewEvents: [{ dayKey: "2026-09-12", label: "Review: Link turns", detail: "3 drills due" }],
      }),
    );
    expect(text()).toContain("Drill review");
    expect(text()).toContain("Review: Link turns — 3 drills due");

    await type(query<HTMLInputElement>(view.container, "#roster-analytics-calendar-topic"), "Warming");
    expect(text()).toContain("Sprint note");
    expect(text()).toContain("Need more impact cards.");
  });

  it("refreshes on a watched storage event", async () => {
    saveCoachingProgram({ id: "varsity", name: "Varsity", memberIds: ["alice"] });
    view = await mount(createElement(Panel));
    expect(cells("alice")[1]).toBe("—");

    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-09-10", isComplete: true });
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    });
    expect(cells("alice")[1]).toBe("—");

    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(cells("alice")[1]).toBe("🔥 1");
  });
});
