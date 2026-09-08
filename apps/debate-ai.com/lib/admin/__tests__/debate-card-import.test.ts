/**
 * @fileoverview Exercises the card-import write path against a real SQLite
 * database, using the same migration production runs.
 *
 * The interesting parts of this module are the two upserts — a card that
 * re-imports over itself, and a per-file tally that accumulates within a run
 * but resets across runs — and neither is provable with a mock. So this suite
 * runs `drizzle/0035_debate_cards.sql` into an in-memory libSQL database and
 * asserts on the rows that come back.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { debateCardImports, debateCards } from "../../database/schema";
import {
  CARD_ROWS_PER_STATEMENT,
  recordCardImportBatch,
  writeDebateCardBatch,
} from "../debate-card-import";

const migrationPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle/0035_debate_cards.sql",
);

/** A row shaped like the published dump, with int64 columns as BigInt. */
function dumpRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 4_379_114n,
    tag: "Pleasure and pain are intrinsic value and disvalue.",
    cite: "Blum et al. 18",
    fullcite: "Kenneth Blum, Department of Psychiatry…",
    summary: "Pleasure defines reward.",
    spoken: "Pleasure is not only one of the three primary reward functions…",
    fulltext: "Pleasure is not only one of the three primary reward functions…",
    textLength: 18_378n,
    markup: "<h4>Pleasure and pain are intrinsic value</h4>",
    pocket: "CPS R1 v Harker MK",
    hat: "1AC—Schengenlargement",
    block: "1AC—Framing—Util",
    bucketId: 41_540n,
    duplicateCount: 3_168n,
    side: "a",
    caselistDisplayName: "HS LD 2022-23",
    year: 2_022n,
    event: "LD",
    level: "HS",
    ...overrides,
  };
}

/** A fresh in-memory database with the card tables migrated in. */
async function freshDb() {
  const client = createClient({ url: ":memory:" });
  for (const statement of readFileSync(migrationPath, "utf8").split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await client.execute(sql);
  }
  return drizzle(client, { schema });
}

describe("writeDebateCardBatch", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
  });

  it("stays inside D1's 100-parameter statement limit", () => {
    expect(CARD_ROWS_PER_STATEMENT).toBeGreaterThan(0);
    expect(CARD_ROWS_PER_STATEMENT * 20).toBeLessThanOrEqual(100);
  });

  it("writes a normalized dump row, converting int64 columns", async () => {
    const result = await writeDebateCardBatch(db, [dumpRow()], "cards-0000.parquet");
    expect(result).toMatchObject({ imported: 1, skipped: 0 });

    const [row] = await db.select().from(debateCards);
    expect(row.id).toBe(4_379_114);
    expect(row.textLength).toBe(18_378);
    expect(row.side).toBe("A");
    expect(row.event).toBe("ld");
    expect(row.sourceFile).toBe("cards-0000.parquet");
  });

  it("writes more rows than fit in one statement", async () => {
    const rows = Array.from({ length: CARD_ROWS_PER_STATEMENT * 3 + 1 }, (_, index) =>
      dumpRow({ id: BigInt(index + 1) }),
    );
    const result = await writeDebateCardBatch(db, rows, "cards-0000.parquet");
    expect(result.imported).toBe(rows.length);
    expect(await db.$count(debateCards)).toBe(rows.length);
  });

  it("upserts on re-import instead of duplicating the corpus", async () => {
    await writeDebateCardBatch(db, [dumpRow()], "cards-0000.parquet");
    await writeDebateCardBatch(
      db,
      [dumpRow({ tag: "Corrected tagline" })],
      "cards-0000-fixed.parquet",
    );

    const rows = await db.select().from(debateCards);
    expect(rows).toHaveLength(1);
    expect(rows[0].tag).toBe("Corrected tagline");
    expect(rows[0].sourceFile).toBe("cards-0000-fixed.parquet");
  });

  it("collapses an id repeated inside one batch rather than failing the batch", async () => {
    const result = await writeDebateCardBatch(
      db,
      [dumpRow(), dumpRow({ tag: "Second copy" })],
      "cards-0000.parquet",
    );
    expect(result.imported).toBe(1);
    const [row] = await db.select().from(debateCards);
    expect(row.tag).toBe("Second copy");
  });

  it("re-validates the payload rather than trusting the client", async () => {
    const result = await writeDebateCardBatch(
      db,
      [{ id: 0, tag: "no id" }, { id: 12 }, dumpRow()],
      "cards-0000.parquet",
    );
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.failures.map((failure) => failure.code)).toEqual([
      "missing-id",
      "empty-card",
    ]);
  });

  it("reports a batch with nothing usable without touching the table", async () => {
    const result = await writeDebateCardBatch(db, [{ id: 0 }], "cards-0000.parquet");
    expect(result).toMatchObject({ imported: 0, skipped: 1 });
    expect(await db.$count(debateCards)).toBe(0);
  });
});

describe("recordCardImportBatch", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
  });

  it("accumulates the batches of one run", async () => {
    for (const imported of [250, 250, 199]) {
      await recordCardImportBatch(db, {
        fileName: "cards-0000.parquet",
        imported,
        skipped: 1,
        importId: "run-1",
        actor: "admin@example.test",
      });
    }

    const [row] = await db.select().from(debateCardImports);
    expect(row.rowsImported).toBe(699);
    expect(row.rowsSkipped).toBe(3);
    expect(row.lastImportedBy).toBe("admin@example.test");
  });

  it("starts the counters over when the same file is imported again", async () => {
    await recordCardImportBatch(db, {
      fileName: "cards-0000.parquet",
      imported: 500,
      skipped: 2,
      importId: "run-1",
      actor: "admin@example.test",
    });
    await recordCardImportBatch(db, {
      fileName: "cards-0000.parquet",
      imported: 300,
      skipped: 0,
      importId: "run-2",
      actor: "other@example.test",
    });

    const [row] = await db.select().from(debateCardImports);
    expect(row.rowsImported).toBe(300);
    expect(row.rowsSkipped).toBe(0);
    expect(row.lastImportId).toBe("run-2");
  });
});
