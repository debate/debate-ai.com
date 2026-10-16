import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/lib/database/schema";
import { debateCards } from "@/lib/database/schema";
import { applySchema } from "@/lib/database/__tests__/schema-sql";
import {
  autocompleteCardTerms,
  backfillCardFts,
  buildFtsMatch,
  cardFtsStatus,
  createCardFts,
  ensureCardFts,
  ftsColumnsForScope,
  INLINE_REBUILD_MAX_CARDS,
  readFtsOperator,
  rebuildCardFts,
  resetCardFtsMemo,
  searchCardsRanked,
} from "../card-fts";
import { buildCardSearchOrderBy, buildCardSearchWhere } from "../debate-card-search";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

type Db = Awaited<ReturnType<typeof freshDb>>;

function card(id: number, overrides: Partial<typeof debateCards.$inferInsert> = {}) {
  return { id, tag: "", cite: "", fullcite: "", summary: "", spoken: "", fulltext: "", ...overrides };
}

const CORPUS = [
  card(1, {
    tag: "Nuclear deterrence prevents great power war",
    fulltext: "Deterrence has kept the peace since 1945.",
    duplicateCount: 3,
    year: 2022,
  }),
  card(2, {
    tag: "Climate change causes extinction",
    fulltext: "Warming threatens ecosystems; nuclear power is no fix.",
    duplicateCount: 50,
    year: 2023,
  }),
  card(3, {
    tag: "Economic decline",
    fulltext: "Deterrence fails when nuclear arsenals erode. Nuclear modernization deters nuclear war.",
    spoken: "nuclear modernization deters",
    duplicateCount: 1,
    year: 2022,
  }),
  card(4, {
    tag: "Café résumé naïve",
    fulltext: "Diacritics are folded by the tokenizer.",
  }),
];

async function seeded(): Promise<Db> {
  const db = await freshDb();
  await createCardFts(db);
  await db.insert(debateCards).values(CORPUS);
  return db;
}

const ids = (rows: { id: number }[]) => rows.map((row) => row.id);

describe("buildFtsMatch", () => {
  it("quotes every word so user input is never FTS syntax", () => {
    expect(buildFtsMatch("nuclear AND NEAR(war)")).toBe('("nuclear" OR "AND" OR "NEAR" OR "war")');
    expect(buildFtsMatch('say "hi', { operator: "AND" })).toBe('("say" AND "hi")');
  });

  it("keeps quoted phrases as required phrases", () => {
    expect(buildFtsMatch('deterrence "great power war"')).toBe('"deterrence" AND "great power war"');
  });

  it("prefix-matches the word being typed but not a finished one", () => {
    expect(buildFtsMatch("nuclear det", { prefixLastWord: true })).toBe('("nuclear" OR "det"*)');
    expect(buildFtsMatch("nuclear det ", { prefixLastWord: true })).toBe('("nuclear" OR "det")');
  });

  it("restricts to columns with a column filter", () => {
    expect(buildFtsMatch("war", { columns: ["spoken", "summary"] })).toBe('{spoken summary} : ("war")');
  });

  it("returns nothing for a query with no words", () => {
    expect(buildFtsMatch(' "" ?! ')).toBe("");
  });
});

describe("ftsColumnsForScope / readFtsOperator", () => {
  it("maps scopes to index columns and refuses underlined text", () => {
    expect(ftsColumnsForScope({})).toBeUndefined();
    expect(ftsColumnsForScope({ searchHighlighted: true, searchAllText: true })).toBeUndefined();
    expect(ftsColumnsForScope({ searchHighlighted: true, searchBlockAndFileTitles: true })).toEqual([
      "spoken",
      "pocket",
      "hat",
      "block",
    ]);
    expect(ftsColumnsForScope({ searchUnderlined: true })).toBeNull();
  });

  it("defaults to OR", () => {
    expect(readFtsOperator(new URLSearchParams("operator=and"))).toBe("AND");
    expect(readFtsOperator(new URLSearchParams("operator=xor"))).toBe("OR");
  });
});

describe("searchCardsRanked", () => {
  let db: Db;
  beforeEach(async () => {
    db = await seeded();
  });

  it("ranks by BM25, weighting the tag above the body", async () => {
    const rows = await searchCardsRanked(db, buildFtsMatch("nuclear deterrence"), undefined, 10);
    // Card 1 has both words in its tag; card 3 has both only in the body.
    expect(ids(rows).slice(0, 2)).toEqual([1, 3]);
    expect(ids(rows)).toContain(2);
  });

  it("returns the same matches unranked, capped at the limit", async () => {
    const all = await searchCardsRanked(db, buildFtsMatch("nuclear"), undefined, 10, [], false);
    expect(ids(all).sort()).toEqual([1, 2, 3]);
    expect(await searchCardsRanked(db, buildFtsMatch("nuclear"), undefined, 2, [], false)).toHaveLength(2);
  });

  it("requires every word with AND", async () => {
    const rows = await searchCardsRanked(db, buildFtsMatch("nuclear deterrence", { operator: "AND" }), undefined, 10);
    expect(ids(rows).sort()).toEqual([1, 3]);
  });

  it("matches quoted phrases exactly", async () => {
    expect(ids(await searchCardsRanked(db, buildFtsMatch('"nuclear war"'), undefined, 10))).toEqual([3]);
    expect(ids(await searchCardsRanked(db, buildFtsMatch('"war nuclear"'), undefined, 10))).toEqual([]);
  });

  it("prefix-matches the last word and folds diacritics", async () => {
    expect(ids(await searchCardsRanked(db, buildFtsMatch("moderniz", { prefixLastWord: true }), undefined, 10))).toEqual([3]);
    expect(ids(await searchCardsRanked(db, buildFtsMatch("resume"), undefined, 10))).toEqual([4]);
  });

  it("honours column scopes and the non-text filters", async () => {
    const spoken = buildFtsMatch("nuclear", { columns: ["spoken"] });
    expect(ids(await searchCardsRanked(db, spoken, undefined, 10))).toEqual([3]);
    const where = buildCardSearchWhere({ year: "2023" });
    expect(ids(await searchCardsRanked(db, buildFtsMatch("nuclear"), where, 10))).toEqual([2]);
  });

  it("applies an explicit sort instead of relevance", async () => {
    const rows = await searchCardsRanked(db, buildFtsMatch("nuclear"), undefined, 10, buildCardSearchOrderBy("readCount:desc"));
    expect(ids(rows)).toEqual([2, 1, 3]);
  });

  it("follows updates and deletes through the triggers", async () => {
    await db.update(debateCards).set({ tag: "Hegemony solves" }).where(eq(debateCards.id, 1));
    await db.delete(debateCards).where(eq(debateCards.id, 3));
    expect(ids(await searchCardsRanked(db, buildFtsMatch("hegemony"), undefined, 10))).toEqual([1]);
    expect(ids(await searchCardsRanked(db, buildFtsMatch("deterrence"), undefined, 10))).toEqual([1]);
    expect(ids(await searchCardsRanked(db, buildFtsMatch("modernization"), undefined, 10))).toEqual([]);
    // The index must still be internally consistent.
    await db.run(sql`INSERT INTO debate_cards_fts(debate_cards_fts) VALUES ('integrity-check')`);
  });

  it("stays consistent through the importer's upsert", async () => {
    await db
      .insert(debateCards)
      .values(card(2, { tag: "Space colonization" }))
      .onConflictDoUpdate({ target: debateCards.id, set: { tag: sql`excluded.tag` } });
    expect(ids(await searchCardsRanked(db, buildFtsMatch("space"), undefined, 10))).toEqual([2]);
    expect(ids(await searchCardsRanked(db, buildFtsMatch("climate"), undefined, 10))).toEqual([]);
    await db.run(sql`INSERT INTO debate_cards_fts(debate_cards_fts) VALUES ('integrity-check')`);
  });
});

describe("autocompleteCardTerms", () => {
  it("completes the last word, most frequent first", async () => {
    const db = await seeded();
    const suggestions = await autocompleteCardTerms(db, "great power nu", 5);
    expect(suggestions[0]).toMatchObject({ word: "nuclear", completion: "great power nuclear", documentCount: 3 });
    expect(suggestions[0].occurrences).toBe(6);
  });

  it("skips stopwords, short prefixes and finished words", async () => {
    const db = await seeded();
    expect((await autocompleteCardTerms(db, "th", 5)).map((s) => s.word)).not.toContain("the");
    expect(await autocompleteCardTerms(db, "n", 5)).toEqual([]);
    expect(await autocompleteCardTerms(db, "nuclear ", 5)).toEqual([]);
  });
});

describe("index lifecycle", () => {
  beforeEach(() => resetCardFtsMemo());

  it("creates and fills the index on first use for a small corpus", async () => {
    const db = await freshDb();
    await db.insert(debateCards).values(CORPUS);
    expect(await ensureCardFts(db)).toBe(true);
    expect(await cardFtsStatus(db)).toEqual({ cards: 4, indexed: 4, complete: true });
    expect(ids(await searchCardsRanked(db, buildFtsMatch("climate"), undefined, 10))).toEqual([2]);
  });

  it("leaves a large corpus to the backfill, which is resumable and skips indexed cards", async () => {
    const db = await freshDb();
    const many = Array.from({ length: INLINE_REBUILD_MAX_CARDS + 1 }, (_, i) => card(i + 1, { tag: `card ${i}` }));
    for (let i = 0; i < many.length; i += 500) await db.insert(debateCards).values(many.slice(i, i + 500));

    expect(await ensureCardFts(db)).toBe(false);
    // A card written after the index exists is indexed by the trigger…
    await db.insert(debateCards).values(card(999_999, { tag: "fresh import" }));
    // …and the backfill fills in the rest without indexing it twice.
    let status = await backfillCardFts(db, 2);
    expect(status.complete).toBe(false);
    while (!status.complete) status = await backfillCardFts(db);
    expect(status).toEqual({ cards: many.length + 1, indexed: many.length + 1, complete: true });
    await db.run(sql`INSERT INTO debate_cards_fts(debate_cards_fts) VALUES ('integrity-check')`);

    resetCardFtsMemo();
    expect(await ensureCardFts(db)).toBe(true);
  }, 60_000);

  it("rebuild re-indexes after writes that bypassed the triggers", async () => {
    const db = await seeded();
    await db.run(sql`DROP TRIGGER debate_cards_fts_au`);
    await db.update(debateCards).set({ tag: "Hegemony solves" }).where(eq(debateCards.id, 1));
    await createCardFts(db);
    await rebuildCardFts(db);
    expect(ids(await searchCardsRanked(db, buildFtsMatch("hegemony"), undefined, 10))).toEqual([1]);
  });
});
