import { beforeEach, describe, expect, it } from "vitest";
import {
  getReadNewsItemIds,
  getUnreadNewsCount,
  markAllNewsItemsRead,
  markNewsItemRead,
} from "../src/state/newsStream";
import { NEWS_ITEMS } from "../src/lib/news-stream";

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

describe("getReadNewsItemIds", () => {
  it("is empty when nothing is stored", () => {
    expect(getReadNewsItemIds()).toEqual(new Set());
  });

  it("is empty when the stored value is corrupt JSON", () => {
    localStorage.setItem("newsStreamReadIds", "{not json");
    expect(getReadNewsItemIds()).toEqual(new Set());
  });

  it("drops non-string entries from a malformed stored array", () => {
    localStorage.setItem("newsStreamReadIds", JSON.stringify(["a", 2, null, "b"]));
    expect(getReadNewsItemIds()).toEqual(new Set(["a", "b"]));
  });
});

describe("markNewsItemRead", () => {
  it("adds the id to the read set", () => {
    markNewsItemRead("news-stream-launch");
    expect(getReadNewsItemIds().has("news-stream-launch")).toBe(true);
  });

  it("is idempotent for an already-read id", () => {
    markNewsItemRead("news-stream-launch");
    markNewsItemRead("news-stream-launch");
    expect(getReadNewsItemIds().size).toBe(1);
  });

  it("preserves previously-read ids", () => {
    markNewsItemRead("a");
    markNewsItemRead("b");
    expect(getReadNewsItemIds()).toEqual(new Set(["a", "b"]));
  });
});

describe("markAllNewsItemsRead / getUnreadNewsCount", () => {
  it("counts every seeded item as unread by default", () => {
    expect(getUnreadNewsCount()).toBe(NEWS_ITEMS.length);
  });

  it("brings the unread count to zero", () => {
    markAllNewsItemsRead();
    expect(getUnreadNewsCount()).toBe(0);
    for (const item of NEWS_ITEMS) {
      expect(getReadNewsItemIds().has(item.id)).toBe(true);
    }
  });

  it("decrements as individual items are read", () => {
    const before = getUnreadNewsCount();
    markNewsItemRead(NEWS_ITEMS[0].id);
    expect(getUnreadNewsCount()).toBe(before - 1);
  });
});
