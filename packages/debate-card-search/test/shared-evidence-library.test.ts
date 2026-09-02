import { describe, expect, it } from "vitest";
import {
  buildEvidenceEntryAnnouncementText,
  buildEvidenceEntryRevision,
  buildEvidenceLibraryIndex,
  buildEvidenceSearchFormQuery,
  buildEvidenceSearchSummaryText,
  buildPageReuseCheckSummaryText,
  buildReuseCheckDeepLink,
  buildStaleEvidenceDigest,
  checkPageForExistingCards,
  computeWordCount,
  deriveCardSnapshotFromEntry,
  findEntriesByCite,
  findEntriesBySourceUrl,
  getEvidenceStaleness,
  getStaleEvidenceEntries,
  normalizeSourceUrl,
  searchEvidenceLibrary,
  type EvidenceLibraryEntry,
} from "../src/lib/shared-evidence-library";
import { STALE_EVIDENCE_THRESHOLD_YEARS, evaluateRevision } from "../src/lib/revision-incentives";

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

describe("normalizeSourceUrl", () => {
  it("lower-cases the url", () => {
    expect(normalizeSourceUrl("HTTPS://Example.com/Article")).toBe("example.com/article");
  });

  it("strips the scheme", () => {
    expect(normalizeSourceUrl("https://example.com/article")).toBe("example.com/article");
    expect(normalizeSourceUrl("http://example.com/article")).toBe("example.com/article");
  });

  it("strips a leading www.", () => {
    expect(normalizeSourceUrl("https://www.example.com/article")).toBe("example.com/article");
  });

  it("strips query strings and fragments", () => {
    expect(normalizeSourceUrl("https://example.com/article?utm_source=x")).toBe("example.com/article");
    expect(normalizeSourceUrl("https://example.com/article#section")).toBe("example.com/article");
  });

  it("strips trailing slashes", () => {
    expect(normalizeSourceUrl("https://example.com/article/")).toBe("example.com/article");
  });

  it("treats equivalent urls as equal after normalization", () => {
    const a = normalizeSourceUrl("https://www.example.com/article/?utm_source=newsletter");
    const b = normalizeSourceUrl("http://example.com/article");
    expect(a).toBe(b);
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSourceUrl("  https://example.com/article  ")).toBe("example.com/article");
  });
});

describe("findEntriesBySourceUrl", () => {
  const withUrls: EvidenceLibraryEntry[] = [
    ...entries,
    { ...entries[0], id: "warming-3", sourceUrl: "https://news.example.com/warming-report" },
    { ...entries[1], id: "warming-4", sourceUrl: "https://www.news.example.com/warming-report/?utm_source=x" },
    { ...entries[2], id: "states-block-2", sourceUrl: "https://example.com/states" },
  ];

  it("matches entries whose sourceUrl normalizes to the same page", () => {
    const matches = findEntriesBySourceUrl(withUrls, "http://news.example.com/warming-report");
    expect(matches.map((e) => e.id).sort()).toEqual(["warming-3", "warming-4"]);
  });

  it("ignores entries with no sourceUrl", () => {
    const matches = findEntriesBySourceUrl(withUrls, "http://news.example.com/warming-report");
    expect(matches.some((e) => e.id === "warming-1")).toBe(false);
  });

  it("returns an empty array when nothing matches", () => {
    expect(findEntriesBySourceUrl(withUrls, "https://example.com/unrelated")).toEqual([]);
  });

  it("returns an empty array for a blank url", () => {
    expect(findEntriesBySourceUrl(withUrls, "  ")).toEqual([]);
  });
});

describe("checkPageForExistingCards", () => {
  const withUrls: EvidenceLibraryEntry[] = [
    ...entries,
    { ...entries[0], id: "warming-3", sourceUrl: "https://news.example.com/warming-report" },
  ];

  it("reports alreadyCut true with matches when a card exists for the page", () => {
    const result = checkPageForExistingCards(withUrls, "https://news.example.com/warming-report/");
    expect(result.alreadyCut).toBe(true);
    expect(result.matches.map((e) => e.id)).toEqual(["warming-3"]);
    expect(result.url).toBe("https://news.example.com/warming-report/");
  });

  it("reports alreadyCut false with no matches when the page hasn't been cut", () => {
    const result = checkPageForExistingCards(withUrls, "https://example.com/never-cut");
    expect(result.alreadyCut).toBe(false);
    expect(result.matches).toEqual([]);
  });
});

describe("buildPageReuseCheckSummaryText", () => {
  it("summarizes a page with no existing cards", () => {
    expect(buildPageReuseCheckSummaryText({ url: "x", alreadyCut: false, matches: [] })).toBe(
      "No existing cards found for this page — safe to cut.",
    );
  });

  it("summarizes a page with one existing card, singular", () => {
    const result = checkPageForExistingCards(
      [{ ...entries[0], sourceUrl: "https://example.com/a" }],
      "https://example.com/a",
    );
    expect(buildPageReuseCheckSummaryText(result)).toBe("Already cut: 1 existing entry for this page.");
  });

  it("summarizes a page with multiple existing cards, plural", () => {
    const result = checkPageForExistingCards(
      [
        { ...entries[0], id: "a1", sourceUrl: "https://example.com/a" },
        { ...entries[1], id: "a2", sourceUrl: "https://example.com/a" },
      ],
      "https://example.com/a",
    );
    expect(buildPageReuseCheckSummaryText(result)).toBe("Already cut: 2 existing entries for this page.");
  });
});

describe("buildReuseCheckDeepLink", () => {
  it("builds a checkUrl deep link into /cards/library", () => {
    expect(buildReuseCheckDeepLink("https://debate-ai.com", "https://example.com/article")).toBe(
      "https://debate-ai.com/cards/library?checkUrl=https%3A%2F%2Fexample.com%2Farticle",
    );
  });

  it("strips a trailing slash (or several) from the app origin", () => {
    expect(buildReuseCheckDeepLink("https://debate-ai.com/", "https://example.com/a")).toBe(
      buildReuseCheckDeepLink("https://debate-ai.com", "https://example.com/a"),
    );
    expect(buildReuseCheckDeepLink("https://debate-ai.com///", "https://example.com/a")).toBe(
      buildReuseCheckDeepLink("https://debate-ai.com", "https://example.com/a"),
    );
  });

  it("trims whitespace around both the origin and the page URL", () => {
    expect(buildReuseCheckDeepLink("  https://debate-ai.com  ", "  https://example.com/a  ")).toBe(
      "https://debate-ai.com/cards/library?checkUrl=https%3A%2F%2Fexample.com%2Fa",
    );
  });

  it("percent-encodes query strings and special characters in the page URL", () => {
    expect(buildReuseCheckDeepLink("https://debate-ai.com", "https://example.com/a?x=1&y=2")).toBe(
      "https://debate-ai.com/cards/library?checkUrl=https%3A%2F%2Fexample.com%2Fa%3Fx%3D1%26y%3D2",
    );
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

describe("buildEvidenceEntryAnnouncementText", () => {
  it("includes the citation for a card entry", () => {
    expect(buildEvidenceEntryAnnouncementText(entries[0])).toBe(
      'New card for "Warming DA" citing Smith 24: Rising global temperatures accelerate extreme weather and sea level rise.',
    );
  });

  it("omits the citing clause for a block entry with no cite", () => {
    expect(buildEvidenceEntryAnnouncementText(entries[2])).toBe(
      'New analytic block for "States CP": States are better positioned than the federal government to tailor energy policy locally.',
    );
  });

  it("truncates a long body with an ellipsis", () => {
    const longText = "x".repeat(200);
    const entry: EvidenceLibraryEntry = { ...entries[0], text: longText };
    const rendered = buildEvidenceEntryAnnouncementText(entry);
    expect(rendered).toBe(`New card for "Warming DA" citing Smith 24: ${"x".repeat(140)}…`);
  });
});

describe("buildEvidenceSearchFormQuery", () => {
  it("passes text through as-is, even when blank", () => {
    expect(buildEvidenceSearchFormQuery({ text: "", kind: undefined, topic: "", caseArea: "", tags: "" })).toEqual({
      text: "",
    });
  });

  it("omits kind when undefined ('any kind')", () => {
    const query = buildEvidenceSearchFormQuery({ text: "warming", kind: undefined, topic: "", caseArea: "", tags: "" });
    expect(query).not.toHaveProperty("kind");
  });

  it("includes kind when set", () => {
    const query = buildEvidenceSearchFormQuery({ text: "", kind: "block", topic: "", caseArea: "", tags: "" });
    expect(query.kind).toBe("block");
  });

  it("trims and includes topic/caseArea, omitting them when blank", () => {
    const query = buildEvidenceSearchFormQuery({
      text: "",
      topic: "  Energy  ",
      caseArea: "  DA  ",
      tags: "",
    });
    expect(query.topic).toBe("Energy");
    expect(query.caseArea).toBe("DA");
  });

  it("omits topic/caseArea when whitespace-only", () => {
    const query = buildEvidenceSearchFormQuery({ text: "", topic: "   ", caseArea: "  ", tags: "" });
    expect(query).not.toHaveProperty("topic");
    expect(query).not.toHaveProperty("caseArea");
  });

  it("parses comma-separated tags, trimming and dropping empty entries", () => {
    const query = buildEvidenceSearchFormQuery({ text: "", topic: "", caseArea: "", tags: "climate, , impact ," });
    expect(query.tags).toEqual(["climate", "impact"]);
  });

  it("omits tags entirely when the field is blank", () => {
    const query = buildEvidenceSearchFormQuery({ text: "", topic: "", caseArea: "", tags: "" });
    expect(query).not.toHaveProperty("tags");
  });

  it("combines every filter into one query, usable directly by searchEvidenceLibrary", () => {
    const query = buildEvidenceSearchFormQuery({
      text: "warming",
      kind: "card",
      topic: "Energy",
      caseArea: "DA",
      tags: "climate",
    });
    const results = searchEvidenceLibrary(entries, query);
    expect(results.map((r) => r.entry.id)).toEqual(["warming-1", "warming-2"]);
  });
});

function entry(overrides: Partial<EvidenceLibraryEntry> = {}): EvidenceLibraryEntry {
  return {
    id: "entry-1",
    argBlock: "Warming DA",
    wordCount: 0,
    topic: "Energy",
    caseArea: "DA",
    tags: [],
    kind: "card",
    text: "Rising global temperatures accelerate extreme weather and sea level rise across every coastal region studied.",
    cite: "",
    ...overrides,
  };
}

describe("deriveCardSnapshotFromEntry", () => {
  it("parses a 4-digit year out of the citation as evidenceYear, with full citationCompleteness", () => {
    const snapshot = deriveCardSnapshotFromEntry(entry({ cite: "Smith 2024" }));
    expect(snapshot.evidenceYear).toBe(2024);
    expect(snapshot.citationCompleteness).toBe(1);
  });

  it("gives partial citationCompleteness and no evidenceYear for a non-blank citation without a year", () => {
    const snapshot = deriveCardSnapshotFromEntry(entry({ cite: "Smith ND" }));
    expect(snapshot.evidenceYear).toBe(0);
    expect(snapshot.citationCompleteness).toBe(0.5);
  });

  it("gives zero citationCompleteness for a blank citation", () => {
    const snapshot = deriveCardSnapshotFromEntry(entry({ cite: "" }));
    expect(snapshot.evidenceYear).toBe(0);
    expect(snapshot.citationCompleteness).toBe(0);
  });

  it("stamps wordCount from the entry's text via computeWordCount", () => {
    const text = "Short two-sentence card. Second sentence here.";
    const snapshot = deriveCardSnapshotFromEntry(entry({ text }));
    expect(snapshot.wordCount).toBe(computeWordCount(text));
  });

  it("derives two 0-1 qualitySignals from the entry's text", () => {
    const snapshot = deriveCardSnapshotFromEntry(entry());
    expect(snapshot.qualitySignals).toHaveLength(2);
    for (const signal of snapshot.qualitySignals) {
      expect(signal).toBeGreaterThanOrEqual(0);
      expect(signal).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildEvidenceEntryRevision", () => {
  it("builds a CardRevision keyed by the after entry's id and the given contributor", () => {
    const before = entry({ id: "card-9", cite: "" });
    const after = entry({ id: "card-9", cite: "Smith 2024" });

    const revision = buildEvidenceEntryRevision(before, after, "alice");
    expect(revision.cardId).toBe("card-9");
    expect(revision.contributorId).toBe("alice");
    expect(revision.before).toEqual(deriveCardSnapshotFromEntry(before));
    expect(revision.after).toEqual(deriveCardSnapshotFromEntry(after));
  });

  it("scores a real edit that adds a dated citation as a rewarded citation-strengthening/evidence-refresh", () => {
    const before = entry({ cite: "" });
    const after = entry({ cite: "Smith 2024" });

    const evaluation = evaluateRevision(buildEvidenceEntryRevision(before, after, "alice"));
    expect(evaluation.citationStrengthened).toBe(true);
    expect(evaluation.evidenceRefreshed).toBe(true);
    expect(evaluation.isRewardedImprovement).toBe(true);
  });

  it("scores an edit with no meaningful change as unrewarded", () => {
    const before = entry();
    const after = entry();

    const evaluation = evaluateRevision(buildEvidenceEntryRevision(before, after, "alice"));
    expect(evaluation.isRewardedImprovement).toBe(false);
  });
});

describe("getEvidenceStaleness", () => {
  it("flags a card with an old citation year as stale", () => {
    const oldCard = entry({ cite: `Smith ${2026 - STALE_EVIDENCE_THRESHOLD_YEARS}` });
    expect(getEvidenceStaleness(oldCard, 2026).isStale).toBe(true);
  });

  it("does not flag a card with a recent citation year as stale", () => {
    const freshCard = entry({ cite: "Smith 2026" });
    expect(getEvidenceStaleness(freshCard, 2026).isStale).toBe(false);
  });

  it("flags a card with an undated citation as stale", () => {
    expect(getEvidenceStaleness(entry({ cite: "Smith ND" }), 2026).isStale).toBe(true);
  });

  it("flags a card with no citation at all as stale", () => {
    expect(getEvidenceStaleness(entry({ cite: "" }), 2026).isStale).toBe(true);
  });
});

describe("getStaleEvidenceEntries", () => {
  it("returns only stale card entries, excluding blocks and fresh cards", () => {
    const staleCard = entry({ id: "stale-card", cite: "Lee 2018" });
    const freshCard = entry({ id: "fresh-card", cite: "Smith 2026" });
    const staleBlock = entry({ id: "stale-block", kind: "block", cite: "" });

    const stale = getStaleEvidenceEntries([staleCard, freshCard, staleBlock], 2026);
    expect(stale.map((e) => e.id)).toEqual(["stale-card"]);
  });

  it("returns an empty array when nothing is stale", () => {
    expect(getStaleEvidenceEntries([entry({ cite: "Smith 2026" })], 2026)).toEqual([]);
  });
});

describe("buildStaleEvidenceDigest", () => {
  it("ranks undated entries before dated ones, and older years before newer ones", () => {
    const undated = entry({ id: "undated", argBlock: "Z Block", cite: "" });
    const veryOld = entry({ id: "very-old", argBlock: "A Block", cite: "Lee 2015" });
    const barelyStale = entry({ id: "barely-stale", argBlock: "B Block", cite: `Smith ${2026 - STALE_EVIDENCE_THRESHOLD_YEARS}` });

    const digest = buildStaleEvidenceDigest([barelyStale, veryOld, undated], 2026);

    expect(digest.map((d) => d.entry.id)).toEqual(["undated", "very-old", "barely-stale"]);
    expect(digest[0].staleness.ageYears).toBeNull();
    expect(digest[1].staleness.ageYears).toBe(11);
    expect(digest[2].staleness.ageYears).toBe(STALE_EVIDENCE_THRESHOLD_YEARS);
  });

  it("breaks ties by argBlock", () => {
    const b = entry({ id: "b", argBlock: "B Block", cite: "Lee 2015" });
    const a = entry({ id: "a", argBlock: "A Block", cite: "Smith 2015" });

    const digest = buildStaleEvidenceDigest([b, a], 2026);
    expect(digest.map((d) => d.entry.id)).toEqual(["a", "b"]);
  });

  it("excludes blocks and fresh cards, mirroring getStaleEvidenceEntries", () => {
    const staleCard = entry({ id: "stale-card", cite: "Lee 2018" });
    const freshCard = entry({ id: "fresh-card", cite: "Smith 2026" });
    const staleBlock = entry({ id: "stale-block", kind: "block", cite: "" });

    const digest = buildStaleEvidenceDigest([staleCard, freshCard, staleBlock], 2026);
    expect(digest.map((d) => d.entry.id)).toEqual(["stale-card"]);
  });

  it("returns an empty array when nothing is stale", () => {
    expect(buildStaleEvidenceDigest([entry({ cite: "Smith 2026" })], 2026)).toEqual([]);
  });
});
