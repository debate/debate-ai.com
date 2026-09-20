import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAVED_ARGUMENT_COLLECTIONS,
  isValidSavedArgumentCollectionsList,
  MAX_SAVED_ARGUMENT_COLLECTIONS,
  MAX_TAGS_PER_COLLECTION,
  normalizeSavedArgumentCollectionName,
  normalizeSavedArgumentCollectionsPatch,
  parseSavedArgumentCollections,
  serializeSavedArgumentCollections,
  buildSavedArgumentCollectionFailureMessage,
  validateNewSavedArgumentCollection,
  validateSavedArgumentCollectionRename,
  validateSavedArgumentCollectionTagsUpdate,
  applySavedArgumentCollectionOp,
  normalizeSavedArgumentCollectionOpPatch,
  type SavedArgumentCollection,
} from "../src/lib/argument-library-collections";

describe("normalizeSavedArgumentCollectionName", () => {
  it("trims and uppercases", () => {
    expect(normalizeSavedArgumentCollectionName("  topicality answers ")).toBe("TOPICALITY ANSWERS");
  });
});

describe("isValidSavedArgumentCollectionsList", () => {
  it("accepts an empty list and a well-formed list", () => {
    expect(isValidSavedArgumentCollectionsList([])).toBe(true);
    expect(
      isValidSavedArgumentCollectionsList([{ name: "Topicality", tags: ["t-answers", "framework"] }]),
    ).toBe(true);
  });

  it("rejects a list exceeding the max size", () => {
    const tooMany = Array.from({ length: MAX_SAVED_ARGUMENT_COLLECTIONS + 1 }, (_, i) => ({
      name: `Collection ${i}`,
      tags: ["x"],
    }));
    expect(isValidSavedArgumentCollectionsList(tooMany)).toBe(false);
  });

  it("accepts a list exactly at MAX_SAVED_ARGUMENT_COLLECTIONS", () => {
    const atLimit = Array.from({ length: MAX_SAVED_ARGUMENT_COLLECTIONS }, (_, i) => ({
      name: `Collection ${i}`,
      tags: ["x"],
    }));
    expect(isValidSavedArgumentCollectionsList(atLimit)).toBe(true);
  });

  it("rejects a collection with an empty name", () => {
    expect(isValidSavedArgumentCollectionsList([{ name: "", tags: ["x"] }])).toBe(false);
    expect(isValidSavedArgumentCollectionsList([{ name: "   ", tags: ["x"] }])).toBe(false);
  });

  it("rejects a collection with an empty tags list", () => {
    expect(isValidSavedArgumentCollectionsList([{ name: "X", tags: [] }])).toBe(false);
  });

  it("rejects a collection with too many tags", () => {
    const tooManyTags = Array.from({ length: MAX_TAGS_PER_COLLECTION + 1 }, (_, i) => `tag-${i}`);
    expect(isValidSavedArgumentCollectionsList([{ name: "X", tags: tooManyTags }])).toBe(false);
  });

  it("rejects a collection with a blank tag", () => {
    expect(isValidSavedArgumentCollectionsList([{ name: "X", tags: ["ok", "  "] }])).toBe(false);
  });

  it("rejects a malformed entry missing a required field", () => {
    expect(isValidSavedArgumentCollectionsList([{ tags: ["x"] }])).toBe(false);
    expect(isValidSavedArgumentCollectionsList([{ name: "X" }])).toBe(false);
  });

  it("rejects duplicate names, case-insensitively", () => {
    expect(
      isValidSavedArgumentCollectionsList([
        { name: "Topicality", tags: ["a"] },
        { name: "topicality", tags: ["b"] },
      ]),
    ).toBe(false);
  });

  it("rejects a non-array value", () => {
    expect(isValidSavedArgumentCollectionsList({ name: "X", tags: ["x"] })).toBe(false);
    expect(isValidSavedArgumentCollectionsList(null)).toBe(false);
  });
});

describe("normalizeSavedArgumentCollectionsPatch", () => {
  it("accepts a valid patch", () => {
    const result = normalizeSavedArgumentCollectionsPatch({
      savedArgumentCollections: [{ name: "Topicality", tags: ["t-answers"] }],
    });
    expect(result.valid).toEqual({
      savedArgumentCollections: [{ name: "Topicality", tags: ["t-answers"] }],
    });
    expect(result.errors).toEqual([]);
  });

  it("ignores an absent field", () => {
    const result = normalizeSavedArgumentCollectionsPatch({});
    expect(result.valid).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it("ignores unrelated fields", () => {
    const result = normalizeSavedArgumentCollectionsPatch({
      savedArgumentCollections: [{ name: "X", tags: ["a"] }],
      debateStyle: 1,
    });
    expect(result.valid).toEqual({ savedArgumentCollections: [{ name: "X", tags: ["a"] }] });
    expect(result.errors).toEqual([]);
  });

  it("rejects a malformed field with a message instead of throwing", () => {
    const result = normalizeSavedArgumentCollectionsPatch({ savedArgumentCollections: "not-a-list" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object body", () => {
    expect(normalizeSavedArgumentCollectionsPatch(null).errors).toHaveLength(1);
    expect(normalizeSavedArgumentCollectionsPatch([]).errors).toHaveLength(1);
    expect(normalizeSavedArgumentCollectionsPatch("nope").errors).toHaveLength(1);
  });
});

describe("serializeSavedArgumentCollections / parseSavedArgumentCollections", () => {
  it("round-trips a non-empty list", () => {
    const list: SavedArgumentCollection[] = [{ name: "Topicality", tags: ["t-answers", "framework"] }];
    expect(parseSavedArgumentCollections(serializeSavedArgumentCollections(list))).toEqual(list);
  });

  it("serializes an empty list to null", () => {
    expect(serializeSavedArgumentCollections([])).toBeNull();
  });

  it("parses a null/undefined/malformed/invalid-shape value back to an empty list", () => {
    expect(parseSavedArgumentCollections(null)).toEqual([]);
    expect(parseSavedArgumentCollections(undefined)).toEqual([]);
    expect(parseSavedArgumentCollections("{ not json")).toEqual([]);
    expect(parseSavedArgumentCollections(JSON.stringify([{ name: "X", tags: [] }]))).toEqual([]);
  });
});

describe("DEFAULT_SAVED_ARGUMENT_COLLECTIONS", () => {
  it("is an empty list", () => {
    expect(DEFAULT_SAVED_ARGUMENT_COLLECTIONS.savedArgumentCollections).toEqual([]);
  });
});

describe("validateNewSavedArgumentCollection", () => {
  const existing: SavedArgumentCollection[] = [{ name: "Topicality", tags: ["t"] }];

  it("allows a well-formed new collection", () => {
    expect(validateNewSavedArgumentCollection(existing, "Warming", ["climate", "impact"])).toBeNull();
  });

  it("refuses an empty tag selection", () => {
    expect(validateNewSavedArgumentCollection(existing, "Warming", [])).toBe("empty-tags");
  });

  it("refuses more than MAX_TAGS_PER_COLLECTION tags (previously wiped every stored collection on next read)", () => {
    const tags = Array.from({ length: MAX_TAGS_PER_COLLECTION + 1 }, (_, i) => `tag-${i}`);
    expect(validateNewSavedArgumentCollection(existing, "Warming", tags)).toBe("too-many-tags");
  });

  it("allows exactly MAX_TAGS_PER_COLLECTION tags", () => {
    const tags = Array.from({ length: MAX_TAGS_PER_COLLECTION }, (_, i) => `tag-${i}`);
    expect(validateNewSavedArgumentCollection(existing, "Warming", tags)).toBeNull();
  });

  it("refuses a blank or over-long name", () => {
    expect(validateNewSavedArgumentCollection(existing, "   ", ["t"])).toBe("invalid-name");
    expect(validateNewSavedArgumentCollection(existing, "x".repeat(61), ["t"])).toBe("invalid-name");
  });

  it("refuses a duplicate name case-insensitively", () => {
    expect(validateNewSavedArgumentCollection(existing, "  topicality ", ["t"])).toBe("duplicate-name");
  });

  it("refuses a save at capacity", () => {
    const full = Array.from({ length: MAX_SAVED_ARGUMENT_COLLECTIONS }, (_, i) => ({
      name: `c${i}`,
      tags: ["t"],
    }));
    expect(validateNewSavedArgumentCollection(full, "one more", ["t"])).toBe("at-capacity");
  });
});

describe("validateSavedArgumentCollectionRename", () => {
  const existing: SavedArgumentCollection[] = [
    { name: "Topicality", tags: ["t"] },
    { name: "Warming", tags: ["climate"] },
  ];

  it("allows renaming to a fresh name", () => {
    expect(validateSavedArgumentCollectionRename(existing, "Warming", "Climate answers")).toBeNull();
  });

  it("allows a case-only rename of the same collection", () => {
    expect(validateSavedArgumentCollectionRename(existing, "Warming", "WARMING")).toBeNull();
  });

  it("refuses renaming a collection that does not exist", () => {
    expect(validateSavedArgumentCollectionRename(existing, "Missing", "Anything")).toBe("unknown-collection");
  });

  it("refuses renaming onto another collection's name", () => {
    expect(validateSavedArgumentCollectionRename(existing, "Warming", "topicality")).toBe("duplicate-name");
  });

  it("refuses an invalid new name", () => {
    expect(validateSavedArgumentCollectionRename(existing, "Warming", " ")).toBe("invalid-name");
  });
});

describe("validateSavedArgumentCollectionTagsUpdate", () => {
  const existing: SavedArgumentCollection[] = [{ name: "Topicality", tags: ["t"] }];

  it("allows replacing an existing collection's tags", () => {
    expect(validateSavedArgumentCollectionTagsUpdate(existing, "topicality", ["a", "b"])).toBeNull();
  });

  it("refuses an unknown collection", () => {
    expect(validateSavedArgumentCollectionTagsUpdate(existing, "Missing", ["a"])).toBe("unknown-collection");
  });

  it("refuses an empty or over-limit tag list", () => {
    expect(validateSavedArgumentCollectionTagsUpdate(existing, "Topicality", [])).toBe("empty-tags");
    const tags = Array.from({ length: MAX_TAGS_PER_COLLECTION + 1 }, (_, i) => `tag-${i}`);
    expect(validateSavedArgumentCollectionTagsUpdate(existing, "Topicality", tags)).toBe("too-many-tags");
  });
});

describe("normalizeSavedArgumentCollectionOpPatch", () => {
  it("accepts a valid addSavedArgumentCollection op", () => {
    const result = normalizeSavedArgumentCollectionOpPatch({
      addSavedArgumentCollection: { name: "Warming", tags: ["climate"] },
    });
    expect(result.valid).toEqual({ addSavedArgumentCollection: { name: "Warming", tags: ["climate"] } });
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid removeSavedArgumentCollection op", () => {
    const result = normalizeSavedArgumentCollectionOpPatch({ removeSavedArgumentCollection: "Warming" });
    expect(result.valid).toEqual({ removeSavedArgumentCollection: "Warming" });
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid renameSavedArgumentCollection op", () => {
    const result = normalizeSavedArgumentCollectionOpPatch({
      renameSavedArgumentCollection: { oldName: "Warming", newName: "Climate" },
    });
    expect(result.valid).toEqual({ renameSavedArgumentCollection: { oldName: "Warming", newName: "Climate" } });
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid updateSavedArgumentCollectionTags op", () => {
    const result = normalizeSavedArgumentCollectionOpPatch({
      updateSavedArgumentCollectionTags: { name: "Warming", tags: ["a", "b"] },
    });
    expect(result.valid).toEqual({ updateSavedArgumentCollectionTags: { name: "Warming", tags: ["a", "b"] } });
    expect(result.errors).toEqual([]);
  });

  it("returns no valid op and no errors for an empty object", () => {
    const result = normalizeSavedArgumentCollectionOpPatch({});
    expect(result.valid).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it("ignores unrelated fields alongside a valid op", () => {
    const result = normalizeSavedArgumentCollectionOpPatch({
      removeSavedArgumentCollection: "Warming",
      debateStyle: 1,
    });
    expect(result.valid).toEqual({ removeSavedArgumentCollection: "Warming" });
    expect(result.errors).toEqual([]);
  });

  it("rejects a malformed addSavedArgumentCollection value", () => {
    expect(normalizeSavedArgumentCollectionOpPatch({ addSavedArgumentCollection: "nope" }).errors).toHaveLength(1);
    expect(
      normalizeSavedArgumentCollectionOpPatch({ addSavedArgumentCollection: { name: 1, tags: ["a"] } }).errors,
    ).toHaveLength(1);
    expect(
      normalizeSavedArgumentCollectionOpPatch({ addSavedArgumentCollection: { name: "X", tags: "nope" } }).errors,
    ).toHaveLength(1);
  });

  it("rejects a malformed removeSavedArgumentCollection value", () => {
    expect(normalizeSavedArgumentCollectionOpPatch({ removeSavedArgumentCollection: "" }).errors).toHaveLength(1);
    expect(normalizeSavedArgumentCollectionOpPatch({ removeSavedArgumentCollection: 5 }).errors).toHaveLength(1);
  });

  it("rejects a malformed renameSavedArgumentCollection value", () => {
    expect(normalizeSavedArgumentCollectionOpPatch({ renameSavedArgumentCollection: "nope" }).errors).toHaveLength(1);
    expect(
      normalizeSavedArgumentCollectionOpPatch({ renameSavedArgumentCollection: { oldName: "X" } }).errors,
    ).toHaveLength(1);
  });

  it("rejects a malformed updateSavedArgumentCollectionTags value", () => {
    expect(
      normalizeSavedArgumentCollectionOpPatch({ updateSavedArgumentCollectionTags: "nope" }).errors,
    ).toHaveLength(1);
  });

  it("rejects a request carrying more than one op", () => {
    const result = normalizeSavedArgumentCollectionOpPatch({
      removeSavedArgumentCollection: "Warming",
      addSavedArgumentCollection: { name: "X", tags: ["a"] },
    });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object body", () => {
    expect(normalizeSavedArgumentCollectionOpPatch(null).errors).toHaveLength(1);
    expect(normalizeSavedArgumentCollectionOpPatch([]).errors).toHaveLength(1);
  });
});

describe("applySavedArgumentCollectionOp", () => {
  const existing: SavedArgumentCollection[] = [
    { name: "Topicality", tags: ["t"] },
    { name: "Warming", tags: ["climate"] },
  ];

  it("appends a new collection on addSavedArgumentCollection", () => {
    const result = applySavedArgumentCollectionOp(existing, {
      addSavedArgumentCollection: { name: "Impacts", tags: ["a"] },
    });
    expect(result.failure).toBeNull();
    expect(result.next).toEqual([...existing, { name: "Impacts", tags: ["a"] }]);
  });

  it("trims the name of a newly added collection", () => {
    const result = applySavedArgumentCollectionOp(existing, {
      addSavedArgumentCollection: { name: "  Framework  ", tags: ["a"] },
    });
    expect(result.next.at(-1)).toEqual({ name: "Framework", tags: ["a"] });
  });

  it("refuses adding a duplicate name and leaves the list unchanged", () => {
    const result = applySavedArgumentCollectionOp(existing, {
      addSavedArgumentCollection: { name: "topicality", tags: ["a"] },
    });
    expect(result.failure).toBe("duplicate-name");
    expect(result.next).toBe(existing);
  });

  it("removes a matching collection on removeSavedArgumentCollection", () => {
    const result = applySavedArgumentCollectionOp(existing, { removeSavedArgumentCollection: "Warming" });
    expect(result.failure).toBeNull();
    expect(result.next).toEqual([{ name: "Topicality", tags: ["t"] }]);
  });

  it("is idempotent (same reference) when removing an absent name", () => {
    const result = applySavedArgumentCollectionOp(existing, { removeSavedArgumentCollection: "Missing" });
    expect(result.failure).toBeNull();
    expect(result.next).toBe(existing);
  });

  it("renames a matching collection on renameSavedArgumentCollection", () => {
    const result = applySavedArgumentCollectionOp(existing, {
      renameSavedArgumentCollection: { oldName: "Warming", newName: "Climate" },
    });
    expect(result.failure).toBeNull();
    expect(result.next).toEqual([{ name: "Topicality", tags: ["t"] }, { name: "Climate", tags: ["climate"] }]);
  });

  it("refuses a rename onto another collection's name and leaves the list unchanged", () => {
    const result = applySavedArgumentCollectionOp(existing, {
      renameSavedArgumentCollection: { oldName: "Warming", newName: "topicality" },
    });
    expect(result.failure).toBe("duplicate-name");
    expect(result.next).toBe(existing);
  });

  it("refuses renaming a collection that no longer exists", () => {
    const result = applySavedArgumentCollectionOp(existing, {
      renameSavedArgumentCollection: { oldName: "Missing", newName: "Anything" },
    });
    expect(result.failure).toBe("unknown-collection");
    expect(result.next).toBe(existing);
  });

  it("replaces a matching collection's tags on updateSavedArgumentCollectionTags", () => {
    const result = applySavedArgumentCollectionOp(existing, {
      updateSavedArgumentCollectionTags: { name: "Warming", tags: ["new-tag"] },
    });
    expect(result.failure).toBeNull();
    expect(result.next).toEqual([{ name: "Topicality", tags: ["t"] }, { name: "Warming", tags: ["new-tag"] }]);
  });

  it("refuses an empty tags update and leaves the list unchanged", () => {
    const result = applySavedArgumentCollectionOp(existing, {
      updateSavedArgumentCollectionTags: { name: "Warming", tags: [] },
    });
    expect(result.failure).toBe("empty-tags");
    expect(result.next).toBe(existing);
  });

  it("returns the current list unchanged for an empty op", () => {
    const result = applySavedArgumentCollectionOp(existing, {});
    expect(result.failure).toBeNull();
    expect(result.next).toBe(existing);
  });

  it("resolves two different concurrent add ops onto the same starting list without dropping either", () => {
    // The scenario the whole-list-replace race used to lose: two
    // tabs/devices both read the same starting list, each adds a different
    // collection, and both ops must be applied server-side in sequence
    // against the *current* row rather than either tab's own stale copy.
    const afterFirst = applySavedArgumentCollectionOp(existing, {
      addSavedArgumentCollection: { name: "Tab A", tags: ["a"] },
    });
    const afterSecond = applySavedArgumentCollectionOp(afterFirst.next, {
      addSavedArgumentCollection: { name: "Tab B", tags: ["b"] },
    });
    expect(afterSecond.next.map((c) => c.name)).toEqual(["Topicality", "Warming", "Tab A", "Tab B"]);
  });
});

describe("buildSavedArgumentCollectionFailureMessage", () => {
  it("names the typed collection in the duplicate-name message", () => {
    expect(buildSavedArgumentCollectionFailureMessage("duplicate-name", " Warming ")).toBe(
      'A collection named "Warming" already exists.',
    );
  });

  it("distinguishes the at-capacity message from the duplicate-name one", () => {
    expect(buildSavedArgumentCollectionFailureMessage("at-capacity", "Warming")).toContain(
      `${MAX_SAVED_ARGUMENT_COLLECTIONS} saved collections`,
    );
  });
});
