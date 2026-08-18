import { describe, expect, it } from "vitest";
import {
  buildEvidenceLibraryIndex,
  buildEvidenceSearchSummaryText,
  computeWordCount,
  findEntriesByCite,
  searchEvidenceLibrary,
  type EvidenceLibraryEntry,
} from "../src/lib/shared-evidence-library";

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

describe("searchEvidenceLibrary", () => {
  it("returns every entry, tie-broken by id, when the query is empty", () => {
    const results = searchEvidenceLibrary(entries, {});
    expect(results.map((r) => r.entry.id)).toEqual(["case-1", "states-block-1", "warming-1", "warming-2"]);
    expect(results.every((r) => r.relevanceScore === 0)).toBe(true);
  });

  it("ranks text matches by keyword relevance, dropping non-matches", () => {
    const results = searchEvidenceLibrary(entries, { text: "warming coastal flooding" });
    expect(results.map((r) => r.entry.id)).toEqual(["warming-2", "warming-1"]);
    expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
  });

  it("matches a query term found only in the cite", () => {
    const results = searchEvidenceLibrary(entries, { text: "Lee" });
    expect(results.map((r) => r.entry.id)).toEqual(["case-1"]);
  });

  it("returns no results when nothing matches the text query", () => {
    expect(searchEvidenceLibrary(entries, { text: "nuclear submarine" })).toEqual([]);
  });

  it("filters by topic", () => {
    const results = searchEvidenceLibrary(entries, { topic: "Healthcare" });
    expect(results.map((r) => r.entry.id)).toEqual(["case-1"]);
  });

  it("filters by case area", () => {
    const results = searchEvidenceLibrary(entries, { caseArea: "DA" });
    expect(results.map((r) => r.entry.id)).toEqual(["warming-1", "warming-2"]);
  });

  it("filters by kind, surfacing reusable blocks separately from cards", () => {
    const blocks = searchEvidenceLibrary(entries, { kind: "block" });
    expect(blocks.map((r) => r.entry.id)).toEqual(["states-block-1"]);
  });

  it("filters by tags with 'any' mode by default", () => {
    const results = searchEvidenceLibrary(entries, { tags: ["solvency"] });
    expect(results.map((r) => r.entry.id)).toEqual(["case-1"]);
  });

  it("filters by tags with 'all' mode requiring every tag", () => {
    const results = searchEvidenceLibrary(entries, { tags: ["climate", "impact"], tagMode: "all" });
    expect(results.map((r) => r.entry.id)).toEqual(["warming-1"]);
  });

  it("combines filters and a text query", () => {
    const results = searchEvidenceLibrary(entries, { topic: "Energy", kind: "card", text: "warming" });
    expect(results.map((r) => r.entry.id)).toEqual(["warming-1", "warming-2"]);
  });
});

describe("findEntriesByCite", () => {
  it("finds entries whose cite contains the query, case-insensitively", () => {
    expect(findEntriesByCite(entries, "smith").map((e) => e.id)).toEqual(["warming-1"]);
  });

  it("returns an empty array for a blank query", () => {
    expect(findEntriesByCite(entries, "  ")).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(findEntriesByCite(entries, "Nobody 99")).toEqual([]);
  });
});

describe("buildEvidenceLibraryIndex", () => {
  it("reuses buildArgumentLibrary to group entries into topic folders and tag collections", () => {
    const index = buildEvidenceLibraryIndex(entries);
    expect(index.topicFolders.map((f) => f.topic)).toEqual(["Energy", "Healthcare"]);
    expect(index.tagCollections.map((c) => c.tag)).toEqual(["climate", "federalism", "impact", "solvency"]);
  });
});

describe("computeWordCount", () => {
  it("counts space-separated words", () => {
    expect(computeWordCount("Rising emissions accelerate warming impacts.")).toBe(5);
  });

  it("collapses repeated whitespace, including newlines and tabs", () => {
    expect(computeWordCount("Line one\n\nLine  two\tthree")).toBe(5);
  });

  it("trims leading and trailing whitespace before counting", () => {
    expect(computeWordCount("  padded text  ")).toBe(2);
  });

  it("returns 0 for an empty or whitespace-only string", () => {
    expect(computeWordCount("")).toBe(0);
    expect(computeWordCount("   ")).toBe(0);
  });
});

describe("buildEvidenceSearchSummaryText", () => {
  it("renders a count-only summary with no text query", () => {
    expect(buildEvidenceSearchSummaryText(searchEvidenceLibrary(entries), {})).toBe("4 results");
  });

  it("renders a singular count", () => {
    const results = searchEvidenceLibrary(entries, { topic: "Healthcare" });
    expect(buildEvidenceSearchSummaryText(results, { topic: "Healthcare" })).toBe("1 result");
  });

  it("quotes the text query in the summary", () => {
    const query = { text: "warming" };
    expect(buildEvidenceSearchSummaryText(searchEvidenceLibrary(entries, query), query)).toBe(
      '2 results for "warming"',
    );
  });
});
