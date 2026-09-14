import { describe, expect, it } from "vitest";
import {
  applyFavoriteToolOp,
  DEFAULT_FAVORITE_TOOLS,
  filterKnownFavoriteTools,
  isValidFavoriteToolsList,
  isValidToolHref,
  MAX_FAVORITE_TOOLS,
  normalizeFavoriteToolOpPatch,
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

describe("filterKnownFavoriteTools", () => {
  it("keeps every favorite that's still in validHrefs", () => {
    const favorites = ["/tools", "/drills"];
    expect(filterKnownFavoriteTools(favorites, ["/tools", "/drills", "/rank"])).toEqual(favorites);
  });

  it("drops a favorite no longer present in validHrefs", () => {
    expect(filterKnownFavoriteTools(["/tools", "/renamed-tool", "/drills"], ["/tools", "/drills"])).toEqual([
      "/tools",
      "/drills",
    ]);
  });

  it("drops every favorite when none are in validHrefs", () => {
    expect(filterKnownFavoriteTools(["/gone", "/also-gone"], ["/tools"])).toEqual([]);
  });

  it("returns an empty list unchanged", () => {
    expect(filterKnownFavoriteTools([], ["/tools"])).toEqual([]);
  });

  it("preserves original order", () => {
    expect(filterKnownFavoriteTools(["/c", "/a", "/b"], ["/a", "/b", "/c"])).toEqual(["/c", "/a", "/b"]);
  });

  it("returns the same array reference when nothing is pruned", () => {
    const favorites = ["/tools", "/drills"];
    expect(filterKnownFavoriteTools(favorites, ["/tools", "/drills"])).toBe(favorites);
  });
});

describe("DEFAULT_FAVORITE_TOOLS", () => {
  it("is itself a valid payload", () => {
    expect(isValidFavoriteToolsList(DEFAULT_FAVORITE_TOOLS.favoriteTools)).toBe(true);
  });
});

describe("normalizeFavoriteToolOpPatch", () => {
  it("accepts a valid addFavoriteTool op", () => {
    expect(normalizeFavoriteToolOpPatch({ addFavoriteTool: "/tools" })).toEqual({
      valid: { addFavoriteTool: "/tools" },
      errors: [],
    });
  });

  it("accepts a valid removeFavoriteTool op", () => {
    expect(normalizeFavoriteToolOpPatch({ removeFavoriteTool: "/tools" })).toEqual({
      valid: { removeFavoriteTool: "/tools" },
      errors: [],
    });
  });

  it("returns no valid op and no errors for an empty object", () => {
    expect(normalizeFavoriteToolOpPatch({})).toEqual({ valid: {}, errors: [] });
  });

  it("ignores unrelated fields alongside a valid op", () => {
    const result = normalizeFavoriteToolOpPatch({ addFavoriteTool: "/tools", debateStyle: 1 });
    expect(result).toEqual({ valid: { addFavoriteTool: "/tools" }, errors: [] });
  });

  it("rejects a malformed addFavoriteTool value", () => {
    const result = normalizeFavoriteToolOpPatch({ addFavoriteTool: "not-a-path" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a malformed removeFavoriteTool value", () => {
    const result = normalizeFavoriteToolOpPatch({ removeFavoriteTool: 5 });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a request carrying both addFavoriteTool and removeFavoriteTool", () => {
    const result = normalizeFavoriteToolOpPatch({ addFavoriteTool: "/tools", removeFavoriteTool: "/drills" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it.each([null, undefined, "not an object", 5, ["array"]])("rejects a non-object body %p", (body) => {
    const result = normalizeFavoriteToolOpPatch(body);
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });
});

describe("applyFavoriteToolOp", () => {
  it("appends a new href on addFavoriteTool", () => {
    expect(applyFavoriteToolOp(["/tools"], { addFavoriteTool: "/drills" })).toEqual(["/tools", "/drills"]);
  });

  it("is idempotent when adding an already-favorited href", () => {
    const current = ["/tools", "/drills"];
    expect(applyFavoriteToolOp(current, { addFavoriteTool: "/tools" })).toBe(current);
  });

  it("does not add past MAX_FAVORITE_TOOLS", () => {
    const current = Array.from({ length: MAX_FAVORITE_TOOLS }, (_, i) => `/tool-${i}`);
    expect(applyFavoriteToolOp(current, { addFavoriteTool: "/one-too-many" })).toBe(current);
  });

  it("removes a matching href on removeFavoriteTool", () => {
    expect(applyFavoriteToolOp(["/tools", "/drills"], { removeFavoriteTool: "/tools" })).toEqual(["/drills"]);
  });

  it("is idempotent when removing an absent href", () => {
    const current = ["/tools", "/drills"];
    expect(applyFavoriteToolOp(current, { removeFavoriteTool: "/rank" })).toBe(current);
  });

  it("returns the current list unchanged for an empty op", () => {
    const current = ["/tools"];
    expect(applyFavoriteToolOp(current, {})).toBe(current);
  });

  it("resolves two different concurrent add ops onto the same starting list without dropping either", () => {
    // The scenario this op-based approach exists to fix: two tabs read the
    // same starting list and each add a different tool. Applied against the
    // *server's* current value one at a time (rather than each tab PUTting
    // its own whole-list copy), both additions survive.
    const starting = ["/tools"];
    const afterTabA = applyFavoriteToolOp(starting, { addFavoriteTool: "/drills" });
    const afterTabB = applyFavoriteToolOp(afterTabA, { addFavoriteTool: "/rank" });
    expect(afterTabB).toEqual(["/tools", "/drills", "/rank"]);
  });
});
