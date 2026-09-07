import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCoverageSnapshots,
  listCoverageSnapshots,
  MAX_COVERAGE_SNAPSHOTS_PER_TOPIC,
  recordCoverageSnapshot,
} from "../src/state/topicCoverageSnapshots";
import { buildTopicCoverageReport } from "../src/lib/topic-coverage";
import type { CoverageCardSummary, TrackedArgument } from "../src/lib/topic-coverage";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default. */
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

const trackedArguments: TrackedArgument[] = [{ argBlock: "Warming DA" }, { argBlock: "States CP" }];
const warmingCards: CoverageCardSummary[] = [{ id: "warming-1", argBlock: "Warming DA", wordCount: 700 }];

function report(cards: CoverageCardSummary[] = warmingCards) {
  return buildTopicCoverageReport(trackedArguments, cards);
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("recordCoverageSnapshot", () => {
  it("assigns a fresh id and tallies the report's coverage counts", () => {
    const snapshot = recordCoverageSnapshot("Energy Policy", report(), 1000);
    expect(snapshot.id).toBeTruthy();
    expect(snapshot).toMatchObject({
      topic: "Energy Policy",
      createdAt: 1000,
      missing: 1,
      thin: 1,
      covered: 0,
      total: 2,
    });
  });

  it("assigns distinct ids to two snapshots recorded back to back", () => {
    const first = recordCoverageSnapshot("Energy Policy", report(), 1000);
    const second = recordCoverageSnapshot("Energy Policy", report(), 1000);
    expect(first.id).not.toBe(second.id);
  });

  it("keeps a separate history per topic", () => {
    recordCoverageSnapshot("Energy Policy", report(), 1000);
    recordCoverageSnapshot("Immigration Policy", report([]), 1000);
    expect(listCoverageSnapshots("Energy Policy")).toHaveLength(1);
    expect(listCoverageSnapshots("Immigration Policy")).toHaveLength(1);
  });

  it("trims the oldest snapshots for that topic once the per-topic cap is exceeded", () => {
    for (let i = 0; i < MAX_COVERAGE_SNAPSHOTS_PER_TOPIC + 5; i++) {
      recordCoverageSnapshot("Energy Policy", report(), i);
    }
    const history = listCoverageSnapshots("Energy Policy");
    expect(history).toHaveLength(MAX_COVERAGE_SNAPSHOTS_PER_TOPIC);
    expect(history.some((snapshot) => snapshot.createdAt < 5)).toBe(false);
  });

  it("doesn't trim another topic's history when one topic's cap is exceeded", () => {
    recordCoverageSnapshot("Immigration Policy", report([]), 0);
    for (let i = 1; i <= MAX_COVERAGE_SNAPSHOTS_PER_TOPIC + 5; i++) {
      recordCoverageSnapshot("Energy Policy", report(), i);
    }
    expect(listCoverageSnapshots("Immigration Policy")).toHaveLength(1);
  });
});

describe("listCoverageSnapshots", () => {
  it("returns an empty list when nothing has been recorded", () => {
    expect(listCoverageSnapshots("Energy Policy")).toEqual([]);
  });

  it("returns records oldest-first regardless of insertion order", () => {
    recordCoverageSnapshot("Energy Policy", report(), 3000);
    recordCoverageSnapshot("Energy Policy", report(), 1000);
    recordCoverageSnapshot("Energy Policy", report(), 2000);
    expect(listCoverageSnapshots("Energy Policy").map((s) => s.createdAt)).toEqual([1000, 2000, 3000]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("topicCoverageSnapshots", "{not json");
    expect(listCoverageSnapshots("Energy Policy")).toEqual([]);
  });
});

describe("clearCoverageSnapshots", () => {
  it("removes every snapshot for one topic", () => {
    recordCoverageSnapshot("Energy Policy", report(), 1000);
    recordCoverageSnapshot("Energy Policy", report(), 2000);
    clearCoverageSnapshots("Energy Policy");
    expect(listCoverageSnapshots("Energy Policy")).toEqual([]);
  });

  it("leaves other topics' histories untouched", () => {
    recordCoverageSnapshot("Energy Policy", report(), 1000);
    recordCoverageSnapshot("Immigration Policy", report([]), 1000);
    clearCoverageSnapshots("Energy Policy");
    expect(listCoverageSnapshots("Immigration Policy")).toHaveLength(1);
  });

  it("is a no-op when the topic has no recorded history", () => {
    expect(() => clearCoverageSnapshots("Energy Policy")).not.toThrow();
    expect(listCoverageSnapshots("Energy Policy")).toEqual([]);
  });
});
