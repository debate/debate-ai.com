import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAndSaveDrillSet,
  buildDrillSetsPanelView,
  deleteDrillSet,
  getDrillSet,
  listDrillSets,
  saveDrillAiScript,
  saveDrillSet,
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
