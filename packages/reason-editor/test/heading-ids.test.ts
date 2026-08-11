import { describe, expect, it } from "vitest";
import {
  HEADING_BOOKMARK_PREFIX,
  HEADING_TYPE_NAMES,
  bookmarkNameForId,
  idFromBookmarkName,
  newHeadingId,
} from "../src/engine/schema/ids";

describe("newHeadingId", () => {
  it("returns a UUID", () => {
    expect(newHeadingId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("returns a fresh id each call", () => {
    expect(newHeadingId()).not.toBe(newHeadingId());
  });
});

describe("bookmark names", () => {
  it("prefixes ids for the docx bookmark round-trip", () => {
    expect(bookmarkNameForId("abc")).toBe(`${HEADING_BOOKMARK_PREFIX}abc`);
  });

  it("round-trips an id through a bookmark name", () => {
    const id = newHeadingId();
    expect(idFromBookmarkName(bookmarkNameForId(id))).toBe(id);
  });

  it("ignores bookmarks written by other tools", () => {
    expect(idFromBookmarkName("_GoBack")).toBeNull();
    expect(idFromBookmarkName("")).toBeNull();
  });
});

describe("HEADING_TYPE_NAMES", () => {
  it("covers the CardMirror heading node types", () => {
    expect([...HEADING_TYPE_NAMES].sort()).toEqual([
      "analytic",
      "block",
      "hat",
      "pocket",
      "tag",
    ]);
  });

  it("excludes non-heading nodes", () => {
    expect(HEADING_TYPE_NAMES.has("paragraph")).toBe(false);
  });
});
