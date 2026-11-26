/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DebateInstitutePanel } from "../../../src/components/coach/DebateInstitutePanel";
import { allByText, bodyText, button, change, click, cleanup, flush, installDomShims, mount, selectOption } from "../../helpers/dom";

beforeAll(() => installDomShims());
beforeEach(() => {
  // The seeded sessions are scheduled for mid-January 2026; pin "now" just before.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-14T09:00:00"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function openTab(label: string) {
  const tab = allByText(label, "[role=tab]")[0]!;
  act(() => {
    tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  });
}

const input = (id: string) => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
const stat = (label: string) => allByText(label, "p")[0]!.nextElementSibling!.textContent;

describe("DebateInstitutePanel overview", () => {
  it("summarises the seeded institute", () => {
    mount(<DebateInstitutePanel />);
    expect(bodyText()).toContain("Debate Institute");
    expect(stat("Total Students")).toBe("9");
    expect(stat("Upcoming Live Sessions")).toBe("4");
    expect(stat("Pending Assignments")).toBe("2");
    expect(stat("Upcoming Tournaments")).toBe("3");
  });

  it("lists at most three upcoming sessions and the assignments still open", () => {
    mount(<DebateInstitutePanel />);
    expect(bodyText()).toContain("Daily Lab Meeting - Team Alpha");
    expect(bodyText()).toContain("Daily Lab Meeting - Team Bravo");
    expect(bodyText()).not.toContain("Practice Round: Alpha vs Bravo");
    expect(bodyText()).toContain("Climate Change Aff Research");
    expect(bodyText()).not.toContain("K Answers File");
  });

  it("marks past sessions as recordings once their time has gone by", () => {
    vi.setSystemTime(new Date("2026-03-01T00:00:00"));
    mount(<DebateInstitutePanel />);
    expect(stat("Upcoming Live Sessions")).toBe("0");
    expect(bodyText()).toContain("No upcoming sessions");
    openTab("Live Sessions");
    expect(allByText("View Recording", "a")).toHaveLength(4);
    expect(allByText("Join", "a")).toHaveLength(0);
  });
});

describe("DebateInstitutePanel tabs", () => {
  it("shows every squad with its members", () => {
    mount(<DebateInstitutePanel />);
    openTab("Squads");
    expect(bodyText()).toContain("Team Alpha");
    expect(bodyText()).toContain("3 members");
    expect(bodyText()).toContain("Jordan");
  });

  it("shows lessons in day order and shows no completion badge for the coach", () => {
    mount(<DebateInstitutePanel />);
    openTab("Video Lessons");
    const titles = [...document.querySelectorAll("h4")].map((h) => h.textContent);
    expect(titles[0]).toBe("Introduction to Policy Debate");
    expect(titles.at(-1)).toBe("Rebuttal Mastery");
    expect(bodyText()).toContain("Day 3");
    expect(bodyText()).not.toContain("Completed");
  });

  it("shows sessions with a Join link to the meeting", () => {
    mount(<DebateInstitutePanel />);
    openTab("Live Sessions");
    const join = allByText("Join", "a")[0] as HTMLAnchorElement;
    expect(join.getAttribute("href")).toBe("https://meet.example.com/alpha");
    expect(join.getAttribute("target")).toBe("_blank");
    expect(join.getAttribute("rel")).toContain("noopener");
  });

  it("shows tournaments with their format and squads", () => {
    mount(<DebateInstitutePanel />);
    openTab("Tournaments");
    expect(bodyText()).toContain("Camp Championship");
    expect(bodyText()).toContain("Policy (6 rounds + elims)");
    expect(bodyText()).toContain("2026-01-31");
  });
});

describe("DebateInstitutePanel creating things", () => {
  it("adds a squad only when it has a name, with no members yet", async () => {
    mount(<DebateInstitutePanel />);
    openTab("Squads");
    click(button("New Squad"));
    await flush();
    expect(button("Create").disabled).toBe(true);
    change(input("squad-name"), "Team Delta");
    expect(button("Create").disabled).toBe(false);
    click(button("Create"));
    await flush();
    expect(bodyText()).toContain("Team Delta");
    expect(bodyText()).toContain("0 members");
  });

  it("cancels a dialog without adding anything", async () => {
    mount(<DebateInstitutePanel />);
    openTab("Squads");
    click(button("New Squad"));
    await flush();
    change(input("squad-name"), "Never Added");
    click(button("Cancel"));
    await flush();
    expect(bodyText()).not.toContain("Never Added");
  });

  it("adds a lesson, sorted into its day, with the squad left blank when none is chosen", async () => {
    mount(<DebateInstitutePanel />);
    openTab("Video Lessons");
    click(button("Add Lesson"));
    await flush();
    expect(button("Add Lesson", document.querySelector("[role=dialog]")!).disabled).toBe(true);
    change(input("lesson-title"), "Flowing Basics");
    change(input("lesson-description"), "How to flow a round");
    change(input("lesson-duration"), "30 min");
    change(input("lesson-day"), "1");
    click(button("Add Lesson", document.querySelector("[role=dialog]")!));
    await flush();
    const titles = [...document.querySelectorAll("h4")].map((h) => h.textContent);
    expect(titles).toContain("Flowing Basics");
    expect(titles.indexOf("Flowing Basics")).toBeLessThan(titles.indexOf("Affirmative Case Construction"));
    expect(bodyText()).toContain("30 min");
  });

  it("requires both a title and a squad for an assignment", async () => {
    mount(<DebateInstitutePanel />);
    openTab("Assignments");
    click(button("Add Assignment"));
    await flush();
    const dialog = () => document.querySelector("[role=dialog]")!;
    change(input("assignment-title"), "Case neg blocks");
    expect(button("Add Assignment", dialog()).disabled).toBe(true);
    selectOption(input("assignment-squad"), "Team Bravo");
    await flush();
    expect(button("Add Assignment", dialog()).disabled).toBe(false);
    change(input("assignment-due"), "2026-02-01");
    click(button("Add Assignment", dialog()));
    await flush();
    expect(bodyText()).toContain("Case neg blocks");
    expect(bodyText()).toContain("Due: 2026-02-01");
    expect(stat("Pending Assignments")).toBe("3");
  });

  it("schedules a session once it has a title, a time and a meeting link", async () => {
    mount(<DebateInstitutePanel />);
    openTab("Live Sessions");
    click(button("Schedule Session"));
    await flush();
    const dialog = () => document.querySelector("[role=dialog]")!;
    expect(button("Schedule", dialog()).disabled).toBe(true);
    change(input("session-title"), "Evening review");
    change(input("session-date"), "2026-01-20T18:00");
    expect(button("Schedule", dialog()).disabled).toBe(true);
    change(input("session-url"), "https://meet.example.com/evening");
    expect(button("Schedule", dialog()).disabled).toBe(false);
    click(button("Schedule", dialog()));
    await flush();
    expect(bodyText()).toContain("Evening review");
    expect(bodyText()).toContain("Host: Coach");
    expect(stat("Upcoming Live Sessions")).toBe("5");
  });

  it("creates a tournament from a name, a date and at least one squad", async () => {
    mount(<DebateInstitutePanel />);
    openTab("Tournaments");
    click(button("New Tournament"));
    await flush();
    const dialog = () => document.querySelector("[role=dialog]")!;
    change(input("tournament-name"), "Final Scrimmage");
    change(input("tournament-date"), "2026-02-14");
    expect(button("Create Tournament", dialog()).disabled).toBe(true);
    click(button("Team Alpha", dialog()));
    click(button("Team Charlie", dialog()));
    click(button("Team Charlie", dialog()));
    expect(button("Create Tournament", dialog()).disabled).toBe(false);
    click(button("Create Tournament", dialog()));
    await flush();
    expect(bodyText()).toContain("Final Scrimmage");
    expect(bodyText()).toContain("Policy (4 rounds)");
    expect(stat("Upcoming Tournaments")).toBe("4");
  });
});
