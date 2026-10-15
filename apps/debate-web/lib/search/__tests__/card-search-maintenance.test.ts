import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import { applySchema } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";
import { debateCards } from "@/lib/database/schema";
import { cardFtsStatus, createCardFts, resetCardFtsMemo, searchCardsRanked, buildFtsMatch } from "../card-fts";
import { ensureCardSortIndexes } from "../card-search-indexes";
import { maintainCardSearchIndexes } from "../card-search-maintenance";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

describe("card search index maintenance", () => {
  beforeEach(() => resetCardFtsMemo());

  it("creates the sort indexes the newest-first and Most read orders use", async () => {
    const db = await freshDb();
    await db.run(sql`DROP INDEX IF EXISTS idx_debate_cards_imported_at`);
    await db.run(sql`DROP INDEX IF EXISTS idx_debate_cards_duplicate_count`);
    await ensureCardSortIndexes(db);
    await ensureCardSortIndexes(db);
    const rows = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'debate_cards'`,
    );
    const names = rows.map((row) => row.name);
    expect(names).toContain("idx_debate_cards_imported_at");
    expect(names).toContain("idx_debate_cards_duplicate_count");
    const plan = await db.all<{ detail: string }>(
      sql`EXPLAIN QUERY PLAN SELECT id FROM debate_cards ORDER BY imported_at DESC, id DESC LIMIT 10`,
    );
    expect(plan.map((row) => row.detail).join(" ")).toContain("idx_debate_cards_imported_at");
  });

  it("backfills cards the FTS index is missing and marks it complete", async () => {
    const db = await freshDb();
    // Cards inserted before the index existed are invisible to it.
    await db.insert(debateCards).values([
      { id: 1, tag: "Nuclear deterrence" },
      { id: 2, tag: "Climate extinction" },
    ]);
    await createCardFts(db);
    expect((await cardFtsStatus(db)).indexed).toBe(0);

    const status = await maintainCardSearchIndexes(db);
    expect(status).toMatchObject({ cards: 2, indexed: 2, complete: true });
    expect((await searchCardsRanked(db, buildFtsMatch("nuclear"), undefined, 10)).map((row) => row.id)).toEqual([1]);
  });
});
