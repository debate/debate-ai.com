// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ResearchProgressPanel`: the contributor
 * table and topic comparison built from contributions plus routed and
 * completed tasks, the confirmed clear of a topic's history, the report
 * download, and setting, updating and clearing a personal goal.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchProgressPanel } from "../src/panels/ResearchProgressPanel";
import { completeAndRecordResearchTask, listCompletedTaskHistory } from "../src/state/researchProgress";
import { saveRoutedTaskQueue } from "../src/state/routedTaskQueues";
import { saveContribution } from "@debate/research-evidence/src/state/contributions";
import { button, captureDownloads } from "./helpers/dom";
import { click, mount, type, type Mounted } from "./helpers/mount";

const sync = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock("../src/lib/research-progress-goal-sync-client", () => ({
  fetchResearchProgressGoal: sync.fetch,
  saveResearchProgressGoal: sync.save,
}));

let view: Mounted;
const text = () => view.container.textContent ?? "";
const field = (selector: string) => view.container.querySelector(selector) as HTMLInputElement;

function seedProgress() {
  saveRoutedTaskQueue({
    topicId: "Immigration",
    result: {
      assignments: [
        { task: { argBlock: "Solvency", level: "missing", requiredSkill: "intermediate" }, contributorId: "alice" },
        { task: { argBlock: "Impacts", level: "thin", requiredSkill: "novice" }, contributorId: "alice" },
      ],
      unassignedTasks: [],
    },
  });
  completeAndRecordResearchTask("Immigration", "Solvency", "2026-01-05T00:00:00Z");
  saveContribution({
    id: "card-1",
    kind: "card",
    contributorId: "bob",
    likes: 3,
    saves: 1,
    qualitySignals: [0.8],
    reviewerEndorsements: [],
  });
}

beforeEach(() => {
  localStorage.clear();
  sync.fetch.mockReset().mockResolvedValue(null);
  sync.save.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  await view.unmount();
  vi.restoreAllMocks();
});

describe("ResearchProgressPanel", () => {
  it("shows the empty state with no goal section when signed out", async () => {
    view = await mount(createElement(ResearchProgressPanel));
    expect(text()).toContain("No progress yet.");
    expect(text()).not.toContain("My research goal");
    expect(() => button(view.container, "Download report")).toThrow();
  });

  it("lists contributors, the topic comparison, and downloads a report", async () => {
    seedProgress();
    view = await mount(<ResearchProgressPanel signedInContributorId="alice" />);

    expect(text()).toContain("aliceYou");
    expect(text()).toContain("1/2 (50%)");
    expect(text()).toContain("Immigration: 1/2");
    expect(text()).toMatch(/bob1 \([\d.]+ pts\)/);
    expect(text()).toContain("Topic comparison");

    const downloads = captureDownloads();
    await click(button(view.container, "Download report"));
    expect(downloads).toHaveLength(1);
  });

  it("clears a topic's completed history only after confirming", async () => {
    seedProgress();
    view = await mount(createElement(ResearchProgressPanel));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);

    await click(button(view.container, "Clear completed history"));
    expect(listCompletedTaskHistory()).toHaveLength(1);

    await click(button(view.container, "Clear completed history"));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(listCompletedTaskHistory()).toEqual([]);
    expect(text()).toContain("Immigration: 0/1");
  });

  it("sets, updates and clears a personal goal", async () => {
    seedProgress();
    sync.fetch.mockResolvedValue({ goal: null });
    view = await mount(<ResearchProgressPanel signedInContributorId="alice" />);

    await click(button(view.container, "Set a goal"));
    await type(field("#research-goal-target"), "0");
    await click(button(view.container, "Save goal"));
    expect(text()).toContain("Enter a target number of tasks greater than 0.");

    await type(field("#research-goal-target"), "3");
    await type(field("#research-goal-target-date"), "2026-12-01");
    await click(button(view.container, "Save goal"));
    expect(text()).toContain("1/3 tasks completed by 2026-12-01");
    expect(text()).toContain("2 more tasks to go");
    expect(sync.save).toHaveBeenCalledWith({ targetCompletedTaskCount: 3, topic: undefined, targetDate: "2026-12-01" });

    await click(button(view.container, "Update goal"));
    expect(field("#research-goal-target").value).toBe("3");
    await type(field("#research-goal-target"), "1");
    await click(button(view.container, "Save goal"));
    expect(text()).toContain("🎉 Goal reached");

    await click(button(view.container, "Update goal"));
    await click(button(view.container, "Cancel"));
    expect(text()).toContain("Clear goal");

    await click(button(view.container, "Clear goal"));
    expect(text()).toContain("Set a goal");
    expect(sync.save).toHaveBeenLastCalledWith(null);
  });
});
