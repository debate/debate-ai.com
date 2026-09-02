import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllSeenBadges,
  getSeenBadges,
  markBadgesSeen,
  recordAndGetNewlyEarnedBadges,
} from "../src/state/unlockCelebrations";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("getSeenBadges / markBadgesSeen", () => {
  it("returns undefined for a contributor never recorded", () => {
    expect(getSeenBadges("alice")).toBeUndefined();
  });

  it("returns the last recorded badge list", () => {
    markBadgesSeen("alice", ["Rising Researcher"]);
    expect(getSeenBadges("alice")).toEqual(["Rising Researcher"]);
  });

  it("keeps each contributor's baseline independent", () => {
    markBadgesSeen("alice", ["Rising Researcher"]);
    markBadgesSeen("bob", ["Seasoned Contributor"]);
    expect(getSeenBadges("alice")).toEqual(["Rising Researcher"]);
    expect(getSeenBadges("bob")).toEqual(["Seasoned Contributor"]);
  });

  it("overwrites a contributor's prior baseline on a later call", () => {
    markBadgesSeen("alice", ["Rising Researcher"]);
    markBadgesSeen("alice", ["Rising Researcher", "Seasoned Contributor"]);
    expect(getSeenBadges("alice")).toEqual(["Rising Researcher", "Seasoned Contributor"]);
  });
});

describe("recordAndGetNewlyEarnedBadges", () => {
  it("doesn't celebrate the first time a contributor is seen", () => {
    expect(recordAndGetNewlyEarnedBadges("alice", ["Rising Researcher"])).toEqual([]);
  });

  it("records the baseline on first sight so a later call with the same badges reports nothing new", () => {
    recordAndGetNewlyEarnedBadges("alice", ["Rising Researcher"]);
    expect(recordAndGetNewlyEarnedBadges("alice", ["Rising Researcher"])).toEqual([]);
  });

  it("reports a badge earned since the last call", () => {
    recordAndGetNewlyEarnedBadges("alice", ["Rising Researcher"]);
    expect(recordAndGetNewlyEarnedBadges("alice", ["Rising Researcher", "Seasoned Contributor"])).toEqual([
      "Seasoned Contributor",
    ]);
  });

  it("doesn't re-report an already-reported badge on a subsequent call", () => {
    recordAndGetNewlyEarnedBadges("alice", ["Rising Researcher"]);
    recordAndGetNewlyEarnedBadges("alice", ["Rising Researcher", "Seasoned Contributor"]);
    expect(recordAndGetNewlyEarnedBadges("alice", ["Rising Researcher", "Seasoned Contributor"])).toEqual([]);
  });
});

describe("clearAllSeenBadges", () => {
  it("resets every contributor's baseline", () => {
    markBadgesSeen("alice", ["Rising Researcher"]);
    clearAllSeenBadges();
    expect(getSeenBadges("alice")).toBeUndefined();
  });
});
