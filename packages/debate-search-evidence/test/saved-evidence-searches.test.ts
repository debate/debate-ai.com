import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAVED_EVIDENCE_SEARCHES,
  MAX_SAVED_EVIDENCE_SEARCHES,
  diffNewEvidenceSearchMatchIds,
  isValidSavedEvidenceSearchName,
  isValidSavedEvidenceSearchesList,
  normalizeSavedEvidenceSearchName,
  normalizeSavedEvidenceSearchesPatch,
  parseSavedEvidenceSearches,
  serializeSavedEvidenceSearches,
  type SavedEvidenceSearch,
} from "../src/lib/saved-evidence-searches";

function buildSearch(overrides: Partial<SavedEvidenceSearch> = {}): SavedEvidenceSearch {
  return {
    id: "search-1",
    name: "New topicality cards",
    filters: { text: "topicality", kind: "card", topic: "", caseArea: "", tags: "" },
    createdAt: 1_700_000_000_000,
    seenEntryIds: ["entry-1", "entry-2"],
    ...overrides,
  };
}

describe("diffNewEvidenceSearchMatchIds", () => {
  it("returns only ids not already in the seen list, preserving order", () => {
    expect(diffNewEvidenceSearchMatchIds(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });

  it("returns every id when nothing has been seen yet", () => {
    expect(diffNewEvidenceSearchMatchIds(["a", "b"], [])).toEqual(["a", "b"]);
  });

  it("returns an empty list when every current id was already seen", () => {
    expect(diffNewEvidenceSearchMatchIds(["a", "b"], ["a", "b", "c"])).toEqual([]);
  });

  it("returns an empty list against no current matches", () => {
    expect(diffNewEvidenceSearchMatchIds([], ["a"])).toEqual([]);
  });
});

describe("isValidSavedEvidenceSearchName", () => {
  it("accepts a non-empty, bounded-length name", () => {
    expect(isValidSavedEvidenceSearchName("New cards")).toBe(true);
  });

  it("rejects a blank or whitespace-only name", () => {
    expect(isValidSavedEvidenceSearchName("   ")).toBe(false);
  });

  it("rejects a name longer than 60 characters", () => {
    expect(isValidSavedEvidenceSearchName("x".repeat(61))).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(isValidSavedEvidenceSearchName(42)).toBe(false);
  });
});

describe("normalizeSavedEvidenceSearchName", () => {
  it("trims and upper-cases for duplicate detection", () => {
    expect(normalizeSavedEvidenceSearchName("  new Cards ")).toBe("NEW CARDS");
  });
});

describe("isValidSavedEvidenceSearchesList", () => {
  it("accepts a well-formed list", () => {
    expect(isValidSavedEvidenceSearchesList([buildSearch()])).toBe(true);
  });

  it("accepts an empty list", () => {
    expect(isValidSavedEvidenceSearchesList([])).toBe(true);
  });

  it("rejects a non-array value", () => {
    expect(isValidSavedEvidenceSearchesList({})).toBe(false);
  });

  it("rejects a list longer than the cap", () => {
    const list = Array.from({ length: MAX_SAVED_EVIDENCE_SEARCHES + 1 }, (_, i) =>
      buildSearch({ id: `search-${i}`, name: `Search ${i}` }),
    );
    expect(isValidSavedEvidenceSearchesList(list)).toBe(false);
  });

  it("rejects an entry with a malformed filters object", () => {
    const bad = { ...buildSearch(), filters: { text: 5, topic: "", caseArea: "", tags: "" } };
    expect(isValidSavedEvidenceSearchesList([bad])).toBe(false);
  });

  it("rejects an entry with an invalid kind filter", () => {
    const bad = buildSearch({ filters: { text: "", kind: "essay" as never, topic: "", caseArea: "", tags: "" } });
    expect(isValidSavedEvidenceSearchesList([bad])).toBe(false);
  });

  it("rejects an entry with a non-string-array seenEntryIds", () => {
    const bad = { ...buildSearch(), seenEntryIds: [1, 2] };
    expect(isValidSavedEvidenceSearchesList([bad])).toBe(false);
  });

  it("rejects two entries sharing an id", () => {
    const list = [buildSearch({ id: "dup", name: "One" }), buildSearch({ id: "dup", name: "Two" })];
    expect(isValidSavedEvidenceSearchesList(list)).toBe(false);
  });

  it("rejects two entries sharing a name case-insensitively", () => {
    const list = [
      buildSearch({ id: "a", name: "Topicality" }),
      buildSearch({ id: "b", name: "  topicality  " }),
    ];
    expect(isValidSavedEvidenceSearchesList(list)).toBe(false);
  });
});

describe("normalizeSavedEvidenceSearchesPatch", () => {
  it("accepts a well-formed patch", () => {
    const result = normalizeSavedEvidenceSearchesPatch({ savedEvidenceSearches: [buildSearch()] });
    expect(result.errors).toEqual([]);
    expect(result.valid.savedEvidenceSearches).toHaveLength(1);
  });

  it("omits the field entirely when absent from the input", () => {
    const result = normalizeSavedEvidenceSearchesPatch({ someOtherField: 1 });
    expect(result.errors).toEqual([]);
    expect(result.valid.savedEvidenceSearches).toBeUndefined();
  });

  it("rejects a malformed list with a descriptive error", () => {
    const result = normalizeSavedEvidenceSearchesPatch({ savedEvidenceSearches: "not-an-array" });
    expect(result.valid.savedEvidenceSearches).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/savedEvidenceSearches/);
  });

  it("rejects a non-object request body", () => {
    const result = normalizeSavedEvidenceSearchesPatch("nope");
    expect(result.errors).toEqual(["Request body must be a JSON object."]);
  });
});

describe("serializeSavedEvidenceSearches / parseSavedEvidenceSearches", () => {
  it("round-trips a non-empty list", () => {
    const list = [buildSearch()];
    const serialized = serializeSavedEvidenceSearches(list);
    expect(serialized).not.toBeNull();
    expect(parseSavedEvidenceSearches(serialized)).toEqual(list);
  });

  it("serializes an empty list to null", () => {
    expect(serializeSavedEvidenceSearches([])).toBeNull();
  });

  it("parses null/undefined as an empty list", () => {
    expect(parseSavedEvidenceSearches(null)).toEqual([]);
    expect(parseSavedEvidenceSearches(undefined)).toEqual([]);
  });

  it("parses malformed JSON as an empty list rather than throwing", () => {
    expect(parseSavedEvidenceSearches("{not json")).toEqual([]);
  });

  it("parses well-formed JSON that fails shape validation as an empty list", () => {
    expect(parseSavedEvidenceSearches(JSON.stringify([{ id: "x" }]))).toEqual([]);
  });
});

describe("DEFAULT_SAVED_EVIDENCE_SEARCHES", () => {
  it("is an empty list", () => {
    expect(DEFAULT_SAVED_EVIDENCE_SEARCHES.savedEvidenceSearches).toEqual([]);
  });
});
