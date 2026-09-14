import { describe, expect, it } from "vitest";
import { groupFlowHistoryByDate } from "../src/state/flowHistoryGrouping";
import type { FlowHistory } from "../src/state/store";
import type { Flow } from "../src/types/flow";

const flow: Flow = {
  content: "1AC",
  level: 0,
  columns: ["1AC", "1NC"],
  invert: false,
  focus: false,
  index: 0,
  lastFocus: [0],
  children: [],
  id: 1,
};

function makeEntry(overrides: Partial<FlowHistory> = {}): FlowHistory {
  return {
    id: "1-1000",
    flow,
    timestamp: 1_700_000_000_000,
    label: "Untitled Flow",
    ...overrides,
  };
}

/** Same formatting `groupFlowHistoryByDate` uses, so tests don't hardcode a locale-specific string. */
function dateKeyFor(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

describe("groupFlowHistoryByDate", () => {
  it("returns no groups for an empty history", () => {
    expect(groupFlowHistoryByDate([])).toEqual([]);
  });

  it("puts same-day entries into one group, preserving their order", () => {
    const dayStart = new Date(2024, 0, 5, 9, 0, 0).getTime();
    const entryA = makeEntry({ id: "a", timestamp: dayStart + 2000 });
    const entryB = makeEntry({ id: "b", timestamp: dayStart });

    const groups = groupFlowHistoryByDate([entryA, entryB]);

    expect(groups).toHaveLength(1);
    expect(groups[0].dateKey).toBe(dateKeyFor(dayStart));
    expect(groups[0].entries.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("splits entries on different calendar days into separate groups, in input order", () => {
    const day1 = new Date(2024, 0, 5, 9, 0, 0).getTime();
    const day2 = new Date(2024, 0, 6, 9, 0, 0).getTime();
    const entryDay1 = makeEntry({ id: "day1", timestamp: day1 });
    const entryDay2 = makeEntry({ id: "day2", timestamp: day2 });

    // history is stored newest-first
    const groups = groupFlowHistoryByDate([entryDay2, entryDay1]);

    expect(groups.map((g) => g.dateKey)).toEqual([dateKeyFor(day2), dateKeyFor(day1)]);
    expect(groups[0].entries.map((e) => e.id)).toEqual(["day2"]);
    expect(groups[1].entries.map((e) => e.id)).toEqual(["day1"]);
  });

  it("re-groups an interleaved history back onto its day boundaries", () => {
    const day1 = new Date(2024, 0, 5, 9, 0, 0).getTime();
    const day2 = new Date(2024, 0, 6, 9, 0, 0).getTime();
    const entries = [
      makeEntry({ id: "day2-a", timestamp: day2 + 5000 }),
      makeEntry({ id: "day1-a", timestamp: day1 + 5000 }),
      makeEntry({ id: "day2-b", timestamp: day2 }),
      makeEntry({ id: "day1-b", timestamp: day1 }),
    ];

    const groups = groupFlowHistoryByDate(entries);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.dateKey === dateKeyFor(day2))?.entries.map((e) => e.id)).toEqual([
      "day2-a",
      "day2-b",
    ]);
    expect(groups.find((g) => g.dateKey === dateKeyFor(day1))?.entries.map((e) => e.id)).toEqual([
      "day1-a",
      "day1-b",
    ]);
  });
});
