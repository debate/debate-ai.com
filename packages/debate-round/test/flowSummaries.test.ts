import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteFlowSummary,
  getFlowSummary,
  listFlowSummaries,
  saveFlowSummary,
  type FlowSummaryRecord,
} from "../src/state/flowSummaries";

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

const SUMMARY_A: FlowSummaryRecord = {
  roundId: "round-1",
  summaries: [
    {
      rowIndex: 0,
      isHeading: false,
      argument: "Solvency deficit — the plan can't overcome bureaucratic inertia.",
      originSpeech: "1AC",
      entries: [
        { speech: "1AC", content: "Solvency deficit — the plan can't overcome bureaucratic inertia." },
        { speech: "1NC", content: "Turn: bureaucracy adapts faster than the aff assumes." },
      ],
      lastSpeech: "1NC",
      isUnanswered: true,
    },
  ],
};
const SUMMARY_B: FlowSummaryRecord = {
  roundId: "round-2",
  summaries: [
    {
      rowIndex: 0,
      isHeading: true,
      argument: "Contention 1: Economy",
      originSpeech: "1AC",
      entries: [{ speech: "1AC", content: "Contention 1: Economy" }],
      lastSpeech: "1AC",
      isUnanswered: false,
    },
  ],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listFlowSummaries", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listFlowSummaries()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("flowSummaries", "{not json");
    expect(listFlowSummaries()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("flowSummaries", JSON.stringify({ not: "an array" }));
    expect(listFlowSummaries()).toEqual([]);
  });

  it("lists every saved flow summary", () => {
    saveFlowSummary(SUMMARY_A);
    saveFlowSummary(SUMMARY_B);
    expect(listFlowSummaries()).toEqual([SUMMARY_A, SUMMARY_B]);
  });
});

describe("getFlowSummary", () => {
  it("finds a saved flow summary by roundId", () => {
    saveFlowSummary(SUMMARY_A);
    expect(getFlowSummary("round-1")).toEqual(SUMMARY_A);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getFlowSummary("missing")).toBeUndefined();
  });
});

describe("saveFlowSummary", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveFlowSummary(SUMMARY_A);
    const updated: FlowSummaryRecord = {
      ...SUMMARY_A,
      summaries: [
        ...SUMMARY_A.summaries,
        {
          rowIndex: 1,
          isHeading: false,
          argument: "Case turn: economy resilient.",
          originSpeech: "1NC",
          entries: [{ speech: "1NC", content: "Case turn: economy resilient." }],
          lastSpeech: "1NC",
          isUnanswered: true,
        },
      ],
    };
    saveFlowSummary(updated);

    expect(listFlowSummaries()).toEqual([updated]);
    expect(getFlowSummary("round-1")).toEqual(updated);
  });
});

describe("deleteFlowSummary", () => {
  it("removes a stored flow summary by roundId", () => {
    saveFlowSummary(SUMMARY_A);
    saveFlowSummary(SUMMARY_B);
    deleteFlowSummary("round-1");

    expect(listFlowSummaries()).toEqual([SUMMARY_B]);
    expect(getFlowSummary("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveFlowSummary(SUMMARY_B);
    deleteFlowSummary("missing");
    expect(listFlowSummaries()).toEqual([SUMMARY_B]);
  });
});
