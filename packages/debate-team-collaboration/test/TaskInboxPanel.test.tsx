// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `TaskInboxPanel`: routing a topic's
 * coverage gaps, the contributor availability roster, team capacity,
 * reassigning and flagging tasks, marking one done and having a different
 * contributor verify it, and the signed-in "my tasks" filter and verifier
 * lock.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TaskInboxPanel } from "../src/panels/TaskInboxPanel";
import { saveTrackedArgument } from "@debate-ai/research-evidence/src/state/trackedArguments";
import { listContributorAvailability, saveContributorAvailability } from "../src/state/contributorAvailability";
import { listPendingTaskVerifications } from "../src/state/pendingTaskVerifications";
import { listCompletedTaskHistory } from "../src/state/researchProgress";
import { buildTaskInboxView } from "../src/state/routedTaskQueues";
import { button } from "./helpers/dom";
import { click, mount, type, type Mounted } from "./helpers/mount";

let view: Mounted;
const text = () => view.container.textContent ?? "";
const field = (selector: string) => view.container.querySelector(selector) as HTMLInputElement;

function seedTopic() {
  saveTrackedArgument({ id: "t-1", topic: "Energy", argBlock: "Solvency", category: "Case" });
  saveTrackedArgument({ id: "t-2", topic: "Energy", argBlock: "Grid DA", category: "DA" });
  saveContributorAvailability({ contributorId: "alice", skillLevel: "advanced", activeTaskCount: 0, maxConcurrentTasks: 1 });
}

/** Routes "Energy" and returns which block went to alice and which stayed unassigned. */
async function routeEnergy() {
  await click(button(view.container, "Energy"));
  const [topic] = buildTaskInboxView();
  return { assigned: topic.assignments[0].task.argBlock, unassigned: topic.unassignedTasks[0].argBlock };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view.unmount();
});

describe("TaskInboxPanel", () => {
  it("starts empty and needs a topic to route", async () => {
    view = await mount(createElement(TaskInboxPanel));
    expect(text()).toContain("No research tasks routed yet.");
    expect(text()).toContain("This is a free-form filter, not a login.");
    await click(button(view.container, "Route tasks"));
    expect(text()).toContain("Enter a topic to route.");
  });

  it("adds, edits and deletes contributor profiles", async () => {
    view = await mount(createElement(TaskInboxPanel));
    await type(field("#task-inbox-availability-id"), "bob");
    await type(field("#task-inbox-availability-max"), "0");
    await click(button(view.container, "Add profile"));
    expect(view.container.querySelector(".text-destructive")?.textContent).toBeTruthy();
    expect(listContributorAvailability()).toEqual([]);

    await type(field("#task-inbox-availability-max"), "3");
    await click(button(view.container, "Add profile"));
    expect(text()).toContain("0 / 3 tasks");
    expect(listContributorAvailability()).toEqual([expect.objectContaining({ contributorId: "bob", skillLevel: "novice" })]);

    await click(button(view.container, "Edit"));
    expect(field("#task-inbox-availability-id").disabled).toBe(true);
    await click(button(view.container, "Cancel"));
    expect(field("#task-inbox-availability-id").value).toBe("");

    await click(button(view.container, "Edit"));
    await type(field("#task-inbox-availability-max"), "5");
    await click(button(view.container, "Update profile"));
    expect(text()).toContain("0 / 5 tasks");

    await click(button(view.container, "Edit"));
    await click(button(view.container, "Delete"));
    expect(listContributorAvailability()).toEqual([]);
    expect(button(view.container, "Add profile")).toBeTruthy();
  });

  it("routes a topic, reassigns and flags tasks, and verifies a finished one", async () => {
    seedTopic();
    view = await mount(createElement(TaskInboxPanel));
    const { assigned, unassigned } = await routeEnergy();

    expect(text()).toContain("Team capacity");
    expect(text()).toContain("Energy (1)");
    expect(text()).toContain("assigned to");
    expect(text()).toContain("unassigned — no eligible contributor available");

    await click(button(view.container, "Flag high priority"));
    expect(text()).toContain("High priority");
    await click(button(view.container, "Unflag"));
    expect(text()).not.toContain("High priority");

    await click(button(view.container, "Flag high priority", 1));
    expect(text()).toContain("High priority");

    await type(field(`input[aria-label="Assign ${unassigned} to"]`), "carol");
    await click(button(view.container, "Assign"));
    expect(buildTaskInboxView()[0].assignments.map((a) => a.contributorId).sort()).toEqual(["alice", "carol"]);

    const reassign = field(`input[aria-label="Reassign ${assigned} to"]`);
    const reassignButton = button(reassign.parentElement!, "Reassign");
    expect(reassignButton.disabled).toBe(true);
    await type(reassign, "dave");
    await click(reassignButton);
    expect(buildTaskInboxView()[0].assignments.find((a) => a.task.argBlock === assigned)?.contributorId).toBe("dave");

    await click(button(view.container, "Mark done"));
    expect(text()).toContain("Awaiting verification");
    const [record] = listPendingTaskVerifications();
    const owner = record.assignment.contributorId;

    const verifier = () => field('input[placeholder="Verifier id"]');
    await type(verifier(), owner);
    await click(button(view.container, "Verify"));
    expect(listPendingTaskVerifications()).toHaveLength(1);
    expect(view.container.querySelector("p.text-destructive")?.textContent).toBeTruthy();

    await type(verifier(), "erin");
    await click(button(view.container, "Verify"));
    expect(listPendingTaskVerifications()).toEqual([]);
    expect(listCompletedTaskHistory()).toHaveLength(1);
  });

  it("scopes to the signed-in contributor and locks their verifier id", async () => {
    seedTopic();
    view = await mount(<TaskInboxPanel signedInContributorId="alice" />);
    expect(field("#task-inbox-my-id").value).toBe("alice");
    expect(text()).toContain("Prefilled from your signed-in account");

    await routeEnergy();
    await click(button(view.container, "Mark done"));
    expect(text()).toContain("You completed this task — a different contributor must verify it.");
    expect(button(view.container, "Verify").disabled).toBe(true);

    await type(field("#task-inbox-my-id"), "nobody");
    expect(text()).toContain('No tasks routed to "nobody" right now.');

    await view.unmount();
    view = await mount(<TaskInboxPanel signedInContributorId="zed" />);
    expect(text()).toContain("Verifying as your signed-in id.");
    expect(field('input[placeholder="Verifier id"]').value).toBe("zed");
    await click(button(view.container, "Verify"));
    expect(listPendingTaskVerifications()).toEqual([]);
  });
});
