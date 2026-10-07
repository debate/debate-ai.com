import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDayAgenda,
  buildMemberLoad,
  buildMonthGrid,
  buildTeamCalendarItem,
  buildTournamentPairings,
  countItemsByDate,
  isTeamCalendarItemComplete,
  isTeamCalendarItemOverdue,
  itemsForGroup,
  parseIsoDate,
  shiftMonth,
  toggleTeamCalendarCompletion,
  upcomingDeadlines,
  type TeamCalendarItem,
  type TeamCalendarItemDraft,
} from "../src/lib/team-calendar";
import {
  TEAM_CALENDAR_STORAGE_KEY,
  deleteTeamCalendarItem,
  isTeamCalendarLiveUpdateStorageEvent,
  listTeamCalendarItems,
  saveTeamCalendarItem,
} from "../src/state/teamCalendar";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const GROUP = { id: "novices", memberIds: ["alice", "bob", "carol"] };

function draft(overrides: Partial<TeamCalendarItemDraft> = {}): TeamCalendarItemDraft {
  return { kind: "task", title: "Cut aff cards", date: "2026-10-06", assigneeIds: ["alice"], ...overrides };
}

function build(overrides: Partial<TeamCalendarItemDraft> = {}, id = "t1"): TeamCalendarItem {
  const result = buildTeamCalendarItem(draft(overrides), GROUP, { id, now: 1 });
  if (!result.ok) throw new Error(result.error);
  return result.item;
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildMonthGrid", () => {
  it("lays October 2026 out Sunday-first in six weeks, padding from Sep and Nov", () => {
    const weeks = buildMonthGrid(2026, 9);
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0].map((d) => d.day)).toEqual([27, 28, 29, 30, 1, 2, 3]);
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][4]).toEqual({ iso: "2026-10-01", day: 1, inMonth: true });
    expect(weeks[5].map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weeks[5][0].iso).toBe("2026-11-01");
  });
});

describe("dates", () => {
  it("rejects impossible dates", () => {
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("nope")).toBeNull();
    expect(parseIsoDate("2026-10-06")?.getDate()).toBe(6);
  });

  it("steps months across a year boundary", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("buildTeamCalendarItem", () => {
  it("builds a task for roster members", () => {
    const item = build({ assigneeIds: ["alice", "alice", " bob "], time: "14:00", notes: "  " });
    expect(item).toMatchObject({ groupId: "novices", assigneeIds: ["alice", "bob"], time: "14:00", completedBy: [] });
    expect(item.notes).toBeUndefined();
  });

  it("refuses assignees outside the group's roster", () => {
    const result = buildTeamCalendarItem(draft({ assigneeIds: ["alice", "mallory"] }), GROUP, { id: "x", now: 1 });
    expect(result).toEqual({ ok: false, error: "Not on this group's roster: mallory." });
  });

  it("requires a title, a real date, a valid time and an assignee", () => {
    const fail = (o: Partial<TeamCalendarItemDraft>) => buildTeamCalendarItem(draft(o), GROUP, { id: "x", now: 1 }).ok;
    expect(fail({ title: "  " })).toBe(false);
    expect(fail({ date: "2026-13-01" })).toBe(false);
    expect(fail({ time: "25:00" })).toBe(false);
    expect(fail({ assigneeIds: [] })).toBe(false);
  });

  it("enters the whole roster in a tournament by default and bounds its rounds", () => {
    const item = build({ kind: "tournament", assigneeIds: [], format: "LD", rounds: 3 });
    expect(item.assigneeIds).toEqual(GROUP.memberIds);
    expect(item.tournament).toEqual({ format: "LD", rounds: 3 });
    expect(buildTeamCalendarItem(draft({ kind: "tournament", rounds: 99 }), GROUP, { id: "x", now: 1 }).ok).toBe(false);
    expect(
      buildTeamCalendarItem(draft({ kind: "tournament", assigneeIds: ["alice"] }), GROUP, { id: "x", now: 1 }).ok,
    ).toBe(false);
  });
});

describe("completion and deadlines", () => {
  it("is complete only once every assignee is done, and toggles ignore non-assignees", () => {
    let item = build({ assigneeIds: ["alice", "bob"] });
    item = toggleTeamCalendarCompletion(item, "alice");
    expect(isTeamCalendarItemComplete(item)).toBe(false);
    expect(toggleTeamCalendarCompletion(item, "carol")).toBe(item);
    item = toggleTeamCalendarCompletion(item, "bob");
    expect(isTeamCalendarItemComplete(item)).toBe(true);
    expect(toggleTeamCalendarCompletion(item, "bob").completedBy).toEqual(["alice"]);
  });

  it("flags unfinished past-due work as overdue, never tournaments", () => {
    expect(isTeamCalendarItemOverdue(build({ date: "2026-10-01" }), "2026-10-07")).toBe(true);
    expect(isTeamCalendarItemOverdue(build({ date: "2026-10-07" }), "2026-10-07")).toBe(false);
    expect(isTeamCalendarItemOverdue(build({ kind: "tournament", assigneeIds: [], date: "2026-10-01" }), "2026-10-07")).toBe(false);
  });

  it("lists open deadlines earliest first and skips finished work and tournaments", () => {
    const later = build({ date: "2026-10-20", title: "Later" }, "a");
    const earlier = build({ date: "2026-10-02", title: "Earlier" }, "b");
    const done = toggleTeamCalendarCompletion(build({ date: "2026-10-01" }, "c"), "alice");
    const tourney = build({ kind: "tournament", assigneeIds: [] }, "d");
    expect(upcomingDeadlines([later, done, tourney, earlier]).map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("sums per-member open, overdue and done work", () => {
    const items = [
      toggleTeamCalendarCompletion(build({ assigneeIds: ["alice", "bob"], date: "2026-10-01" }, "a"), "alice"),
      build({ assigneeIds: ["alice"], date: "2026-10-30" }, "b"),
    ];
    expect(buildMemberLoad(items, ["alice", "bob"], "2026-10-07")).toEqual([
      { memberId: "alice", open: 1, done: 1, overdue: 0 },
      { memberId: "bob", open: 0, done: 0, overdue: 1 },
    ]);
  });
});

describe("agenda", () => {
  it("splits a day by kind in time order and counts markers per date", () => {
    const items = [
      build({ title: "B", time: "15:00" }, "1"),
      build({ title: "A", time: "09:00" }, "2"),
      build({ kind: "assignment", title: "Essay" }, "3"),
      build({ title: "Other day", date: "2026-10-07" }, "4"),
    ];
    const agenda = buildDayAgenda(items, "2026-10-06");
    expect(agenda.task.map((i) => i.title)).toEqual(["A", "B"]);
    expect(agenda.assignment).toHaveLength(1);
    expect(agenda.tournament).toHaveLength(0);
    expect(countItemsByDate(items).get("2026-10-06")).toEqual({ task: 2, assignment: 1, tournament: 0 });
  });

  it("keeps one group's entries away from another's", () => {
    const mine = build({}, "1");
    const theirs = { ...build({}, "2"), groupId: "varsity" };
    expect(itemsForGroup([mine, theirs], "novices")).toEqual([mine]);
  });
});

describe("buildTournamentPairings", () => {
  it("round-robins an even group so nobody meets twice", () => {
    const rounds = buildTournamentPairings(["a", "b", "c", "d"], 8);
    expect(rounds).toHaveLength(3);
    const seen = new Set<string>();
    for (const round of rounds) {
      expect(round).toHaveLength(2);
      for (const [x, y] of round) {
        const key = [x, y].sort().join("-");
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("gives one bye per round to an odd group", () => {
    const rounds = buildTournamentPairings(["a", "b", "c"], 2);
    expect(rounds).toHaveLength(2);
    for (const round of rounds) expect(round.filter(([, b]) => b === null)).toHaveLength(1);
  });
});

describe("state/teamCalendar", () => {
  it("saves, overwrites, lists and deletes entries", () => {
    const item = build();
    saveTeamCalendarItem(item);
    saveTeamCalendarItem({ ...item, title: "Renamed" });
    expect(listTeamCalendarItems()).toEqual([{ ...item, title: "Renamed" }]);
    deleteTeamCalendarItem(item.id);
    expect(listTeamCalendarItems()).toEqual([]);
  });

  it("drops corrupt or malformed stored data", () => {
    localStorage.setItem(TEAM_CALENDAR_STORAGE_KEY, "{bad");
    expect(listTeamCalendarItems()).toEqual([]);
    localStorage.setItem(TEAM_CALENDAR_STORAGE_KEY, JSON.stringify([{ id: 1 }, build()]));
    expect(listTeamCalendarItems()).toHaveLength(1);
  });

  it("live-updates on the calendar and group stores only", () => {
    expect(isTeamCalendarLiveUpdateStorageEvent({ key: TEAM_CALENDAR_STORAGE_KEY })).toBe(true);
    expect(isTeamCalendarLiveUpdateStorageEvent({ key: "coachingPrograms" })).toBe(true);
    expect(isTeamCalendarLiveUpdateStorageEvent({ key: null })).toBe(true);
    expect(isTeamCalendarLiveUpdateStorageEvent({ key: "prepNotes" })).toBe(false);
  });
});
