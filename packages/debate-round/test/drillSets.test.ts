import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDrillSetsPanelView,
  deleteDrillSet,
  getDrillSet,
  listDrillSets,
  saveDrillSet,
  type DrillSetRecord,
} from "../src/state/drillSets";

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
    { kind: "overview", rowIndex: null, prompt: "Write a 2-minute overview weighing the round." },
    { kind: "frontline", rowIndex: 2, prompt: 'Write a frontline response to "solvency deficit".' },
  ],
};
const DRILL_SET_B: DrillSetRecord = {
  roundId: "round-2",
  sideKey: "neg",
  drills: [{ kind: "cross_ex", rowIndex: 0, prompt: "What evidence supports that claim?" }],
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
      drills: [...DRILL_SET_A.drills, { kind: "collapse", rowIndex: 4, prompt: "Consider collapsing here." }],
    };
    saveDrillSet(updated);

    expect(listDrillSets()).toEqual([updated]);
    expect(getDrillSet("round-1")).toEqual(updated);
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
