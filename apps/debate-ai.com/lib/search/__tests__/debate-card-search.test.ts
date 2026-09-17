import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/lib/database/schema";
import { debateCards } from "@/lib/database/schema";
import {
  buildCardSearchWhere,
  escapeLikePattern,
  mapDebateCardToSearchResult,
  readSearchScope,
  sortSearchResults,
} from "../debate-card-search";

const migrationPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle/0035_debate_cards.sql",
);

/** A fresh in-memory database with the card table migrated in. */
async function freshDb() {
  const client = createClient({ url: ":memory:" });
  for (const statement of readFileSync(migrationPath, "utf8").split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await client.execute(sql);
  }
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

  it("falls back to the tag when a card has no outline path", () => {
    const result = mapDebateCardToSearchResult(card({ pocket: "", hat: "", block: "" }));
    expect(result.argBlock).toBe("Nuclear deterrence solves existential threats");
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

  it("leaves relevance order to the database", () => {
    expect(sortSearchResults(results(), "_text_match:desc").map((r) => r.year)).toEqual(["2014", "2018"]);
  });
});
