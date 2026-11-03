/**
 * Saved copies of Extinction.GG files for finished seasons.
 *
 * A past season's ratings and bid list never change, so `/api/extinction`
 * fetches each one from Extinction.GG once, saves it here and serves every
 * later request from D1. Only the current season goes to Extinction.GG live.
 *
 * Bodies are split into ~900 KB parts so a large ratings file stays under
 * D1's per-row size limit. A 403/404 (a format or season with no bid list) is
 * saved too, as a status with an empty body, so it is not re-fetched.
 *
 * `extinction_season_files` is created here on first use: the app has no
 * tracked migrations (see `lib/database/ensure-columns.ts`).
 */

import { sql } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "extinction_season_files" (
  "kind" text NOT NULL,
  "file" text NOT NULL,
  "part" integer NOT NULL,
  "parts" integer NOT NULL,
  "status" integer NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "fetched_at" integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY ("kind", "file", "part")
)`;

/** Characters per stored part; JSON here is ASCII-heavy, so well under 2 MB. */
export const EXTINCTION_PART_SIZE = 900_000;

let tableReady: Promise<void> | null = null;

function ensureTable(db: Database): Promise<void> {
  tableReady ??= Promise.resolve(db.run(sql.raw(CREATE_TABLE_SQL))).then(
    () => undefined,
    (error) => {
      tableReady = null;
      throw error;
    },
  );
  return tableReady;
}

/** A saved file: the upstream status and, for a 200, its JSON text. */
export interface SavedExtinctionFile {
  status: number;
  body: string;
}

/** Splits `body` into parts of at most `size` characters (one empty part for ""). */
export function splitBody(body: string, size = EXTINCTION_PART_SIZE): string[] {
  if (body === "") return [""];
  const parts: string[] = [];
  for (let i = 0; i < body.length; i += size) parts.push(body.slice(i, i + size));
  return parts;
}

interface PartRow {
  part: number;
  parts: number;
  status: number;
  body: string;
}

/** The saved copy of `kind/file`, or null when none is saved (or it is incomplete). */
export async function readSavedExtinctionFile(
  db: Database,
  kind: string,
  file: string,
): Promise<SavedExtinctionFile | null> {
  await ensureTable(db);
  const rows = (await db.all(
    sql`SELECT part, parts, status, body FROM extinction_season_files WHERE kind = ${kind} AND file = ${file} ORDER BY part`,
  )) as PartRow[];
  if (rows.length === 0) return null;
  const expected = Number(rows[0]!.parts);
  if (rows.length !== expected || rows.some((row, i) => Number(row.part) !== i)) return null;
  return { status: Number(rows[0]!.status), body: rows.map((row) => row.body).join("") };
}

/** Saves `kind/file`, replacing any earlier copy. */
export async function saveExtinctionFile(
  db: Database,
  kind: string,
  file: string,
  saved: SavedExtinctionFile,
): Promise<void> {
  await ensureTable(db);
  const parts = splitBody(saved.body);
  await db.run(sql`DELETE FROM extinction_season_files WHERE kind = ${kind} AND file = ${file}`);
  for (let part = 0; part < parts.length; part++) {
    await db.run(
      sql`INSERT INTO extinction_season_files (kind, file, part, parts, status, body)
          VALUES (${kind}, ${file}, ${part}, ${parts.length}, ${saved.status}, ${parts[part]!})`,
    );
  }
}
