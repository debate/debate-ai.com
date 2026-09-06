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
