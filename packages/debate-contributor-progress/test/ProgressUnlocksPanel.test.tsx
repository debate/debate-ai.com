// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ProgressUnlocksPanel`, which had no
 * component test at all before this file — this package's `test/` folder
 * only ever covered its pure `lib`/`state` modules
 * (`unlock-streak-status.test.ts`, `unlock-celebration.test.ts`,
 * `unlockCelebrations.test.ts`), never the panel that composes them into a
 * roster table with a "You" highlight, a dismissible unlock-celebration
 * banner, and a cross-tab live-update refresh. Same "real logic, zero
 * component coverage" gap `debate-search-evidence/test/ArgumentLibraryPanel.test.tsx`
 * and `debate-team-collaboration/test/PrepNoteNotificationsPanel.test.tsx`
 * closed for their own panels.
 *
 * Uses the same jsdom + `react-dom/client` + `act` pattern those two files
 * established for a component that loads its own data inside a `useEffect`
 * (a `node`-environment `renderToStaticMarkup` snapshot never runs effects,
 * so it can't see this panel's roster at all) — this package's first use of
 * that pattern, so it also adds `test/helpers/mount.tsx`, mirroring
 * `debate-team-collaboration/test/helpers/mount.tsx`'s `mount`/`click`/
 * `flush` API exactly rather than inventing a new one.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";

import { ProgressUnlocksPanel } from "../src/panels/ProgressUnlocksPanel";
import { saveContribution } from "debate-research-evidence/src/state/contributions";
import { saveDailyMissionResult } from "../src/state/dailyMissionResults";
import { completeAndRecordResearchTask } from "debate-team-collaboration/src/state/researchProgress";
import { saveRoutedTaskQueue, type RoutedTaskQueueRecord } from "debate-team-collaboration/src/state/routedTaskQueues";
import { markBadgesSeen } from "../src/state/unlockCelebrations";
import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";
import type { ResearchTask, RoutingResult } from "debate-research-evidence/src/lib/research-task-routing";
import { click, flush, mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

function contribution(id: string, contributorId: string): AttributedContribution {
  return {
    id,
    contributorId,
    kind: "card",
    likes: 0,
    saves: 0,
    qualitySignals: [1],
    reviewerEndorsements: [{ reviewerWeight: 1 }],
  };
}

/** Persists `count` scored contributions for `contributorId` (5 reaches "apprentice"). */
function contributeFor(contributorId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    saveContribution(contribution(`${contributorId}-${i}`, contributorId));
  }
}

/** Routes `count` tasks to `contributorId` in one topic, then completes every one of them. */
function completeTasksFor(contributorId: string, count: number): void {
  const tasks: ResearchTask[] = Array.from({ length: count }, (_, i) => ({
    argBlock: `Block-${i}`,
    level: "thin",
    requiredSkill: "novice",
  }));
  const result: RoutingResult = {
    assignments: tasks.map((task) => ({ task, contributorId })),
    unassignedTasks: [],
  };
  const queue: RoutedTaskQueueRecord = { topicId: "topic-research", result };
  saveRoutedTaskQueue(queue);

  tasks.forEach((task, i) => {
    completeAndRecordResearchTask("topic-research", task.argBlock, `2026-08-${10 + i}T00:00:00Z`);
  });
}

/** Today's UTC calendar day as `YYYY-MM-DD`, matching the panel's own `todayUtcDayKey`. */
function todayUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function byTagText(container: HTMLElement, tag: string, text: string): HTMLElement | null {
  return (
    (Array.from(container.querySelectorAll(tag)).find((el) => el.textContent?.trim() === text) as
      | HTMLElement
      | undefined) ?? null
  );
}

const buttonByText = (container: HTMLElement, text: string) =>
  byTagText(container, "button", text) as HTMLButtonElement | null;

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

describe("ProgressUnlocksPanel empty state", () => {
  it("shows the empty state when no contributor has any persisted activity", async () => {
    view = await mount(createElement(ProgressUnlocksPanel));
    expect(view.container.textContent).toContain("No contributors yet.");
  });
});

describe("ProgressUnlocksPanel roster", () => {
  it("renders a contributor's tier, unlocked skill level, badges, and next-tier progress", async () => {
    contributeFor("alice", 5);
    view = await mount(createElement(ProgressUnlocksPanel));

    expect(view.container.textContent).toContain("alice");
    expect(view.container.textContent).toContain("apprentice");
    expect(view.container.textContent).toContain("Rising Researcher");
    expect(view.container.textContent).toContain("to veteran");
  });

  it("shows a dash for a contributor with no active streak and the current streak count otherwise", async () => {
    contributeFor("alice", 5);
    contributeFor("bob", 5);
    saveDailyMissionResult({ contributorId: "bob", dayKey: todayUtcDayKey(), isComplete: true });
    view = await mount(createElement(ProgressUnlocksPanel));

    const rows = Array.from(view.container.querySelectorAll("tbody tr"));
    const aliceRow = rows.find((row) => row.textContent?.includes("alice"));
    const bobRow = rows.find((row) => row.textContent?.includes("bob"));

    expect(aliceRow?.textContent).toContain("—");
    expect(bobRow?.textContent).toContain("🔥");
  });

  it("shows 'Top tier reached' instead of a progress meter for an expert-tier contributor", async () => {
    completeTasksFor("frank", 20);
    view = await mount(createElement(ProgressUnlocksPanel));

    expect(view.container.textContent).toContain("expert");
    expect(view.container.textContent).toContain("Top tier reached");
  });
});

describe("ProgressUnlocksPanel 'You' highlighting", () => {
  it("highlights the row matching signedInContributorId with a You badge", async () => {
    contributeFor("alice", 5);
    contributeFor("bob", 5);
    view = await mount(<ProgressUnlocksPanel signedInContributorId="alice" />);

    const rows = Array.from(view.container.querySelectorAll("tbody tr"));
    const aliceRow = rows.find((row) => row.textContent?.includes("alice"));
    const bobRow = rows.find((row) => row.textContent?.includes("bob"));

    expect(aliceRow?.textContent).toContain("You");
    expect(bobRow?.textContent).not.toContain("You");
  });

  it("highlights no row when signedInContributorId matches nobody", async () => {
    contributeFor("alice", 5);
    view = await mount(<ProgressUnlocksPanel signedInContributorId="carol" />);

    expect(view.container.textContent).not.toContain("You");
  });
});

describe("ProgressUnlocksPanel unlock celebration", () => {
  it("shows no celebration banner the first time a baseline is recorded for a contributor", async () => {
    contributeFor("alice", 5);
    view = await mount(<ProgressUnlocksPanel signedInContributorId="alice" />);

    expect(view.container.textContent).not.toContain("New badge earned");
  });

  it("celebrates a newly earned badge against an existing baseline, and Dismiss clears it", async () => {
    markBadgesSeen("alice", []);
    contributeFor("alice", 5);
    view = await mount(<ProgressUnlocksPanel signedInContributorId="alice" />);

    expect(view.container.textContent).toContain("🎉 New badge earned: Rising Researcher!");

    await click(buttonByText(view.container, "Dismiss")!);
    expect(view.container.textContent).not.toContain("New badge earned");
  });

  it("shows no celebration banner without a signedInContributorId, even with a stale baseline", async () => {
    markBadgesSeen("alice", []);
    contributeFor("alice", 5);
    view = await mount(createElement(ProgressUnlocksPanel));

    expect(view.container.textContent).not.toContain("New badge earned");
  });
});

describe("ProgressUnlocksPanel cross-tab live update", () => {
  it("refreshes the roster when another tab writes a tracked storage key", async () => {
    view = await mount(createElement(ProgressUnlocksPanel));
    expect(view.container.textContent).toContain("No contributors yet.");

    contributeFor("alice", 5);
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "contributions" }));
    });

    expect(view.container.textContent).toContain("alice");
  });

  it("ignores a storage event for an unrelated key", async () => {
    view = await mount(createElement(ProgressUnlocksPanel));

    contributeFor("alice", 5);
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "someOtherKey" }));
    });

    expect(view.container.textContent).toContain("No contributors yet.");
  });
});
