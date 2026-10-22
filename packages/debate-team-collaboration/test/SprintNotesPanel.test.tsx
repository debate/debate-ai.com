// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `SprintNotesPanel`: adding notes grouped by
 * topic, the signed-in prefill, cycling a note's status, assigning and
 * unassigning, and marking yourself active on a topic.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SprintNotesPanel } from "../src/panels/SprintNotesPanel";
import { listSprintNotes } from "../src/state/sprintNotes";
import { button } from "./helpers/dom";
import { click, mount, type, type Mounted } from "./helpers/mount";

let view: Mounted;
const text = () => view.container.textContent ?? "";
const field = (selector: string) => view.container.querySelector(selector) as HTMLInputElement;
const noteButton = (prefix: string) =>
  Array.from(view.container.querySelectorAll("button")).find((el) => el.textContent?.startsWith(prefix))!;

async function addNote(topic: string, author: string, note: string, assignee = "") {
  await type(field("#sprint-note-topic"), topic);
  if (author) await type(field("#sprint-note-author"), author);
  await type(field("#sprint-note-text") as unknown as HTMLTextAreaElement, note);
  if (assignee) await type(field("#sprint-note-assignee"), assignee);
  await click(button(view.container, "Add note"));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view.unmount();
});

describe("SprintNotesPanel", () => {
  it("requires topic, author and text", async () => {
    view = await mount(createElement(SprintNotesPanel));
    expect(text()).toContain("No sprint notes yet.");
    await addNote("solvency", "", "Need a card");
    expect(text()).toContain("Topic, author ID, and note text are all required.");
    expect(listSprintNotes()).toEqual([]);
  });

  it("adds notes grouped by topic and cycles their status", async () => {
    view = await mount(createElement(SprintNotesPanel));
    await addNote("solvency", "alice", "Need a 2026 solvency card", "bob");
    await addNote("solvency", "carol", "Find a counterplan");
    expect(text()).not.toContain("are all required");
    expect(text()).toContain("solvency(2)");
    expect(text()).toContain("by alice");
    expect(text()).toContain("assigned to bob");
    expect(text()).toContain("No one active right now.");
    expect(field("#sprint-note-topic").value).toBe("");

    const first = listSprintNotes().find((note) => note.authorId === "alice")!;
    expect(first).toMatchObject({ status: "open", assignedToId: "bob" });

    // open → covered → needs follow-up → open.
    expect(noteButton("Mark ").textContent).toBe("Mark covered");
    await click(noteButton("Mark "));
    expect(listSprintNotes().filter((note) => note.status === "covered")).toHaveLength(1);
    expect(text()).toContain("Mark needs follow-up");
  });

  it("assigns, reassigns and unassigns a note", async () => {
    view = await mount(createElement(SprintNotesPanel));
    await addNote("impacts", "alice", "Cut a war card");
    const assignee = () => view.container.querySelector('input[placeholder="Assign to…"]') as HTMLInputElement;

    await type(assignee(), "dave");
    await click(button(view.container, "Assign"));
    expect(text()).toContain("assigned to dave");
    expect(assignee().value).toBe("");

    await type(assignee(), "erin");
    await click(button(view.container, "Reassign"));
    expect(text()).toContain("assigned to erin");

    await click(button(view.container, "Unassign"));
    expect(text()).not.toContain("assigned to");
    expect(listSprintNotes()[0].assignedToId).toBeUndefined();
  });

  it("prefills your ids when signed in and marks you active on a topic", async () => {
    view = await mount(createElement(SprintNotesPanel, { signedInContributorId: "alice" }));
    expect(field("#sprint-note-author").value).toBe("alice");
    expect(field("#sprint-presence-id").value).toBe("alice");

    await addNote("framework", "", "Prep the util framework");
    expect(listSprintNotes()[0].authorId).toBe("alice");

    await click(button(view.container, "I'm active here"));
    expect(text()).toContain("Active now:");
    expect(text()).toContain("alice");

    await type(field("#sprint-presence-id"), "");
    expect(button(view.container, "I'm active here").disabled).toBe(true);
  });
});
