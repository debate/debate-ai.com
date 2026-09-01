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
