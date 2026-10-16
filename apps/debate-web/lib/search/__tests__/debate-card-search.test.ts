import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/lib/database/schema";
import { debateCards } from "@/lib/database/schema";
import { applySchema } from "@/lib/database/__tests__/schema-sql";
import {
  buildRecentCardOrderBy,
  mapCaselistDocumentToSearchResult,
  mapRoundVideoToSearchResult,
  readSearchKind,
  buildCardSearchOrderBy,
  buildCardSearchWhere,
  escapeLikePattern,
  mapDebateCardToSearchResult,
  readSearchScope,
  sortSearchResults,
} from "../debate-card-search";


/** A fresh in-memory database with the card table migrated in. */
async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

/** A card row shaped like the imported dump. */
function card(overrides: Partial<typeof debateCards.$inferInsert> = {}) {
  return {
    id: 1,
    tag: "Nuclear deterrence solves existential threats",
    cite: "Chilton 18",
    fullcite: "General Kevin P. Chilton, Spring 2018, Strategic Studies Quarterly",
    summary: "Nuclear deterrence underpins national security.",
    spoken: "nuclear deterrence underpins the national security of the United States",
    fulltext: "Some argue the US nuclear deterrent should be eliminated.",
    textLength: 2085,
    markup: "<h4>Nuclear deterrence solves existential threats</h4><p><mark>deterrence</mark> <u>underpins</u></p>",
    pocket: "DA",
    hat: "1NC—Deterrence",
    block: "Deterrence Good",
    bucketId: 1,
    duplicateCount: 0,
    side: "n",
    caselistDisplayName: "NDT/CEDA College 2022-23",
    year: 2018,
    event: "CX",
    level: "College",
    sourceFile: "shard-1.parquet",
    importedAt: 0,
    ...overrides,
  };
}

describe("buildCardSearchWhere", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  /** Runs a search and returns the ids it matched. */
  async function search(input: Parameters<typeof buildCardSearchWhere>[0]) {
    const rows = await db.select().from(debateCards).where(buildCardSearchWhere(input));
    return rows.map((row) => row.id);
  }

  beforeEach(async () => {
    db = await freshDb();
    await db.insert(debateCards).values([
      card(),
      card({
        id: 2,
        tag: "Warming is irreversible",
        cite: "Peterson 14",
        fullcite: "Peterson, 2014",
        summary: "An effective health care system is key.",
        spoken: "an effective health surveillance system",
        fulltext: "Both the enslaved and minerals are recognized.",
        markup: "<h4>Warming is irreversible</h4><p><mark>surveillance</mark> <u>system</u></p>",
        pocket: "K",
        hat: "1AC—Warming",
        block: "Warming Advantage",
        caselistDisplayName: "HS LD 2022-23",
        year: 2014,
        event: "LD",
      }),
    ]);
  });

  // The regression this module exists for: the route matched text with
  // drizzle's `ilike`, which SQLite rejects, so every search with a term threw
  // and the route reported zero results.
  it("matches a search term instead of throwing on SQLite", async () => {
    await expect(search({ query: "deterrence" })).resolves.toEqual([1]);
  });

  it("matches case-insensitively", async () => {
    await expect(search({ query: "NUCLEAR" })).resolves.toEqual([1]);
    await expect(search({ query: "nuclear" })).resolves.toEqual([1]);
  });

  it("searches every indexed field by default", async () => {
    // tag, summary, fulltext, cite, the outline path and the markup alike.
    await expect(search({ query: "existential" })).resolves.toEqual([1]);
    await expect(search({ query: "enslaved" })).resolves.toEqual([2]);
    await expect(search({ query: "Chilton" })).resolves.toEqual([1]);
    await expect(search({ query: "Warming Advantage" })).resolves.toEqual([2]);
  });

  it("returns every card when nothing constrains the query", async () => {
    await expect(search({})).resolves.toEqual([1, 2]);
    await expect(search({ query: "   " })).resolves.toEqual([1, 2]);
  });

  it("returns nothing for a term no card carries", async () => {
    await expect(search({ query: "zebra" })).resolves.toEqual([]);
  });

  it("treats LIKE wildcards in the search term as literal text", async () => {
    // Before escaping, "%" matched every card in the corpus.
    await expect(search({ query: "%" })).resolves.toEqual([]);
    await expect(search({ query: "nuclear_deterrence" })).resolves.toEqual([]);
  });

  it("scopes a highlighted search to the spoken projection", async () => {
    await expect(search({ query: "surveillance", searchHighlighted: true })).resolves.toEqual([2]);
    // "enslaved" is in the body but not in anything highlighted.
    await expect(search({ query: "enslaved", searchHighlighted: true })).resolves.toEqual([]);
  });

  it("scopes an underlined search to underlined markup", async () => {
    await expect(search({ query: "underpins", searchUnderlined: true })).resolves.toEqual([1]);
    await expect(search({ query: "existential", searchUnderlined: true })).resolves.toEqual([]);
  });

  it("scopes a summary search to the summary line", async () => {
    await expect(search({ query: "health care", searchSummaries: true })).resolves.toEqual([2]);
    await expect(search({ query: "enslaved", searchSummaries: true })).resolves.toEqual([]);
  });

  it("scopes a titles search to the outline path", async () => {
    await expect(search({ query: "1NC", searchBlockAndFileTitles: true })).resolves.toEqual([1]);
    await expect(search({ query: "existential", searchBlockAndFileTitles: true })).resolves.toEqual([]);
  });

  it("lets All Text override a narrower scope", async () => {
    await expect(
      search({ query: "enslaved", searchSummaries: true, searchAllText: true }),
    ).resolves.toEqual([2]);
  });

  it("filters by season year in both two- and four-digit form", async () => {
    await expect(search({ year: "2018" })).resolves.toEqual([1]);
    await expect(search({ year: "18" })).resolves.toEqual([1]);
  });

  it("filters by school and tournament against the caselist name", async () => {
    await expect(search({ school: "NDT" })).resolves.toEqual([1]);
    await expect(search({ tournament: "HS LD" })).resolves.toEqual([2]);
  });

  it("filters by event, ignoring the 'all' sentinel", async () => {
    await expect(search({ event: "ld" })).resolves.toEqual([2]);
    await expect(search({ event: "all" })).resolves.toEqual([1, 2]);
  });

  it("combines a term with its filters", async () => {
    await expect(search({ query: "system", event: "LD" })).resolves.toEqual([2]);
    await expect(search({ query: "system", event: "CX" })).resolves.toEqual([]);
  });

  it("matches nothing for a debater-name filter the corpus cannot answer", async () => {
    await expect(search({ team: "Yusoff" })).resolves.toEqual([]);
  });
});

describe("escapeLikePattern", () => {
  it("escapes the wildcards LIKE would otherwise interpret", () => {
    expect(escapeLikePattern("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLikePattern("nuclear deterrence")).toBe("nuclear deterrence");
  });
});

describe("readSearchScope", () => {
  it("reads the flags the search sidebar sends", () => {
    const scope = readSearchScope(new URLSearchParams("searchHighlighted=1&searchBlockAndFileTitles=1"));
    expect(scope).toEqual({
      searchHighlighted: true,
      searchUnderlined: false,
      searchSummaries: false,
      searchBlockAndFileTitles: true,
      searchAllText: false,
    });
  });
});

describe("mapDebateCardToSearchResult", () => {
  it("projects a stored row into the shape the card viewer renders", () => {
    const result = mapDebateCardToSearchResult(card());

    expect(result.tag).toBe("Nuclear deterrence solves existential threats");
    expect(result.cite_short).toBe("Chilton 18");
    expect(result.argBlock).toBe("DA > 1NC—Deterrence > Deterrence Good");
    expect(result.category).toBe("DA");
    expect(result.year).toBe("2018");
    expect(result.word_count).toBe(417);
    expect(result.html).toContain("<mark>deterrence</mark>");
  });

  it("uses the dump's duplicateCount as the rounds-read count", () => {
    expect(mapDebateCardToSearchResult(card({ duplicateCount: 42 })).readCount).toBe(42);
    expect(mapDebateCardToSearchResult(card({ duplicateCount: 0 })).readCount).toBe(0);
  });

  it("falls back to the tag when a card has no outline path", () => {
    const result = mapDebateCardToSearchResult(card({ pocket: "", hat: "", block: "" }));
    expect(result.argBlock).toBe("Nuclear deterrence solves existential threats");
  });
});

describe("buildCardSearchOrderBy", () => {
  it("ranks the whole corpus by duplicateCount for Most read", async () => {
    const db = await freshDb();
    await db.insert(debateCards).values([
      card({ id: 1, duplicateCount: 3 }),
      card({ id: 2, duplicateCount: 50 }),
      card({ id: 3, duplicateCount: 7 }),
    ]);
    const rows = await db
      .select()
      .from(debateCards)
      .orderBy(...buildCardSearchOrderBy("readCount:desc"))
      .limit(2);
    expect(rows.map((row) => row.id)).toEqual([2, 3]);
  });

  it("orders by recent season, then most read, for Recent & Popular", async () => {
    const db = await freshDb();
    await db.insert(debateCards).values([
      card({ id: 1, year: 2024, duplicateCount: 900 }),
      card({ id: 2, year: 2026, duplicateCount: 5 }),
      card({ id: 3, year: 2026, duplicateCount: 500 }),
      card({ id: 4, year: 2026, duplicateCount: 500 }),
    ]);
    const rows = await db
      .select()
      .from(debateCards)
      .orderBy(...buildCardSearchOrderBy("recentPopular:desc"))
      .limit(3);
    // 2026 first; within it the 500-read cards ahead of the 5-read
    // one, the tie broken by the newer card id.
    expect(rows.map((row) => row.id)).toEqual([4, 3, 2]);
  });

  it("leaves other sorts to the database order", () => {
    expect(buildCardSearchOrderBy("_text_match:desc")).toEqual([]);
  });
});

describe("sortSearchResults", () => {
  const results = () => [
    { year: "2014", highlightLength: 300, readCount: 1 },
    { year: "2018", highlightLength: 100, readCount: 9 },
  ];

  it("sorts newest and oldest by year", () => {
    expect(sortSearchResults(results(), "year:desc").map((r) => r.year)).toEqual(["2018", "2014"]);
    expect(sortSearchResults(results(), "year:asc").map((r) => r.year)).toEqual(["2014", "2018"]);
  });

  it("sorts shortest and longest by highlight length", () => {
    expect(sortSearchResults(results(), "highlightLength:asc").map((r) => r.highlightLength)).toEqual([100, 300]);
  });

  it("sorts recent and popular cards first", () => {
    const recent = [
      { year: "2024", readCount: 900 },
      { year: "2026", readCount: 5 },
      { year: "2026", readCount: 500 },
      { year: "", readCount: 10_000 },
    ];
    expect(sortSearchResults(recent, "recentPopular:desc").map((r) => `${r.year}:${r.readCount}`)).toEqual([
      "2026:500",
      "2026:5",
      "2024:900",
      ":10000",
    ]);
  });

  it("leaves relevance order to the database", () => {
    expect(sortSearchResults(results(), "_text_match:desc").map((r) => r.year)).toEqual(["2014", "2018"]);
  });
});

describe("readSearchKind", () => {
  it("reads the single toggle the sidebar sends", () => {
    expect(readSearchKind(new URLSearchParams("searchQuotes=1"))).toBe("quotes");
    expect(readSearchKind(new URLSearchParams("searchOutlines=1"))).toBe("outlines");
    expect(readSearchKind(new URLSearchParams("searchRoundSpeeches=1"))).toBe("debates");
  });

  it("is null when no toggle is on", () => {
    expect(readSearchKind(new URLSearchParams("q=nuclear"))).toBeNull();
  });
});

describe("buildRecentCardOrderBy", () => {
  it("lists the newest cards first, by id", async () => {
    const db = await freshDb();
    await db.insert(debateCards).values([
      card({ id: 1, importedAt: 100 }),
      card({ id: 2, importedAt: 300 }),
      card({ id: 3, importedAt: 300 }),
      card({ id: 4, importedAt: 200 }),
    ]);

    const rows = await db.select().from(debateCards).orderBy(...buildRecentCardOrderBy());

    // The dump's ids grow with every import, so the rowid walk
    // backwards is the newest-imported-first order.
    expect(rows.map((row) => row.id)).toEqual([4, 3, 2, 1]);
  });
});

describe("recent upload mappers", () => {
  it("maps an outline document to a result titled by its file", () => {
    const result = mapCaselistDocumentToSearchResult({
      id: 7,
      pathHash: "h",
      caselistSlug: "hspolicy26",
      caselistLabel: "HS Policy 2025-26",
      school: "Glenbrook North",
      team: "Chen-Patel",
      side: "Aff",
      fileName: "1AC.docx",
      archivePath: "hspolicy26/Glenbrook North/Chen-Patel/1AC.docx",
      html: "<p>One two three</p>",
      cardCount: 12,
      ingestedAt: new Date(0),
      archiveDate: null,
    });

    expect(result).toMatchObject({ id: 7, tag: "1AC.docx", category: "Outline", school: "Glenbrook North", word_count: 3 });
    expect(result.summary).toContain("12 cards");
  });

  it("maps a round video to a result that links to the video and escapes its description", () => {
    const result = mapRoundVideoToSearchResult({
      id: "abc123",
      title: "NDT Finals",
      publishedAt: "2026-03-30",
      channel: "Debate Videos",
      views: 5,
      description: "a <b>bold</b> claim",
      style: 1,
      tournament: "NDT",
      roundLevel: "Finals",
      aff: "Harvard",
      neg: "Michigan",
      winner: null,
      judgeDecision: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    expect(result.tag).toBe("NDT Finals");
    expect(result.category).toBe("Debate");
    expect(result.html).toContain("https://www.youtube.com/watch?v=abc123");
    expect(result.html).toContain("a &lt;b&gt;bold&lt;/b&gt; claim");
    expect(result.summary).toBe("Harvard vs Michigan · NDT · Finals");
  });
});
