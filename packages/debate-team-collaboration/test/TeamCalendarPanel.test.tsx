// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `TeamCalendarPanel`: adding a coaching
 * group, scheduling tasks and tournaments on the selected day, ticking off
 * assignees, overdue deadlines and jumping to them, workload, month
 * navigation and removing an entry.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TeamCalendarPanel } from "../src/panels/TeamCalendarPanel";
import { listCoachingPrograms, saveCoachingProgram } from "../src/state/coachingPrograms";
import { listTeamCalendarItems, saveTeamCalendarItem } from "../src/state/teamCalendar";
import { buildTeamCalendarItem, formatMonthLabel, toIsoDate } from "../src/lib/team-calendar";
import { button, choose } from "./helpers/dom";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

let view: Mounted;
const text = () => view.container.textContent ?? "";
const field = (selector: string) => view.container.querySelector(selector) as HTMLInputElement;
const GROUP = { id: "g1", name: "Novices", memberIds: ["alice", "bob", "carol"] };

async function schedule(kind: "Task" | "Assignment" | "Tournament", title: string, assignees: string[] = []) {
  await click(button(view.container, kind));
  await type(field("#team-calendar-title"), title);
  for (const who of assignees) await click(button(view.container, who));
  await click(button(view.container, `Schedule ${kind.toLowerCase()}`));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view.unmount();
});

describe("TeamCalendarPanel", () => {
  it("validates and adds a coaching group", async () => {
    view = await mount(createElement(TeamCalendarPanel));
    expect(text()).toContain("No coaching groups yet.");
    expect(text()).toContain("No groups yet");

    await type(field("#team-calendar-new-group"), "Novices");
    await click(button(view.container, "Add group"));
    expect(text()).toContain("A group name and at least one researcher are required.");

    await type(field("#team-calendar-new-group-members"), "alice, bob, alice");
    await click(button(view.container, "Add group"));
    expect(listCoachingPrograms()[0].memberIds).toEqual(["alice", "bob"]);
    expect(text()).toContain("Novices (2)");
    expect(text()).toContain("Schedule");
    expect(text()).toContain("No tasks on this day.");
  });

  it("schedules a task for today and ticks off its assignees", async () => {
    saveCoachingProgram(GROUP);
    view = await mount(createElement(TeamCalendarPanel));

    await click(button(view.container, "Schedule task"));
    expect(text()).toContain("A title is required.");
    await type(field("#team-calendar-title"), "Update the neg file");
    await click(button(view.container, "Schedule task"));
    expect(text()).toContain("Assign at least one roster member.");

    await type(field("#team-calendar-time"), "15:30");
    await type(field("#team-calendar-notes"), "Use the new cards");
    await click(button(view.container, "Everyone"));
    await click(button(view.container, "Schedule task"));
    expect(text()).not.toContain("Assign at least one roster member.");
    expect(text()).toContain("Update the neg file");
    expect(text()).toContain("3:30 PM · 0/3 done");
    expect(text()).toContain("Use the new cards");

    const boxes = () => Array.from(view.container.querySelectorAll<HTMLInputElement>('li input[type="checkbox"]'));
    for (const box of boxes()) await click(box);
    expect(listTeamCalendarItems()[0].completedBy.sort()).toEqual(["alice", "bob", "carol"]);
    expect(text()).toContain("3/3 done");
    expect(text()).toContain("Done");
    expect(text()).toContain("Nothing due.");

    await click(view.container.querySelector('button[aria-label="Remove Update the neg file"]')!);
    expect(listTeamCalendarItems()).toEqual([]);
  });

  it("schedules a tournament with round-robin pairings", async () => {
    saveCoachingProgram(GROUP);
    view = await mount(createElement(TeamCalendarPanel));

    await click(button(view.container, "Tournament"));
    await flush(() => choose(field("#team-calendar-format") as unknown as HTMLSelectElement, "LD"));
    await type(field("#team-calendar-rounds"), "2");
    await schedule("Tournament", "Squad scrimmage");
    expect(text()).toContain("LD · 2 rounds · 3 entrants");
    expect(text()).toContain("Round 1:");
    expect(text()).toContain("(bye)");

    await click(button(view.container, "Tournament"));
    await type(field("#team-calendar-rounds"), "0");
    await schedule("Tournament", "Too short");
    expect(text()).toMatch(/Rounds must be 1–\d+\./);
  });

  it("lists overdue deadlines with workload and jumps to them", async () => {
    saveCoachingProgram(GROUP);
    const past = new Date();
    past.setDate(past.getDate() - 40);
    const result = buildTeamCalendarItem(
      { kind: "assignment", title: "Cut aff cards", date: toIsoDate(past), assigneeIds: ["alice"] },
      GROUP,
      { id: "a1", now: Date.now() },
    );
    if (!result.ok) throw new Error(result.error);
    saveTeamCalendarItem(result.item);
    view = await mount(createElement(TeamCalendarPanel));

    expect(text()).toContain("Overdue · ");
    const workload = Array.from(view.container.querySelectorAll("tr")).find((row) => row.textContent?.startsWith("alice"));
    // Researcher · Open · Overdue · Done
    expect(workload?.textContent).toBe("alice" + "0" + "1" + "0");

    const deadline = Array.from(view.container.querySelectorAll("button")).find((el) =>
      el.textContent?.includes("Cut aff cards"),
    )!;
    await click(deadline);
    expect(text()).toContain(formatMonthLabel(past.getFullYear(), past.getMonth()));
    expect(text()).toContain("0/1 done");
    expect(text()).toContain("Overdue");
  });

  it("moves between months", async () => {
    saveCoachingProgram(GROUP);
    view = await mount(createElement(TeamCalendarPanel));
    const now = new Date();
    expect(text()).toContain(formatMonthLabel(now.getFullYear(), now.getMonth()));

    await click(view.container.querySelector('button[aria-label="Next month"]')!);
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    expect(text()).toContain(formatMonthLabel(next.getFullYear(), next.getMonth()));

    await click(view.container.querySelector('button[aria-label="Previous month"]')!);
    await click(view.container.querySelector('button[aria-label="Previous month"]')!);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    expect(text()).toContain(formatMonthLabel(prev.getFullYear(), prev.getMonth()));

    const firstCell = view.container.querySelector('button[role="gridcell"]') as HTMLButtonElement;
    await click(firstCell);
    expect(firstCell.getAttribute("aria-selected")).toBe("true");
  });
});
