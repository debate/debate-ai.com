/**
 * @fileoverview The admin panel's import, end to end: a real Parquet shard,
 * read the way the browser reads it, through the real server write path.
 *
 * The unit suites either side of this one prove their own half — the reader
 * decodes Parquet, the writer upserts rows — but the panel's failures live in
 * the seam: a `File` handed to the decoder as a byte source, `BigInt` columns
 * surviving `JSON.stringify`, batches sized so the endpoint's own limits hold,
 * and the ingest endpoint re-normalizing what the browser already normalized.
 * So this drives `uploadDebateCardShard` over a `File`, with a `fetch` that
 * runs what `POST /api/admin/debate-cards` runs, against a migrated database.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCardBatchSender,
  uploadDebateCardShard,
  type ParquetSource,
} from "debate-research-evidence";
import { buildCardShard } from "../../../../../packages/debate-search-evidence/test/parquet-card-fixture";
import { debateCardImports, debateCards } from "../../database/schema";
import {
  MAX_CARDS_PER_REQUEST,
  recordCardImportBatch,
  writeDebateCardBatch,
} from "../debate-card-import";

const drizzleDir = path.join(import.meta.dirname, "../../../drizzle");

/** The card tables, plus the reuse index every card batch also writes to. */
const migrationPaths = [
  path.join(drizzleDir, "0004_certain_microchip.sql"),
  path.join(drizzleDir, "0035_debate_cards.sql"),
  path.join(drizzleDir, "0054_debate_card_source_url.sql"),
];

/** A fresh in-memory database with the card tables migrated in. */
async function freshDb() {
  const client = createClient({ url: ":memory:" });
  for (const migrationPath of migrationPaths) {
    for (const statement of readFileSync(migrationPath, "utf8").split("--> statement-breakpoint")) {
      const sql = statement.trim();
      if (sql) await client.execute(sql);
    }
  }
  return drizzle(client);
}

/** The byte source the panel builds from a picked `File`. */
function fileAsParquetSource(file: File): ParquetSource {
  return {
    byteLength: file.size,
    slice: (start: number, end?: number) => file.slice(start, end).arrayBuffer(),
  };
}

/** What the endpoint is asked to do, and what it answers. */
interface RecordedRequest {
  cards: number;
  bodyBytes: number;
}

/**
 * A `fetch` that runs the ingest endpoint's body against a real database.
 *
 * Deliberately not the route module — that needs a Worker request context —
 * but every check the route makes before writing, in the order it makes them.
 */
function ingestFetch(db: Awaited<ReturnType<typeof freshDb>>, requests: RecordedRequest[]) {
  return (async (_url: string, init: RequestInit) => {
    const raw = String(init.body);
    const body = JSON.parse(raw) as { cards: unknown[]; fileName: string; importId: string };
    requests.push({ cards: body.cards.length, bodyBytes: raw.length });

    if (body.cards.length > MAX_CARDS_PER_REQUEST) {
      return new Response(JSON.stringify({ error: "batch too large" }), { status: 413 });
    }

    const result = await writeDebateCardBatch(db, body.cards, body.fileName);
    await recordCardImportBatch(db, {
      fileName: body.fileName,
      imported: result.imported,
      skipped: result.skipped,
      importId: body.importId,
      actor: "admin@example.test",
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("the admin panel's card import, end to end", () => {
  it("carries a picked file's rows into the library", async () => {
    const db = await freshDb();
    const requests: RecordedRequest[] = [];
    const file = new File(
      [buildCardShard({ rowCount: 1_200, rowGroupSize: 500 })],
      "cards-0000.parquet",
    );

    const outcome = await uploadDebateCardShard({
      source: fileAsParquetSource(file),
      fileName: file.name,
      send: createCardBatchSender({
        endpoint: "/api/admin/debate-cards",
        importId: "web_test",
        fetchImpl: ingestFetch(db, requests),
      }),
    });

    expect(outcome.progress).toMatchObject({ read: 1_200, imported: 1_200, skipped: 0 });

    // Every request stays inside the limit the endpoint enforces, so a shard
    // never fails partway through on a batch the server refuses.
    expect(requests.every((request) => request.cards <= MAX_CARDS_PER_REQUEST)).toBe(true);
    // Row groups smaller than one batch must not each become their own short
    // request — leftovers ride along into the next batch instead.
    expect(requests.slice(0, -1).every((request) => request.cards === 250)).toBe(true);

    const stored = await db.select().from(debateCards);
    expect(stored).toHaveLength(1_200);
    expect(stored[0].sourceFile).toBe("cards-0000.parquet");
    // int64 columns decode as BigInt; they have to reach SQLite as numbers.
    expect(typeof stored[0].id).toBe("number");
    expect(stored[0].year).toBeGreaterThan(2_000);

    const [imported] = await db.select().from(debateCardImports);
    expect(imported).toMatchObject({
      fileName: "cards-0000.parquet",
      rowsImported: 1_200,
      rowsSkipped: 0,
      lastImportedBy: "admin@example.test",
    });
  }, 120_000);

  it("re-importing the same shard corrects it rather than duplicating it", async () => {
    const db = await freshDb();
    const requests: RecordedRequest[] = [];
    const file = new File([buildCardShard({ rowCount: 300 })], "cards-0000.parquet");

    for (const importId of ["web_first", "web_second"]) {
      await uploadDebateCardShard({
        source: fileAsParquetSource(file),
        fileName: file.name,
        send: createCardBatchSender({
          endpoint: "/api/admin/debate-cards",
          importId,
          fetchImpl: ingestFetch(db, requests),
        }),
      });
    }

    expect(await db.select().from(debateCards)).toHaveLength(300);
    const [imported] = await db.select().from(debateCardImports);
    // The second run's tally replaces the first's rather than summing to 600.
    expect(imported.rowsImported).toBe(300);
    expect(imported.lastImportId).toBe("web_second");
  }, 120_000);
});
