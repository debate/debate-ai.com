import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAndSaveDrillSet,
  buildDrillSetsPanelView,
  deleteDrillSet,
  getDrillSet,
  getDrillSetCompletionStats,
  getDueDrillIndexes,
  isDrillReviewDue,
  listDrillSets,
  saveDrillAiScript,
  saveDrillSet,
  scheduleDrillReview,
  toggleDrillCompletion,
  type DrillSetRecord,
} from "../src/state/drillSets";
import type { Box } from "../src/types/flow";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
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

const DRILL_SET_A: DrillSetRecord = {
  roundId: "round-1",
  sideKey: "aff",
  drills: [
    {
      kind: "overview",
      rowIndex: null,
      prompt: "Write a 2-minute overview weighing the round.",
      difficulty: "medium",
    },
    {
      kind: "frontline",
      rowIndex: 2,
      prompt: 'Write a frontline response to "solvency deficit".',
      difficulty: "hard",
    },
  ],
};
const DRILL_SET_B: DrillSetRecord = {
  roundId: "round-2",
  sideKey: "neg",
  drills: [
    {
      kind: "cross_ex",
      rowIndex: 0,
      prompt: "What evidence supports that claim?",
      difficulty: "easy",
    },
  ],
};

const COLUMNS = ["1AC", "1NC", "2AC", "2NC"];

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    const current: Box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
    box = current;
  }
  return { ...(box as Box), ...overrides };
}

const MIXED_FLOW = {
  columns: COLUMNS,
  children: [
    rowFromContents(["Case advantage", "Turn", "", ""]),
    rowFromContents(["", "Disad link", "Extend", "Frontline"]),
  ],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listDrillSets", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listDrillSets()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("drillSets", "{not json");
    expect(listDrillSets()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("drillSets", JSON.stringify({ not: "an array" }));
    expect(listDrillSets()).toEqual([]);
  });

  it("lists every saved drill set", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillSet(DRILL_SET_B);
    expect(listDrillSets()).toEqual([DRILL_SET_A, DRILL_SET_B]);
  });
});

describe("getDrillSet", () => {
  it("finds a saved drill set by roundId", () => {
    saveDrillSet(DRILL_SET_A);
    expect(getDrillSet("round-1")).toEqual(DRILL_SET_A);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getDrillSet("missing")).toBeUndefined();
  });
});

describe("saveDrillSet", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveDrillSet(DRILL_SET_A);
    const updated: DrillSetRecord = {
      ...DRILL_SET_A,
      drills: [
        ...DRILL_SET_A.drills,
        { kind: "collapse", rowIndex: 4, prompt: "Consider collapsing here.", difficulty: "easy" },
      ],
    };
    saveDrillSet(updated);

    expect(listDrillSets()).toEqual([updated]);
    expect(getDrillSet("round-1")).toEqual(updated);
  });
});

describe("buildAndSaveDrillSet", () => {
  it("derives a round's drill set from a flow and persists it", () => {
    const record = buildAndSaveDrillSet(MIXED_FLOW, "round-3", "A");

    expect(record.roundId).toBe("round-3");
    expect(record.sideKey).toBe("A");
    expect(record.drills.length).toBeGreaterThan(0);
    expect(getDrillSet("round-3")).toEqual(record);
  });

  it("overwrites any existing drill set for that roundId", () => {
    saveDrillSet(DRILL_SET_A);
    const record = buildAndSaveDrillSet(MIXED_FLOW, "round-1", "N");

    expect(listDrillSets()).toEqual([record]);
  });

  it("passes collapseLimit through to buildDrillSet", () => {
    const unlimited = buildAndSaveDrillSet(MIXED_FLOW, "round-4", "A");
    const limited = buildAndSaveDrillSet(MIXED_FLOW, "round-4", "A", { collapseLimit: 0 });

    const collapseCount = (drills: DrillSetRecord["drills"]) =>
      drills.filter((drill) => drill.kind === "collapse").length;
    expect(collapseCount(limited.drills)).toBeLessThan(collapseCount(unlimited.drills));
  });
});

describe("deleteDrillSet", () => {
  it("removes a stored drill set by roundId", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillSet(DRILL_SET_B);
    deleteDrillSet("round-1");

    expect(listDrillSets()).toEqual([DRILL_SET_B]);
    expect(getDrillSet("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveDrillSet(DRILL_SET_B);
    deleteDrillSet("missing");
    expect(listDrillSets()).toEqual([DRILL_SET_B]);
  });
});

describe("saveDrillAiScript", () => {
  it("sets aiScripts[drillIndex] on the stored record", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillAiScript("round-1", 0, "Here is the AI-generated overview script.");

    expect(getDrillSet("round-1")).toEqual({
      ...DRILL_SET_A,
      aiScripts: { 0: "Here is the AI-generated overview script." },
    });
  });

  it("overwrites an existing script for the same drill index", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillAiScript("round-1", 0, "First draft.");
    saveDrillAiScript("round-1", 0, "Regenerated draft.");

    expect(getDrillSet("round-1")?.aiScripts).toEqual({ 0: "Regenerated draft." });
  });

  it("keeps scripts for other drill indexes untouched", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillAiScript("round-1", 0, "Overview script.");
    saveDrillAiScript("round-1", 1, "Frontline script.");

    expect(getDrillSet("round-1")?.aiScripts).toEqual({ 0: "Overview script.", 1: "Frontline script." });
  });

  it("leaves other rounds' records untouched", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillSet(DRILL_SET_B);
    saveDrillAiScript("round-1", 0, "Overview script.");

    expect(getDrillSet("round-2")).toEqual(DRILL_SET_B);
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveDrillSet(DRILL_SET_B);
    saveDrillAiScript("missing", 0, "Script.");

    expect(listDrillSets()).toEqual([DRILL_SET_B]);
  });
});

describe("toggleDrillCompletion", () => {
  it("marks a drill completed on first toggle", () => {
    saveDrillSet(DRILL_SET_A);
    toggleDrillCompletion("round-1", 0);

    expect(getDrillSet("round-1")).toEqual({ ...DRILL_SET_A, completedDrillIndexes: [0] });
  });

  it("un-marks an already-completed drill on second toggle", () => {
    saveDrillSet(DRILL_SET_A);
    toggleDrillCompletion("round-1", 0);
    toggleDrillCompletion("round-1", 0);

    expect(getDrillSet("round-1")?.completedDrillIndexes).toEqual([]);
  });

  it("tracks multiple completed drills, sorted by index", () => {
    saveDrillSet(DRILL_SET_A);
    toggleDrillCompletion("round-1", 1);
    toggleDrillCompletion("round-1", 0);

    expect(getDrillSet("round-1")?.completedDrillIndexes).toEqual([0, 1]);
  });

  it("leaves drills and aiScripts untouched", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillAiScript("round-1", 0, "Overview script.");
    toggleDrillCompletion("round-1", 0);

    const record = getDrillSet("round-1");
    expect(record?.drills).toEqual(DRILL_SET_A.drills);
    expect(record?.aiScripts).toEqual({ 0: "Overview script." });
  });

  it("leaves other rounds' records untouched", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillSet(DRILL_SET_B);
    toggleDrillCompletion("round-1", 0);

    expect(getDrillSet("round-2")).toEqual(DRILL_SET_B);
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveDrillSet(DRILL_SET_B);
    toggleDrillCompletion("missing", 0);

    expect(listDrillSets()).toEqual([DRILL_SET_B]);
  });

  it("is a no-op when drillIndex is out of range for that record", () => {
    saveDrillSet(DRILL_SET_A);
    toggleDrillCompletion("round-1", 99);
    toggleDrillCompletion("round-1", -1);

    expect(getDrillSet("round-1")).toEqual(DRILL_SET_A);
  });
});

describe("scheduleDrillReview", () => {
  it("sets scheduledReviewAt[drillIndex] on the stored record", () => {
    saveDrillSet(DRILL_SET_A);
    scheduleDrillReview("round-1", 0, "2026-09-10");

    expect(getDrillSet("round-1")).toEqual({
      ...DRILL_SET_A,
      scheduledReviewAt: { 0: "2026-09-10" },
    });
  });

  it("overwrites an existing schedule for the same drill index", () => {
    saveDrillSet(DRILL_SET_A);
    scheduleDrillReview("round-1", 0, "2026-09-10");
    scheduleDrillReview("round-1", 0, "2026-09-17");

    expect(getDrillSet("round-1")?.scheduledReviewAt).toEqual({ 0: "2026-09-17" });
  });

  it("clears a drill's schedule when dayKey is null", () => {
    saveDrillSet(DRILL_SET_A);
    scheduleDrillReview("round-1", 0, "2026-09-10");
    scheduleDrillReview("round-1", 0, null);

    expect(getDrillSet("round-1")?.scheduledReviewAt).toEqual({});
  });

  it("keeps schedules for other drill indexes untouched", () => {
    saveDrillSet(DRILL_SET_A);
    scheduleDrillReview("round-1", 0, "2026-09-10");
    scheduleDrillReview("round-1", 1, "2026-09-12");

    expect(getDrillSet("round-1")?.scheduledReviewAt).toEqual({
      0: "2026-09-10",
      1: "2026-09-12",
    });
  });

  it("leaves drills, aiScripts, and completedDrillIndexes untouched", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillAiScript("round-1", 0, "Overview script.");
    toggleDrillCompletion("round-1", 1);
    scheduleDrillReview("round-1", 0, "2026-09-10");

    const record = getDrillSet("round-1");
    expect(record?.drills).toEqual(DRILL_SET_A.drills);
    expect(record?.aiScripts).toEqual({ 0: "Overview script." });
    expect(record?.completedDrillIndexes).toEqual([1]);
  });

  it("leaves other rounds' records untouched", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillSet(DRILL_SET_B);
    scheduleDrillReview("round-1", 0, "2026-09-10");

    expect(getDrillSet("round-2")).toEqual(DRILL_SET_B);
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveDrillSet(DRILL_SET_B);
    scheduleDrillReview("missing", 0, "2026-09-10");

    expect(listDrillSets()).toEqual([DRILL_SET_B]);
  });

  it("is a no-op when drillIndex is out of range for that record", () => {
    saveDrillSet(DRILL_SET_A);
    scheduleDrillReview("round-1", 99, "2026-09-10");
    scheduleDrillReview("round-1", -1, "2026-09-10");

    expect(getDrillSet("round-1")).toEqual(DRILL_SET_A);
  });
});

describe("isDrillReviewDue", () => {
  it("is false when no schedule is set", () => {
    expect(isDrillReviewDue(undefined, "2026-09-10")).toBe(false);
  });

  it("is true when the scheduled day is today", () => {
    expect(isDrillReviewDue("2026-09-10", "2026-09-10")).toBe(true);
  });

  it("is true when the scheduled day is in the past", () => {
    expect(isDrillReviewDue("2026-09-01", "2026-09-10")).toBe(true);
  });

  it("is false when the scheduled day is in the future", () => {
    expect(isDrillReviewDue("2026-09-20", "2026-09-10")).toBe(false);
  });
});

describe("getDueDrillIndexes", () => {
  it("returns an empty list when nothing is scheduled", () => {
    expect(getDueDrillIndexes(DRILL_SET_A, "2026-09-10")).toEqual([]);
  });

  it("returns only drills whose scheduled day has arrived, sorted ascending", () => {
    const record = {
      ...DRILL_SET_A,
      scheduledReviewAt: { 1: "2026-09-01", 0: "2026-09-20" },
    };
    expect(getDueDrillIndexes(record, "2026-09-10")).toEqual([1]);
  });

  it("returns every due index once every scheduled drill has arrived", () => {
    const record = {
      ...DRILL_SET_A,
      scheduledReviewAt: { 0: "2026-09-01", 1: "2026-09-05" },
    };
    expect(getDueDrillIndexes(record, "2026-09-10")).toEqual([0, 1]);
  });

  it("ignores an out-of-range scheduled index", () => {
    const record = { ...DRILL_SET_A, scheduledReviewAt: { 0: "2026-09-01", 99: "2026-09-01" } };
    expect(getDueDrillIndexes(record, "2026-09-10")).toEqual([0]);
  });
});

describe("getDrillSetCompletionStats", () => {
  it("returns zero completed and a zero ratio for a record with no completedDrillIndexes", () => {
    expect(getDrillSetCompletionStats(DRILL_SET_A)).toEqual({ completed: 0, total: 2, ratio: 0 });
  });

  it("counts a partial completion", () => {
    expect(
      getDrillSetCompletionStats({ ...DRILL_SET_A, completedDrillIndexes: [0] }),
    ).toEqual({ completed: 1, total: 2, ratio: 0.5 });
  });

  it("counts full completion", () => {
    expect(
      getDrillSetCompletionStats({ ...DRILL_SET_A, completedDrillIndexes: [0, 1] }),
    ).toEqual({ completed: 2, total: 2, ratio: 1 });
  });

  it("ignores out-of-range indexes rather than over-counting", () => {
    expect(
      getDrillSetCompletionStats({ ...DRILL_SET_A, completedDrillIndexes: [0, 99] }),
    ).toEqual({ completed: 1, total: 2, ratio: 0.5 });
  });

  it("returns a zero ratio (not NaN) for a record with no drills", () => {
    expect(getDrillSetCompletionStats({ drills: [] })).toEqual({ completed: 0, total: 0, ratio: 0 });
  });
});

describe("buildDrillSetsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildDrillSetsPanelView()).toEqual([]);
  });

  it("sorts persisted drill sets by roundId", () => {
    saveDrillSet(DRILL_SET_B);
    saveDrillSet(DRILL_SET_A);
    expect(buildDrillSetsPanelView()).toEqual([DRILL_SET_A, DRILL_SET_B]);
  });

  it("saving a drill set for an existing roundId under a new sideKey still upserts by roundId alone", () => {
    saveDrillSet(DRILL_SET_A);
    const negForRoundOne: DrillSetRecord = { ...DRILL_SET_A, sideKey: "neg" };
    saveDrillSet(negForRoundOne);
    expect(buildDrillSetsPanelView()).toEqual([negForRoundOne]);
  });
});
