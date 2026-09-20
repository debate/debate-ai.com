import { describe, expect, it } from "vitest";
import {
  applyNewsLikedOp,
  applyNewsReadOp,
  DEFAULT_NEWS_SYNC,
  isValidNewsIdList,
  isValidNewsItemId,
  MAX_NEWS_SYNC_ITEMS,
  normalizeNewsLikedOpPatch,
  normalizeNewsReadOpPatch,
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

describe("normalizeNewsReadOpPatch", () => {
  it("accepts a valid recordNewsRead op", () => {
    expect(normalizeNewsReadOpPatch({ recordNewsRead: "sprint-note-note-1" })).toEqual({
      valid: { recordNewsRead: "sprint-note-note-1" },
      errors: [],
    });
  });

  it("returns no valid op and no errors when the field is absent", () => {
    expect(normalizeNewsReadOpPatch({ debateStyle: 1 })).toEqual({ valid: {}, errors: [] });
  });

  it("rejects a malformed recordNewsRead value", () => {
    const result = normalizeNewsReadOpPatch({ recordNewsRead: "" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it.each([null, undefined, "not an object", 5, ["array"]])("rejects a non-object body %p", (body) => {
    const result = normalizeNewsReadOpPatch(body);
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });
});

describe("applyNewsReadOp", () => {
  it("appends a new id to an empty list", () => {
    expect(applyNewsReadOp([], { recordNewsRead: "a" })).toEqual(["a"]);
  });

  it("appends a new id to a non-empty list", () => {
    expect(applyNewsReadOp(["a", "b"], { recordNewsRead: "c" })).toEqual(["a", "b", "c"]);
  });

  it("returns the same array reference when the id is already read", () => {
    const current = ["a", "b"];
    expect(applyNewsReadOp(current, { recordNewsRead: "a" })).toBe(current);
  });

  it("returns the same array reference for an invalid id", () => {
    const current = ["a"];
    expect(applyNewsReadOp(current, { recordNewsRead: "" })).toBe(current);
  });

  it("silently drops an add once the list is at MAX_NEWS_SYNC_ITEMS", () => {
    const current = Array.from({ length: MAX_NEWS_SYNC_ITEMS }, (_, i) => `item-${i}`);
    expect(applyNewsReadOp(current, { recordNewsRead: "one-more" })).toBe(current);
  });

  it("two concurrent reads resolve onto the same starting list without dropping either", () => {
    const start = ["a"];
    const afterFirst = applyNewsReadOp(start, { recordNewsRead: "b" });
    const afterSecond = applyNewsReadOp(start, { recordNewsRead: "c" });
    expect(afterFirst).toEqual(["a", "b"]);
    expect(afterSecond).toEqual(["a", "c"]);
  });
});

describe("normalizeNewsLikedOpPatch", () => {
  it("accepts a valid addNewsLiked op", () => {
    expect(normalizeNewsLikedOpPatch({ addNewsLiked: "a" })).toEqual({
      valid: { addNewsLiked: "a" },
      errors: [],
    });
  });

  it("accepts a valid removeNewsLiked op", () => {
    expect(normalizeNewsLikedOpPatch({ removeNewsLiked: "a" })).toEqual({
      valid: { removeNewsLiked: "a" },
      errors: [],
    });
  });

  it("returns no valid op and no errors when neither field is present", () => {
    expect(normalizeNewsLikedOpPatch({ debateStyle: 1 })).toEqual({ valid: {}, errors: [] });
  });

  it("rejects a request providing both addNewsLiked and removeNewsLiked", () => {
    const result = normalizeNewsLikedOpPatch({ addNewsLiked: "a", removeNewsLiked: "b" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a malformed addNewsLiked value", () => {
    const result = normalizeNewsLikedOpPatch({ addNewsLiked: "" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a malformed removeNewsLiked value", () => {
    const result = normalizeNewsLikedOpPatch({ removeNewsLiked: 5 });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it.each([null, undefined, "not an object", 5, ["array"]])("rejects a non-object body %p", (body) => {
    const result = normalizeNewsLikedOpPatch(body);
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });
});

describe("applyNewsLikedOp", () => {
  it("adds a new liked id", () => {
    expect(applyNewsLikedOp(["a"], { addNewsLiked: "b" })).toEqual(["a", "b"]);
  });

  it("returns the same array reference when adding an already-liked id", () => {
    const current = ["a", "b"];
    expect(applyNewsLikedOp(current, { addNewsLiked: "a" })).toBe(current);
  });

  it("silently drops an add once the list is at MAX_NEWS_SYNC_ITEMS", () => {
    const current = Array.from({ length: MAX_NEWS_SYNC_ITEMS }, (_, i) => `item-${i}`);
    expect(applyNewsLikedOp(current, { addNewsLiked: "one-more" })).toBe(current);
  });

  it("removes a liked id", () => {
    expect(applyNewsLikedOp(["a", "b"], { removeNewsLiked: "a" })).toEqual(["b"]);
  });

  it("returns the same array reference when removing an absent id", () => {
    const current = ["a"];
    expect(applyNewsLikedOp(current, { removeNewsLiked: "z" })).toBe(current);
  });

  it("returns the current list unchanged for an empty op", () => {
    const current = ["a"];
    expect(applyNewsLikedOp(current, {})).toBe(current);
  });

  it("two concurrent likes resolve onto the same starting list without dropping either", () => {
    const start = ["a"];
    const afterFirst = applyNewsLikedOp(start, { addNewsLiked: "b" });
    const afterSecond = applyNewsLikedOp(start, { addNewsLiked: "c" });
    expect(afterFirst).toEqual(["a", "b"]);
    expect(afterSecond).toEqual(["a", "c"]);
  });

  it("an unlike on one device is no longer dropped by a like already resolved elsewhere", () => {
    const likedByDeviceA = applyNewsLikedOp(["a"], { addNewsLiked: "b" });
    const unlikedByDeviceB = applyNewsLikedOp(likedByDeviceA, { removeNewsLiked: "a" });
    expect(unlikedByDeviceB).toEqual(["b"]);
  });
});
