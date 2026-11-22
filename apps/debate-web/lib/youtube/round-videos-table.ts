/**
 * @fileoverview Brings the live `youtube_round_videos` table up to the schema.
 *
 * The queue started out holding only rounds, with `style integer NOT NULL`.
 * It now holds lectures too: a lecture keeps `style` null and carries a
 * `category` label (see `youtubeRoundVideos` in lib/database/schema.ts). The
 * app ships no migrations folder (see lib/database/ensure-columns.ts), so a
 * database created before that change still has neither — and every scan
 * failed with `table youtube_round_videos has no column named category`,
 * because Drizzle names every column in an insert.
 *
 * {@link ensureRoundVideosTable} fixes both, once per isolate:
 *
 *  1. adds `category` (and any other missing nullable column) with
 *     {@link ensureTableColumns};
 *  2. if `style` is still `NOT NULL`, rebuilds the table without that
 *     constraint — SQLite cannot drop a constraint in place — inside one
 *     `db.batch()`, which D1 runs as a single transaction, so a failure leaves
 *     the old table untouched.
 * @module lib/youtube/round-videos-table
 */

import { sql } from "drizzle-orm";
import { ensureTableColumns, forgetEnsuredColumns } from "@/lib/database/ensure-columns";
import { describeError } from "@/lib/database/errors";
import { BENIGN_ALTER_ERROR } from "@/lib/database/migration-sql";
import { youtubeRoundVideos } from "@/lib/database/schema";

const TABLE = "youtube_round_videos";
const REBUILT = "__youtube_round_videos_rebuild";

type RawDB = {
  all(query: ReturnType<typeof sql.raw>): Promise<unknown>;
  run(query: ReturnType<typeof sql.raw>): Promise<unknown>;
  batch?(statements: unknown[]): Promise<unknown>;
};

type PragmaColumn = { name?: unknown; notnull?: unknown };

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : ((result as { results?: unknown[] })?.results ?? [])) as T[];
}

/**
 * The statements that rebuild `youtube_round_videos` with a nullable `style`,
 * given the table's current `CREATE TABLE` and index SQL from `sqlite_master`.
 * Returns null when the stored DDL has no `style … NOT NULL` to drop.
 */
export function planStyleNullableRebuild(
  createSql: string,
  indexSqls: readonly string[],
  columns: readonly string[],
): string[] | null {
  const styleNotNull = /(["`]?style["`]?\s+integer)\s+NOT\s+NULL/i;
  if (!styleNotNull.test(createSql)) return null;
  const createRebuilt = createSql
    .replace(styleNotNull, "$1")
    .replace(/^\s*CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["`]?youtube_round_videos["`]?/i, `CREATE TABLE "${REBUILT}"`);
  const columnList = columns.map((name) => `"${name}"`).join(", ");
  return [
    `DROP TABLE IF EXISTS "${REBUILT}"`,
    createRebuilt,
    `INSERT INTO "${REBUILT}" (${columnList}) SELECT ${columnList} FROM "${TABLE}"`,
    `DROP TABLE "${TABLE}"`,
    `ALTER TABLE "${REBUILT}" RENAME TO "${TABLE}"`,
    ...indexSqls,
  ];
}

let ensured: Promise<void> | null = null;

/** Ensures `youtube_round_videos` has `category` and a nullable `style`. Memoized per isolate; a failure is retried. */
export function ensureRoundVideosTable(db: unknown): Promise<void> {
  ensured ??= (async () => {
    const raw = db as RawDB;
    // Add `category` outright instead of trusting a PRAGMA read first: on a
    // read-replicated D1 the PRAGMA can be answered by a lagging replica, and
    // "duplicate column name" is the cheap, certain answer that it is there.
    try {
      await raw.run(sql.raw(`ALTER TABLE "${TABLE}" ADD COLUMN "category" text`));
    } catch (error) {
      const message = describeError(error);
      // Already there, or no table yet (a fresh database creates it from the schema).
      if (!BENIGN_ALTER_ERROR.test(message) && !/no such table/i.test(message)) throw error;
    }
    forgetEnsuredColumns(TABLE);
    await ensureTableColumns(db, youtubeRoundVideos);
    const info = rowsOf<PragmaColumn>(await raw.all(sql.raw(`PRAGMA table_info("${TABLE}")`)));
    const style = info.find((column) => column.name === "style");
    if (!style || Number(style.notnull) !== 1) return;

    const master = rowsOf<{ type?: unknown; sql?: unknown }>(
      await raw.all(sql.raw(`SELECT type, sql FROM sqlite_master WHERE tbl_name = '${TABLE}' AND sql IS NOT NULL`)),
    );
    const createSql = master.find((row) => row.type === "table")?.sql;
    if (typeof createSql !== "string") return;
    const indexSqls = master.filter((row) => row.type === "index").map((row) => String(row.sql));
    const statements = planStyleNullableRebuild(
      createSql,
      indexSqls,
      info.map((column) => String(column.name)),
    );
    if (!statements) return;

    const queries = statements.map((statement) => sql.raw(statement));
    if (typeof raw.batch === "function") {
      // One transaction on D1: either the whole rebuild lands or none of it.
      await raw.batch(queries.map((query) => (raw as { run(q: unknown): unknown }).run(query)));
    } else {
      for (const query of queries) await raw.run(query);
    }
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/**
 * True for the errors an out-of-date queue table produces: the missing
 * `category` column, or a lecture's null `style` hitting the old NOT NULL.
 */
export function isStaleRoundVideosTableError(error: unknown): boolean {
  const message = describeError(error);
  return (
    /no (such )?column (named )?:? ?category/i.test(message) ||
    /NOT NULL constraint failed: youtube_round_videos\.style/i.test(message)
  );
}

/** Test-only: forget that the table was already checked. */
export function resetEnsuredRoundVideosTable(): void {
  ensured = null;
}
