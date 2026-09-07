import { beforeEach, describe, expect, it } from "vitest";
import {
  appendReuseCheckHistory,
  clearReuseCheckHistory,
  listReuseCheckHistory,
  MAX_REUSE_CHECK_HISTORY,
} from "../src/state/reuseCheckHistory";
import type { PageReuseCheckResult } from "../src/lib/shared-evidence-library";

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

function result(url: string, matchCount: number): PageReuseCheckResult {
  return {
    url,
    alreadyCut: matchCount > 0,
    matches: Array.from({ length: matchCount }, (_, i) => ({
      id: `entry-${i}`,
      kind: "card",
      topic: "Topic",
      caseArea: "Case",
      argBlock: "Block",
      tags: [],
      text: "Text",
      cite: "Cite",
      wordCount: 1,
    })),
  };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("appendReuseCheckHistory", () => {
  it("assigns a fresh id and records the check", () => {
    const record = appendReuseCheckHistory(result("https://example.com/a", 0), 1000);
    expect(record.id).toBeTruthy();
    expect(record).toMatchObject({ url: "https://example.com/a", alreadyCut: false, matchCount: 0, checkedAt: 1000 });
  });

  it("records alreadyCut and matchCount from the check result", () => {
    const record = appendReuseCheckHistory(result("https://example.com/b", 3), 1000);
    expect(record.alreadyCut).toBe(true);
    expect(record.matchCount).toBe(3);
  });

  it("keeps both entries when the same page is checked twice", () => {
    appendReuseCheckHistory(result("https://example.com/a", 0), 1000);
    appendReuseCheckHistory(result("https://example.com/a", 1), 2000);
    expect(listReuseCheckHistory()).toHaveLength(2);
  });

  it("assigns distinct ids to two checks recorded back to back", () => {
    const first = appendReuseCheckHistory(result("https://example.com/a", 0), 1000);
    const second = appendReuseCheckHistory(result("https://example.com/b", 0), 1000);
    expect(first.id).not.toBe(second.id);
  });

  it("defaults scope to local when none is given", () => {
    const record = appendReuseCheckHistory(result("https://example.com/a", 0), 1000);
    expect(record.scope).toBe("local");
  });

  it("records a team-wide check with its own scope alongside the local one", () => {
    appendReuseCheckHistory(result("https://example.com/a", 0), 1000);
    appendReuseCheckHistory(
      { url: "https://example.com/a", alreadyCut: true, matches: [{ id: "remote-1" }] },
      2000,
      "team",
    );
    const history = listReuseCheckHistory();
    expect(history.map((r) => r.scope)).toEqual(["team", "local"]);
    expect(history[0]).toMatchObject({ alreadyCut: true, matchCount: 1 });
  });

  it("reads back a legacy record without a scope field", () => {
    localStorage.setItem(
      "reuseCheckHistory",
      JSON.stringify([{ id: "legacy", url: "https://example.com/a", alreadyCut: false, matchCount: 0, checkedAt: 500 }]),
    );
    const [record] = listReuseCheckHistory();
    expect(record.scope).toBeUndefined();
    expect(record.url).toBe("https://example.com/a");
  });
});

describe("listReuseCheckHistory", () => {
  it("returns an empty list when nothing has been checked", () => {
    expect(listReuseCheckHistory()).toEqual([]);
  });

  it("returns records newest-first regardless of insertion order", () => {
    appendReuseCheckHistory(result("https://example.com/a", 0), 1000);
    appendReuseCheckHistory(result("https://example.com/b", 0), 3000);
    appendReuseCheckHistory(result("https://example.com/c", 0), 2000);
    expect(listReuseCheckHistory().map((r) => r.url)).toEqual([
      "https://example.com/b",
      "https://example.com/c",
      "https://example.com/a",
    ]);
  });

  it("trims the oldest entries once the cap is exceeded", () => {
    for (let i = 0; i < MAX_REUSE_CHECK_HISTORY + 5; i++) {
      appendReuseCheckHistory(result(`https://example.com/${i}`, 0), i);
    }
    const history = listReuseCheckHistory();
    expect(history).toHaveLength(MAX_REUSE_CHECK_HISTORY);
    // The 5 oldest (checkedAt 0..4) should have been trimmed away.
    expect(history.some((r) => r.checkedAt < 5)).toBe(false);
  });
});

describe("clearReuseCheckHistory", () => {
  it("removes every persisted record", () => {
    appendReuseCheckHistory(result("https://example.com/a", 0), 1000);
    appendReuseCheckHistory(result("https://example.com/b", 0), 2000);
    clearReuseCheckHistory();
    expect(listReuseCheckHistory()).toEqual([]);
  });

  it("is a no-op when history is already empty", () => {
    expect(() => clearReuseCheckHistory()).not.toThrow();
    expect(listReuseCheckHistory()).toEqual([]);
  });
});
