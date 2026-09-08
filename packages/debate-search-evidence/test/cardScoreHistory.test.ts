import { beforeEach, describe, expect, it } from "vitest";
import {
  appendCardScoreHistoryEntry,
  listCardScoreHistory,
  listCardScoreHistoryContributorIds,
  listCardScoreHistoryForContributor,
} from "../src/state/cardScoreHistory";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listCardScoreHistory", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCardScoreHistory()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("cardScoreHistory", "{not json");
    expect(listCardScoreHistory()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("cardScoreHistory", JSON.stringify({ not: "an array" }));
    expect(listCardScoreHistory()).toEqual([]);
  });

  it("lists every appended entry ordered oldest to newest, regardless of append order", () => {
    appendCardScoreHistoryEntry("card-2", "bob", 60, "2026-01-02T00:00:00.000Z");
    appendCardScoreHistoryEntry("card-1", "alice", 70, "2026-01-01T00:00:00.000Z");
    expect(listCardScoreHistory().map((entry) => entry.cardId)).toEqual(["card-1", "card-2"]);
  });
});

describe("appendCardScoreHistoryEntry", () => {
  it("appends rather than overwriting a prior entry for the same card", () => {
    appendCardScoreHistoryEntry("card-1", "alice", 50, "2026-01-01T00:00:00.000Z");
    appendCardScoreHistoryEntry("card-1", "alice", 80, "2026-01-02T00:00:00.000Z");

    const history = listCardScoreHistoryForContributor("alice");
    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.overallScore)).toEqual([50, 80]);
  });

  it("assigns each entry a distinct id", () => {
    const first = appendCardScoreHistoryEntry("card-1", "alice", 50, "2026-01-01T00:00:00.000Z");
    const second = appendCardScoreHistoryEntry("card-1", "alice", 80, "2026-01-01T00:00:00.000Z");
    expect(first.id).not.toBe(second.id);
  });

  it("defaults scoredAt to the current time when omitted", () => {
    const before = Date.now();
    const entry = appendCardScoreHistoryEntry("card-1", "alice", 50);
    expect(Date.parse(entry.scoredAt)).toBeGreaterThanOrEqual(before);
  });
});

describe("listCardScoreHistoryForContributor", () => {
  it("lists only entries attributed to the given contributor, oldest first", () => {
    appendCardScoreHistoryEntry("card-1", "alice", 70, "2026-01-01T00:00:00.000Z");
    appendCardScoreHistoryEntry("card-2", "bob", 60, "2026-01-01T12:00:00.000Z");
    appendCardScoreHistoryEntry("card-1", "alice", 90, "2026-01-02T00:00:00.000Z");

    expect(listCardScoreHistoryForContributor("alice").map((entry) => entry.overallScore)).toEqual([70, 90]);
    expect(listCardScoreHistoryForContributor("bob").map((entry) => entry.overallScore)).toEqual([60]);
  });

  it("returns an empty list for a contributor with no recorded history", () => {
    expect(listCardScoreHistoryForContributor("missing")).toEqual([]);
  });
});

describe("listCardScoreHistoryContributorIds", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCardScoreHistoryContributorIds()).toEqual([]);
  });

  it("returns every distinct contributor id, sorted alphabetically", () => {
    appendCardScoreHistoryEntry("card-1", "bob", 70);
    appendCardScoreHistoryEntry("card-2", "alice", 60);
    appendCardScoreHistoryEntry("card-3", "bob", 80);

    expect(listCardScoreHistoryContributorIds()).toEqual(["alice", "bob"]);
  });
});
