// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `PrepRoomPanel`: picking a topic, the
 * room's evidence search, routed coverage-gap tasks, the shared checklist,
 * presence, and the activity timeline.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrepRoomPanel } from "../src/panels/PrepRoomPanel";
import { saveEvidenceLibraryEntry } from "@debate/research-evidence/src/state/evidenceLibraryEntries";
import { saveTrackedArgument } from "@debate/research-evidence/src/state/trackedArguments";
import type { EvidenceLibraryEntry } from "@debate/research-evidence/src/lib/shared-evidence-library";
import { saveContributorAvailability } from "../src/state/contributorAvailability";
import { listPersistedChecklistItems } from "../src/state/prepRoomChecklist";
import { button } from "./helpers/dom";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

const CARD: EvidenceLibraryEntry = {
  id: "card-1",
  argBlock: "States CP",
  wordCount: 200,
  topic: "Immigration",
  caseArea: "Neg",
  tags: ["cp"],
  kind: "card",
  text: "The states can act as effective policy laboratories.",
  cite: "Smith 24",
  createdAt: Date.UTC(2026, 0, 2),
};
const BLOCK: EvidenceLibraryEntry = {
  id: "block-1",
  argBlock: "Perm block",
  wordCount: 150,
  topic: "Immigration",
  caseArea: "Aff",
  tags: ["frontline"],
  kind: "block",
  text: "Frontline: perm do both solves the net benefit.",
  cite: "",
};

let view: Mounted;
const text = () => view.container.textContent ?? "";
const input = (selector: string) => view.container.querySelector(selector) as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view.unmount();
});

describe("PrepRoomPanel", () => {
  it("asks for a topic, and shows an empty room for an unknown one", async () => {
    view = await mount(createElement(PrepRoomPanel));
    expect(text()).toContain("Enter a topic above to open its prep room.");

    await type(input("#prep-room-topic"), "Space");
    expect(text()).toContain("No evidence or draft blocks filed under this topic yet.");
    expect(text()).toContain("No coverage-gap tasks routed for this topic yet.");
    expect(text()).toContain("No activity yet");
    expect(text()).toContain("No checklist tasks yet");
  });

  it("opens a stored topic with its evidence, routed tasks and timeline", async () => {
    saveEvidenceLibraryEntry(CARD);
    saveEvidenceLibraryEntry(BLOCK);
    saveTrackedArgument({ id: "t-1", topic: "Immigration", argBlock: "States CP", category: "CP" });
    saveTrackedArgument({ id: "t-2", topic: "Immigration", argBlock: "Warming DA", category: "DA" });
    saveContributorAvailability({ contributorId: "alice", skillLevel: "advanced", activeTaskCount: 0, maxConcurrentTasks: 1 });
    view = await mount(createElement(PrepRoomPanel));

    await click(button(view.container, "Immigration"));
    expect(input("#prep-room-topic").value).toBe("Immigration");
    expect(text()).toContain("Smith 24");
    expect(text()).toContain("Perm block");
    expect(text()).toContain("assigned to");
    expect(text()).toContain("alice");
    expect(text()).toContain("unassigned — no eligible contributor available");
    expect(text()).toContain("Evidence added: States CP (Smith 24)");

    await type(input("#prep-room-search"), "frontline perm");
    expect(text()).toContain("Perm block");

    await type(input("#prep-room-search"), "zzzz");
    expect(text()).toContain("No entries match this search.");
  });

  it("adds, completes and removes shared checklist tasks", async () => {
    view = await mount(createElement(PrepRoomPanel, { signedInContributorId: "alice" }));
    await type(input("#prep-room-topic"), "Trade");
    const task = () => input('input[placeholder="Add a task…"]');
    expect(button(view.container, "Add task").disabled).toBe(true);

    await type(task(), "Cut the tariff DA");
    await click(button(view.container, "Add task"));
    expect(text()).toContain("added by alice");
    expect(task().value).toBe("");

    await type(task(), "Write the perm block");
    await flush(() => {
      task().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(listPersistedChecklistItems("Trade")).toHaveLength(2);

    await click(input('input[aria-label="Mark \\"Cut the tariff DA\\" as done"]'));
    expect(text()).toContain("done by alice");
    expect(listPersistedChecklistItems("Trade").find((item) => item.text === "Cut the tariff DA")?.done).toBe(true);

    await click(button(view.container, "Remove"));
    expect(listPersistedChecklistItems("Trade")).toHaveLength(1);
  });

  it("marks you active in the room", async () => {
    view = await mount(createElement(PrepRoomPanel));
    await type(input("#prep-room-topic"), "Trade");
    expect(text()).toContain("No one active right now.");
    expect(button(view.container, "I'm active here").disabled).toBe(true);

    await type(input('input[placeholder="Your ID"]'), "bob");
    await click(button(view.container, "I'm active here"));
    expect(text()).toContain("Active now:");
    expect(text()).toContain("bob");
  });
});
