/**
 * @fileoverview The body-text index for cards whose text lives in R2, and
 * `/api/search` finding a moved card by a word that is only in its body.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { debateCards } from "@/lib/database/schema";
import { applySchema } from "@/lib/database/__tests__/schema-sql";
import { createCardFts, rebuildCardFts, resetCardFtsMemo } from "../card-fts";
import {
  backfillCardBodyIndexPage,
  cardBodyText,
  indexCardBodies,
  resetCardBodyFtsMemo,
  searchCardBodies,
} from "../card-body-fts";
import { moveCardTextPage } from "@/lib/admin/card-text-migration";
import { runCardBodyIndexBackfill, BODY_INDEX_CURSOR_KEY } from "@/lib/admin/card-text-cron";

/** An in-memory stand-in for the CARD_TEXT bucket. */
function memoryBucket() {
  const objects = new Map<string, string>();
  return {
    objects,
    put: async (key: string, value: string) => void objects.set(key, value),
    get: async (key: string) => (objects.has(key) ? { text: async () => objects.get(key)! } : null),
  };
}

let db: any;
let bucket = memoryBucket();

vi.mock("@/lib/auth/session", () => ({ getUserId: async () => null }));
vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => db,
  getCloudflareContext: () => ({ env: { CARD_TEXT: bucket } }),
}));

function card(id: number, overrides: Partial<typeof debateCards.$inferInsert> = {}) {
  return {
    id,
    tag: `Deterrence card ${id}`,
    cite: "Smith 20",
    fullcite: "Smith, 2020, Journal",
    summary: "",
    spoken: "hegemony good",
    fulltext: `the body says proliferation cascades ${id}`,
    textLength: 100,
    markup: "<p><mark>hegemony good</mark> the body says proliferation cascades</p>",
    pocket: "DA",
    hat: "h",
    block: "b",
    bucketId: 1,
    duplicateCount: id,
    side: "n",
    caselistDisplayName: "NDT",
    year: 2024,
    event: "CX",
    level: "College",
    sourceFile: "shard.parquet",
    importedAt: 0,
    ...overrides,
  };
}

async function freshDb(count = 3) {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  db = drizzle(client, { schema });
  resetCardFtsMemo();
  resetCardBodyFtsMemo();
  await createCardFts(db);
  for (let id = 1; id <= count; id++) await db.insert(debateCards).values(card(id));
  await rebuildCardFts(db);
}

beforeEach(async () => {
  bucket = memoryBucket();
  await freshDb();
});

describe("indexCardBodies / searchCardBodies", () => {
  it("finds cards by body words, BM25 first, skipping excluded ids", async () => {
    await indexCardBodies(db, [
      { id: 1, fulltext: "nuclear winter" },
      { id: 2, fulltext: "nuclear nuclear winter" },
      { id: 3, fulltext: "economic decline" },
    ]);
    const found = await searchCardBodies(db, '"nuclear"', undefined, 10);
    expect(found.map((row) => row.id)).toEqual([2, 1]);
    expect((await searchCardBodies(db, '"nuc"*', undefined, 10, [2])).map((row) => row.id)).toEqual([1]);
    expect((await searchCardBodies(db, '"nuclear winter"', undefined, 10)).map((row) => row.id).sort()).toEqual([1, 2]);
  });

  it("replaces a card's earlier body instead of adding to it", async () => {
    await indexCardBodies(db, [{ id: 1, fulltext: "old words" }]);
    await indexCardBodies(db, [{ id: 1, fulltext: "new words" }]);
    expect(await searchCardBodies(db, '"old"', undefined, 10)).toEqual([]);
    expect((await searchCardBodies(db, '"new"', undefined, 10)).map((row) => row.id)).toEqual([1]);
  });

  it("drops a deleted card from the index", async () => {
    await indexCardBodies(db, [{ id: 1, fulltext: "nuclear winter" }]);
    await db.delete(debateCards).where((await import("drizzle-orm")).eq(debateCards.id, 1));
    expect(await searchCardBodies(db, '"nuclear"', undefined, 10)).toEqual([]);
  });

  it("indexes markup-only cards by their stripped text", () => {
    expect(cardBodyText({ fulltext: "", markup: "<p><mark>a</mark> b</p>" })).toBe("a b");
    expect(cardBodyText({ fulltext: "plain", markup: "<p>x</p>" })).toBe("plain");
  });
});

describe("moving text to R2 keeps the body searchable", () => {
  it("indexes the body as it moves it", async () => {
    await moveCardTextPage(db, bucket, 0, 100);
    expect((await searchCardBodies(db, '"proliferation"', undefined, 10)).map((row) => row.id).sort()).toEqual([1, 2, 3]);
  });

  it("backfills cards moved before the index existed from R2", async () => {
    await moveCardTextPage(db, bucket, 0, 100);
    // Simulate a corpus moved before the body index: wipe it.
    await db.run((await import("drizzle-orm")).sql.raw("DELETE FROM debate_cards_body_fts"));
    expect(await searchCardBodies(db, '"proliferation"', undefined, 10)).toEqual([]);

    const page = await backfillCardBodyIndexPage(db, bucket, 0, 2);
    expect(page).toMatchObject({ indexed: 2, scanned: 2, nextAfterId: 2, done: false });
    const run = await runCardBodyIndexBackfill(db, bucket, { pageRows: 2 });
    expect(run.cursor.done).toBe(true);
    expect(JSON.parse(bucket.objects.get(BODY_INDEX_CURSOR_KEY)!)).toMatchObject({ done: true });
    expect((await searchCardBodies(db, '"proliferation"', undefined, 10)).map((row) => row.id).sort()).toEqual([1, 2, 3]);

    // Done stays done: no rescan of every card from R2.
    const again = await runCardBodyIndexBackfill(db, bucket, { pageRows: 2 });
    expect(again.pages).toBe(0);
  });
});

describe("/api/search after the move", () => {
  async function search(query: string) {
    const { GET } = await import("@/app/api/search/route");
    const response = await GET({ nextUrl: new URL(`https://d.ebate.app/api/search?${query}`), headers: new Headers() } as never);
    return (await response.json()) as { results: { id: number; html: string }[]; total: number };
  }

  it("finds a moved card by a word only in its body, with its text back from R2", async () => {
    await moveCardTextPage(db, bucket, 0, 100);
    const body = await search("sort=recentPopular%3Adesc&searchQuotes=1&q=cascades");
    expect(body.results.map((result) => result.id).sort()).toEqual([1, 2, 3]);
    expect(body.results[0].html).toContain("proliferation cascades");

    // Tag matches still come from the main index, without duplicates.
    const tag = await search("sort=_text_match%3Adesc&searchQuotes=1&q=deterrence%20cascades");
    expect(tag.results.map((result) => result.id).sort()).toEqual([1, 2, 3]);

    // A highlight-only search does not look at bodies.
    const highlighted = await search("searchQuotes=1&searchHighlighted=1&q=cascades");
    expect(highlighted.total).toBe(0);
  });
});
