import { describe, expect, it } from "vitest";
import {
  NEWS_ITEMS,
  countUnreadNewsItems,
  filterNewsItemsByCategory,
  findLatestNewsItemForHref,
  isNewsItemUnread,
  sortNewsItemsByRecency,
  type NewsItem,
} from "../src/lib/news-stream";

const ITEMS: NewsItem[] = [
  { id: "a", title: "A", summary: "a", category: "editor", href: "/reason-editor", order: 1 },
  { id: "b", title: "B", summary: "b", category: "research", href: "/cards/library", order: 3 },
  { id: "c", title: "C", summary: "c", category: "editor", order: 2 },
];

describe("sortNewsItemsByRecency", () => {
  it("sorts newest (highest order) first without mutating the input", () => {
    const sorted = sortNewsItemsByRecency(ITEMS);
    expect(sorted.map((item) => item.id)).toEqual(["b", "c", "a"]);
    expect(ITEMS.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});

describe("filterNewsItemsByCategory", () => {
  it("returns every item for 'all'", () => {
    expect(filterNewsItemsByCategory(ITEMS, "all")).toHaveLength(3);
  });

  it("filters to one category", () => {
    expect(filterNewsItemsByCategory(ITEMS, "editor").map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("returns an empty list for a category with no items", () => {
    expect(filterNewsItemsByCategory(ITEMS, "coaching")).toEqual([]);
  });
});

describe("isNewsItemUnread / countUnreadNewsItems", () => {
  it("treats every item as unread against an empty read set", () => {
    const readIds = new Set<string>();
    expect(ITEMS.every((item) => isNewsItemUnread(item, readIds))).toBe(true);
    expect(countUnreadNewsItems(ITEMS, readIds)).toBe(3);
  });

  it("excludes read ids from the unread count", () => {
    const readIds = new Set(["a", "b"]);
    expect(isNewsItemUnread(ITEMS[0], readIds)).toBe(false);
    expect(isNewsItemUnread(ITEMS[2], readIds)).toBe(true);
    expect(countUnreadNewsItems(ITEMS, readIds)).toBe(1);
  });
});

describe("findLatestNewsItemForHref", () => {
  it("returns the most recent item for a given route", () => {
    expect(findLatestNewsItemForHref(ITEMS, "/reason-editor")?.id).toBe("a");
    expect(findLatestNewsItemForHref(ITEMS, "/cards/library")?.id).toBe("b");
  });

  it("returns undefined when no item names that route", () => {
    expect(findLatestNewsItemForHref(ITEMS, "/nowhere")).toBeUndefined();
  });
});

describe("NEWS_ITEMS seed data", () => {
  it("has a unique id and a unique order for every item", () => {
    const ids = new Set(NEWS_ITEMS.map((item) => item.id));
    const orders = new Set(NEWS_ITEMS.map((item) => item.order));
    expect(ids.size).toBe(NEWS_ITEMS.length);
    expect(orders.size).toBe(NEWS_ITEMS.length);
  });
});
