import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEWS_SYNC,
  isValidNewsIdList,
  isValidNewsItemId,
  MAX_NEWS_SYNC_ITEMS,
  normalizeNewsSyncPatch,
  parseNewsIdList,
  serializeNewsIdList,
} from "../src/lib/news-stream-sync";

describe("isValidNewsItemId", () => {
  it.each([
    "daily-best-card-2026-08-30",
    "sprint-note-note-1",
    "argument-library-entry-entry_1",
    "quest-streak-milestone-alice-2026-08-10",
    "product-news-stream-launch",
  ])("accepts a well-formed news item id %p", (id) => {
    expect(isValidNewsItemId(id)).toBe(true);
  });

  it.each(["", "a".repeat(201), null, undefined, 5, {}, ["array"]])(
    "rejects a malformed/non-string value %p",
    (value) => {
      expect(isValidNewsItemId(value)).toBe(false);
    },
  );
});

describe("isValidNewsIdList", () => {
  it("accepts an empty list", () => {
    expect(isValidNewsIdList([])).toBe(true);
  });

  it("accepts a list of valid, unique ids", () => {
    expect(isValidNewsIdList(["a", "b", "c"])).toBe(true);
  });

  it("rejects a list containing an invalid id", () => {
    expect(isValidNewsIdList(["a", ""])).toBe(false);
  });

  it("rejects a list with duplicate ids", () => {
    expect(isValidNewsIdList(["a", "a"])).toBe(false);
  });

  it("rejects a list longer than MAX_NEWS_SYNC_ITEMS", () => {
    const tooMany = Array.from({ length: MAX_NEWS_SYNC_ITEMS + 1 }, (_, i) => `item-${i}`);
    expect(isValidNewsIdList(tooMany)).toBe(false);
  });

  it("accepts a list exactly at MAX_NEWS_SYNC_ITEMS", () => {
    const atLimit = Array.from({ length: MAX_NEWS_SYNC_ITEMS }, (_, i) => `item-${i}`);
    expect(isValidNewsIdList(atLimit)).toBe(true);
  });

  it.each([null, undefined, "not-an-array", 5, {}])("rejects a non-array value %p", (value) => {
    expect(isValidNewsIdList(value)).toBe(false);
  });
});

describe("normalizeNewsSyncPatch", () => {
  it("accepts a valid patch with both fields", () => {
    const result = normalizeNewsSyncPatch({ newsRead: ["a", "b"], newsLiked: ["a"] });
    expect(result).toEqual({ valid: { newsRead: ["a", "b"], newsLiked: ["a"] }, errors: [] });
  });

  it("accepts a patch with only one field present", () => {
    const result = normalizeNewsSyncPatch({ newsRead: ["a"] });
    expect(result).toEqual({ valid: { newsRead: ["a"] }, errors: [] });
  });

  it("ignores unknown fields", () => {
    const result = normalizeNewsSyncPatch({ newsRead: ["a"], debateStyle: 1 });
    expect(result.valid).toEqual({ newsRead: ["a"] });
    expect(result.errors).toEqual([]);
  });

  it("reports an error for an invalid newsRead value", () => {
    const result = normalizeNewsSyncPatch({ newsRead: [""] });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("reports an error for an invalid newsLiked value", () => {
    const result = normalizeNewsSyncPatch({ newsLiked: "not-an-array" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("reports both errors when both fields are invalid", () => {
    const result = normalizeNewsSyncPatch({ newsRead: "bad", newsLiked: "bad" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(2);
  });

  it.each([null, undefined, "not an object", 5, ["array"]])("rejects a non-object body %p", (body) => {
    const result = normalizeNewsSyncPatch(body);
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("returns no valid fields and no errors for an empty object", () => {
    expect(normalizeNewsSyncPatch({})).toEqual({ valid: {}, errors: [] });
  });
});

describe("serializeNewsIdList / parseNewsIdList", () => {
  it("serializes an empty list to null", () => {
    expect(serializeNewsIdList([])).toBeNull();
  });

  it("round-trips a non-empty list through serialize/parse", () => {
    const list = ["daily-best-card-2026-08-30", "sprint-note-note-1"];
    expect(parseNewsIdList(serializeNewsIdList(list))).toEqual(list);
  });

  it.each([null, undefined, ""])("parses a null/undefined/empty raw value as an empty list %p", (raw) => {
    expect(parseNewsIdList(raw)).toEqual([]);
  });

  it("parses malformed JSON as an empty list rather than throwing", () => {
    expect(parseNewsIdList("{not json")).toEqual([]);
  });

  it("parses a well-formed JSON value that isn't a valid id list as an empty list", () => {
    expect(parseNewsIdList(JSON.stringify([""]))).toEqual([]);
    expect(parseNewsIdList(JSON.stringify({ not: "an array" }))).toEqual([]);
  });
});

describe("DEFAULT_NEWS_SYNC", () => {
  it("is itself a valid payload", () => {
    expect(isValidNewsIdList(DEFAULT_NEWS_SYNC.newsRead)).toBe(true);
    expect(isValidNewsIdList(DEFAULT_NEWS_SYNC.newsLiked)).toBe(true);
  });
});
