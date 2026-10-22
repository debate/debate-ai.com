// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `CoachingProgramsPanel`: creating and
 * removing programs, opening a program's board, saving and clearing a
 * member's flow from the selected round flow, and composing the board for a
 * topic.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CoachingProgramsPanel } from "../src/panels/CoachingProgramsPanel";
import { listCoachingPrograms } from "../src/state/coachingPrograms";
import { listRoundContributorFlows } from "../src/state/roundContributorFlows";
import { button } from "./helpers/dom";
import { sampleFlow, selectFlow } from "./helpers/flow";
import { click, mount, type, type Mounted } from "./helpers/mount";

let view: Mounted;
const text = () => view.container.textContent ?? "";
const field = (selector: string) => view.container.querySelector(selector) as HTMLInputElement;

async function createProgram(name: string, members: string) {
  await type(field("#coaching-program-name"), name);
  await type(field("#coaching-program-members"), members);
  await click(button(view.container, "Create program"));
}

beforeEach(async () => {
  localStorage.clear();
  selectFlow(null);
  view = await mount(createElement(CoachingProgramsPanel));
});

afterEach(async () => {
  await view.unmount();
});

describe("CoachingProgramsPanel", () => {
  it("requires a name and a roster", async () => {
    expect(text()).toContain("No coaching programs yet.");
    await type(field("#coaching-program-name"), "Varsity");
    await click(button(view.container, "Create program"));
    expect(text()).toContain("A program name and at least one squad member are required.");
    expect(listCoachingPrograms()).toEqual([]);
  });

  it("creates and removes a program", async () => {
    await createProgram("Varsity", "alice, bob, ");
    expect(text()).toContain("Varsity (2 members)");
    expect(text()).not.toContain("are required");
    expect(listCoachingPrograms()[0].memberIds).toEqual(["alice", "bob"]);
    expect(field("#coaching-program-name").value).toBe("");

    await click(button(view.container, "Remove"));
    expect(text()).toContain("No coaching programs yet.");
  });

  it("opens the board, records member flows and composes it for a topic", async () => {
    await createProgram("JV", "alice");
    expect(text()).toContain("JV (1 member)");
    await view.unmount();
    selectFlow(sampleFlow(7));
    view = await mount(createElement(CoachingProgramsPanel));

    await click(button(view.container, "View board"));
    expect(text()).toContain("No flow recorded");
    expect(text()).toContain("Enter a topic above");

    await click(button(view.container, "Save current flow"));
    expect(text()).toContain("A side (e.g. A or N) is required");

    await type(view.container.querySelector('input[placeholder="Side (e.g. A)"]') as HTMLInputElement, "A");
    await click(button(view.container, "Save current flow"));
    expect(text()).toContain("Flow recorded");
    expect(listRoundContributorFlows()).toEqual([expect.objectContaining({ contributorId: "alice", roundId: "7", sideKey: "A" })]);

    const programId = listCoachingPrograms()[0].id;
    await type(field(`#coaching-board-topic-${CSS.escape(programId)}`), "Immigration");
    expect(text()).not.toContain("Enter a topic above");
    expect(text()).not.toContain("Loading board…");
    expect(text()).toContain("No practice round");

    await click(button(view.container, "Clear"));
    expect(text()).toContain("No flow recorded");
    expect(listRoundContributorFlows()).toEqual([]);

    await click(button(view.container, "Hide board"));
    expect(text()).not.toContain("Member flows");
  });

  it("disables saving a flow with no round flow selected", async () => {
    await createProgram("JV", "alice");
    await click(button(view.container, "View board"));
    expect(button(view.container, "Save current flow").disabled).toBe(true);
  });
});
