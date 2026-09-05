import { describe, expect, it } from "vitest";
import type { GroupChallenge } from "debate-team-collaboration/src/lib/group-challenges";
import type { SprintNote } from "debate-team-collaboration/src/lib/team-collaboration-mode";
import {
  buildCoachingProgramCalendarEvents,
  groupCoachingProgramCalendarEventsByDay,
} from "../src/lib/coaching-program-calendar";

function challenge(overrides: Partial<GroupChallenge>): GroupChallenge {
  return {
    id: "c1",
    title: "Find 20 solvency cards",
    goal: { kind: "win_target", targetCount: 20 },
    memberIds: ["alice", "bob"],
    startsAt: Date.UTC(2026, 8, 1),
    endsAt: Date.UTC(2026, 8, 8),
    ...overrides,
  };
}

function note(overrides: Partial<SprintNote>): SprintNote {
  return {
    id: "n1",
    topic: "Warming",
    authorId: "alice",
    text: "Need more impact cards on sea-level rise.",
    status: "open",
    createdAt: Date.UTC(2026, 8, 3),
    updatedAt: Date.UTC(2026, 8, 3),
    ...overrides,
  };
}

describe("buildCoachingProgramCalendarEvents", () => {
  it("returns an empty schedule for no challenges and no notes", () => {
    expect(buildCoachingProgramCalendarEvents(["alice"], [], [])).toEqual([]);
  });

  it("emits a start and end event for a roster-scoped challenge", () => {
    const events = buildCoachingProgramCalendarEvents(["alice", "bob"], [challenge({})], []);
    expect(events).toEqual([
      { dayKey: "2026-09-01", kind: "challenge-start", label: '"Find 20 solvency cards" challenge starts' },
      { dayKey: "2026-09-08", kind: "challenge-end", label: '"Find 20 solvency cards" challenge ends' },
    ]);
  });

  it("excludes a challenge whose roster has no member in common with the program roster", () => {
    const events = buildCoachingProgramCalendarEvents(["carol"], [challenge({ memberIds: ["alice", "bob"] })], []);
    expect(events).toEqual([]);
  });

  it("includes a challenge scoped to only part of the program roster", () => {
    const events = buildCoachingProgramCalendarEvents(
      ["alice", "carol"],
      [challenge({ memberIds: ["alice", "bob"] })],
      [],
    );
    expect(events).toHaveLength(2);
  });

  it("emits one event per sprint note, with a text preview", () => {
    const events = buildCoachingProgramCalendarEvents(["alice"], [], [note({})]);
    expect(events).toEqual([
      {
        dayKey: "2026-09-03",
        kind: "sprint-note",
        label: 'alice logged a "Warming" note',
        detail: "Need more impact cards on sea-level rise.",
      },
    ]);
  });

  it("truncates a long note's text preview with an ellipsis", () => {
    const longText = "x".repeat(200);
    const events = buildCoachingProgramCalendarEvents(["alice"], [], [note({ text: longText })]);
    expect(events[0].detail).toBe(`${"x".repeat(80)}…`);
  });

  it("sorts every event chronologically across challenges and notes, earliest first", () => {
    const events = buildCoachingProgramCalendarEvents(
      ["alice", "bob"],
      [challenge({ id: "c1", startsAt: Date.UTC(2026, 8, 5), endsAt: Date.UTC(2026, 8, 10) })],
      [note({ id: "n1", createdAt: Date.UTC(2026, 8, 2) }), note({ id: "n2", createdAt: Date.UTC(2026, 8, 12) })],
    );
    expect(events.map((event) => event.dayKey)).toEqual(["2026-09-02", "2026-09-05", "2026-09-10", "2026-09-12"]);
  });

  it("orders same-day events by kind then label for a stable tiebreak", () => {
    const sameDay = Date.UTC(2026, 8, 5);
    const events = buildCoachingProgramCalendarEvents(
      ["alice"],
      [challenge({ id: "c1", startsAt: sameDay, endsAt: sameDay, title: "B challenge" })],
      [note({ id: "n1", createdAt: sameDay })],
    );
    expect(events.map((event) => event.kind)).toEqual(["challenge-end", "challenge-start", "sprint-note"]);
  });
});

describe("groupCoachingProgramCalendarEventsByDay", () => {
  it("returns an empty list for no events", () => {
    expect(groupCoachingProgramCalendarEventsByDay([])).toEqual([]);
  });

  it("buckets events sharing a day into one entry, in chronological day order", () => {
    const events = buildCoachingProgramCalendarEvents(
      ["alice"],
      [challenge({ startsAt: Date.UTC(2026, 8, 1), endsAt: Date.UTC(2026, 8, 1) })],
      [note({ createdAt: Date.UTC(2026, 7, 20) })],
    );
    const grouped = groupCoachingProgramCalendarEventsByDay(events);
    expect(grouped.map((day) => day.dayKey)).toEqual(["2026-08-20", "2026-09-01"]);
    expect(grouped[1].events).toHaveLength(2);
  });
});
