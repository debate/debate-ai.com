import { describe, expect, it } from "vitest";
import {
  DEFAULT_FAVORITE_TOOLS,
  isValidFavoriteToolsList,
  isValidToolHref,
  MAX_FAVORITE_TOOLS,
  normalizeFavoriteToolsPatch,
  parseFavoriteTools,
  serializeFavoriteTools,
} from "../src/state/favoriteTools";

describe("isValidToolHref", () => {
  it.each(["/tools", "/reason-editor", "/cards/leaderboard", "/a/b/c-d"])(
    "accepts a well-formed in-app path %p",
    (href) => {
      expect(isValidToolHref(href)).toBe(true);
    },
  );

  it.each([
    "not-a-path",
    "",
    "/",
    "/Tools",
    "//tools",
    "/tools/",
    "/tools?x=1",
    "/tools#frag",
    "https://example.com/tools",
    "javascript:alert(1)",
    null,
    undefined,
    5,
    "/" + "a".repeat(200),
  ])("rejects a malformed/non-string value %p", (value) => {
    expect(isValidToolHref(value)).toBe(false);
  });
});

describe("isValidFavoriteToolsList", () => {
  it("accepts an empty list", () => {
    expect(isValidFavoriteToolsList([])).toBe(true);
  });

  it("accepts a list of valid, unique hrefs", () => {
    expect(isValidFavoriteToolsList(["/tools", "/drills", "/cards/leaderboard"])).toBe(true);
  });

  it("rejects a list containing an invalid href", () => {
    expect(isValidFavoriteToolsList(["/tools", "not-a-path"])).toBe(false);
  });

  it("rejects a list with duplicate hrefs", () => {
    expect(isValidFavoriteToolsList(["/tools", "/tools"])).toBe(false);
  });

  it("rejects a list longer than MAX_FAVORITE_TOOLS", () => {
    const tooMany = Array.from({ length: MAX_FAVORITE_TOOLS + 1 }, (_, i) => `/tool-${i}`);
    expect(isValidFavoriteToolsList(tooMany)).toBe(false);
  });

  it("accepts a list exactly at MAX_FAVORITE_TOOLS", () => {
    const atLimit = Array.from({ length: MAX_FAVORITE_TOOLS }, (_, i) => `/tool-${i}`);
    expect(isValidFavoriteToolsList(atLimit)).toBe(true);
  });

  it.each([null, undefined, "not-an-array", 5, {}])("rejects a non-array value %p", (value) => {
    expect(isValidFavoriteToolsList(value)).toBe(false);
  });
});

describe("normalizeFavoriteToolsPatch", () => {
  it("accepts a valid patch", () => {
    const result = normalizeFavoriteToolsPatch({ favoriteTools: ["/tools", "/drills"] });
    expect(result).toEqual({ valid: { favoriteTools: ["/tools", "/drills"] }, errors: [] });
  });

  it("ignores unknown fields", () => {
    const result = normalizeFavoriteToolsPatch({ favoriteTools: ["/tools"], debateStyle: 1 });
    expect(result.valid).toEqual({ favoriteTools: ["/tools"] });
    expect(result.errors).toEqual([]);
  });

  it("reports an error for an invalid favoriteTools value", () => {
    const result = normalizeFavoriteToolsPatch({ favoriteTools: ["not-a-path"] });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("reports an error for a non-array favoriteTools value", () => {
    const result = normalizeFavoriteToolsPatch({ favoriteTools: "not-an-array" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it.each([null, undefined, "not an object", 5, ["array"]])("rejects a non-object body %p", (body) => {
    const result = normalizeFavoriteToolsPatch(body);
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("returns no valid fields and no errors for an empty object", () => {
    expect(normalizeFavoriteToolsPatch({})).toEqual({ valid: {}, errors: [] });
  });
});

describe("serializeFavoriteTools / parseFavoriteTools", () => {
  it("serializes an empty list to null", () => {
    expect(serializeFavoriteTools([])).toBeNull();
  });

  it("round-trips a non-empty list through serialize/parse", () => {
    const list = ["/tools", "/drills", "/cards/leaderboard"];
    expect(parseFavoriteTools(serializeFavoriteTools(list))).toEqual(list);
  });

  it.each([null, undefined, ""])("parses a null/undefined/empty raw value as an empty list %p", (raw) => {
    expect(parseFavoriteTools(raw)).toEqual([]);
  });

  it("parses malformed JSON as an empty list rather than throwing", () => {
    expect(parseFavoriteTools("{not json")).toEqual([]);
  });

  it("parses a well-formed JSON value that isn't a valid favorites list as an empty list", () => {
    expect(parseFavoriteTools(JSON.stringify(["not-a-path"]))).toEqual([]);
    expect(parseFavoriteTools(JSON.stringify({ not: "an array" }))).toEqual([]);
  });
});

describe("DEFAULT_FAVORITE_TOOLS", () => {
  it("is itself a valid payload", () => {
    expect(isValidFavoriteToolsList(DEFAULT_FAVORITE_TOOLS.favoriteTools)).toBe(true);
  });
});
