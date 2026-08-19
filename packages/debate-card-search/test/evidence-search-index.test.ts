import { describe, expect, it } from "vitest";
import { buildEvidenceSearchIndex, searchEvidenceLibraryWithIndex } from "../src/lib/evidence-search-index";
import { searchEvidenceLibrary, type EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";

const entries: EvidenceLibraryEntry[] = [
  {
    id: "warming-1",
    argBlock: "Warming DA",
    wordCount: 250,
    topic: "Energy",
    caseArea: "DA",
    tags: ["climate", "impact"],
    kind: "card",
    text: "Rising global temperatures accelerate extreme weather and sea level rise.",
    cite: "Smith 24",
  },
  {
    id: "warming-2",
    argBlock: "Warming DA",
    wordCount: 300,
    topic: "Energy",
    caseArea: "DA",
    tags: ["climate"],
    kind: "card",
    text: "Warming trends correlate with increased frequency of coastal flooding events.",
    cite: "Jones 23",
  },
  {
    id: "states-block-1",
    argBlock: "States CP",
    wordCount: 120,
    topic: "Energy",
    caseArea: "CP",
    tags: ["federalism"],
    kind: "block",
    text: "States are better positioned than the federal government to tailor energy policy locally.",
    cite: "",
  },
  {
    id: "case-1",
    argBlock: "Case NEG",
    wordCount: 400,
    topic: "Healthcare",
    caseArea: "Case",
    tags: ["climate", "solvency"],
    kind: "card",
    text: "Solvency deficits undermine the affirmative's healthcare access claims.",
    cite: "Lee 22",
  },
];

describe("buildEvidenceSearchIndex", () => {
  it("indexes every entry by id", () => {
    const index = buildEvidenceSearchIndex(entries);
    expect(index.documentCount).toBe(4);
    expect(Array.from(index.entriesById.keys()).sort()).toEqual(
      ["case-1", "states-block-1", "warming-1", "warming-2"],
    );
  });

  it("builds a postings list mapping a term to every entry containing it", () => {
    const index = buildEvidenceSearchIndex(entries);
    const postings = index.postings.get("warming");
    expect(postings?.map((p) => p.entryId).sort()).toEqual(["warming-1", "warming-2"]);
  });

  it("records per-entry term frequency in the postings list", () => {
    const index = buildEvidenceSearchIndex([
      { ...entries[0], id: "repeat", argBlock: "", cite: "", text: "warming warming warming" },
    ]);
    expect(index.postings.get("warming")).toEqual([{ entryId: "repeat", termFrequency: 3 }]);
  });

  it("builds an empty index for an empty entry list", () => {
    const index = buildEvidenceSearchIndex([]);
    expect(index.documentCount).toBe(0);
    expect(index.entriesById.size).toBe(0);
    expect(index.postings.size).toBe(0);
  });
});

describe("searchEvidenceLibraryWithIndex", () => {
  it("returns every entry, tie-broken by id, when the query is empty", () => {
    const index = buildEvidenceSearchIndex(entries);
    const results = searchEvidenceLibraryWithIndex(index, {});
    expect(results.map((r) => r.entry.id)).toEqual(["case-1", "states-block-1", "warming-1", "warming-2"]);
    expect(results.every((r) => r.relevanceScore === 0)).toBe(true);
  });

  it("ranks entries matching more/rarer query terms above ones matching fewer", () => {
    const index = buildEvidenceSearchIndex(entries);
    const results = searchEvidenceLibraryWithIndex(index, { text: "warming coastal flooding" });
    expect(results.map((r) => r.entry.id)).toEqual(["warming-2", "warming-1"]);
    expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
    expect(results[0].relevanceScore).toBe(100);
  });

  it("weights a rarer query term (higher IDF) more than a common one shared by most of the corpus", () => {
    const base: EvidenceLibraryEntry = { ...entries[0], argBlock: "", cite: "" };
    const idfFixture: EvidenceLibraryEntry[] = [
      { ...base, id: "a", text: "common" },
      { ...base, id: "b", text: "common" },
      { ...base, id: "c", text: "common rare" },
      { ...base, id: "d", text: "common" },
    ];

    const results = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(idfFixture), {
      text: "common rare",
    });
    // "c" matches both the common and the rare term; "a"/"b"/"d" match only the common
    // term. A raw term-frequency-only ranking would tie all four together, but
    // IDF-weighting the rarer, more distinctive term should rank "c" clearly first.
    expect(results[0].entry.id).toBe("c");
    expect(results[0].relevanceScore).toBe(100);
    expect(results.slice(1).every((r) => r.relevanceScore < 100)).toBe(true);
  });

  it("matches a query term found only in the cite", () => {
    const results = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), { text: "Lee" });
    expect(results.map((r) => r.entry.id)).toEqual(["case-1"]);
  });

  it("returns no results when nothing matches the text query", () => {
    expect(searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), { text: "nuclear submarine" })).toEqual(
      [],
    );
  });

  it("returns no results against an empty index", () => {
    expect(searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex([]), { text: "warming" })).toEqual([]);
  });

  it("filters by topic", () => {
    const results = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), { topic: "Healthcare" });
    expect(results.map((r) => r.entry.id)).toEqual(["case-1"]);
  });

  it("filters by case area", () => {
    const results = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), { caseArea: "DA" });
    expect(results.map((r) => r.entry.id)).toEqual(["warming-1", "warming-2"]);
  });

  it("filters by kind, surfacing reusable blocks separately from cards", () => {
    const blocks = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), { kind: "block" });
    expect(blocks.map((r) => r.entry.id)).toEqual(["states-block-1"]);
  });

  it("filters by tags with 'any' mode by default", () => {
    const results = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), { tags: ["solvency"] });
    expect(results.map((r) => r.entry.id)).toEqual(["case-1"]);
  });

  it("filters by tags with 'all' mode requiring every tag", () => {
    const results = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), {
      tags: ["climate", "impact"],
      tagMode: "all",
    });
    expect(results.map((r) => r.entry.id)).toEqual(["warming-1"]);
  });

  it("combines filters and a text query", () => {
    const results = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), {
      topic: "Energy",
      kind: "card",
      text: "warming",
    });
    // Both match "warming", but warming-2 says it twice (once in text, once in argBlock)
    // against warming-1's once, so term-frequency weighting ranks it first.
    expect(results.map((r) => r.entry.id)).toEqual(["warming-2", "warming-1"]);
  });

  it("never visits an entry that shares no term with the query, even if it would pass every filter", () => {
    // "states-block-1" is the only "block" kind entry; searching that kind for an unrelated term
    // must fall through to zero results rather than returning the filtered-but-unmatched entry.
    const results = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), {
      kind: "block",
      text: "solvency",
    });
    expect(results).toEqual([]);
  });

  it("matches searchEvidenceLibrary's candidate set on a representative query, despite a different scoring method", () => {
    const query = { text: "warming coastal flooding" };
    const indexed = searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(entries), query);
    const linear = searchEvidenceLibrary(entries, query);
    expect(indexed.map((r) => r.entry.id).sort()).toEqual(linear.map((r) => r.entry.id).sort());
  });
});
