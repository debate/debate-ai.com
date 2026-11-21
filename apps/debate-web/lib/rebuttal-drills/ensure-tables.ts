/**
 * @fileoverview Creates the `rebuttal_drills` table on a live D1.
 *
 * The app ships no migrations folder (see lib/database/ensure-columns.ts), so
 * the drill routes run this once per isolate before their first query. Every
 * statement is idempotent. The DDL matches `rebuttalDrills` in
 * lib/database/schema.ts (a test holds them together).
 *
 * @module lib/rebuttal-drills/ensure-tables
 */
import { sql } from "drizzle-orm";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { rebuttalDrills } from "@/lib/database/schema";

export const REBUTTAL_DRILLS_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "rebuttal_drills" (
  "id" text PRIMARY KEY NOT NULL,
  "playlist_id" text NOT NULL,
  "video_id" text NOT NULL,
  "format" text NOT NULL,
  "topic" text NOT NULL,
  "creator_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "creator_side" text NOT NULL,
  "partner_id" text REFERENCES "user"("id") ON DELETE cascade,
  "partner_kind" text DEFAULT 'none' NOT NULL,
  "status" text DEFAULT 'waiting' NOT NULL,
  "creator_text" text DEFAULT '' NOT NULL,
  "partner_text" text DEFAULT '' NOT NULL,
  "creator_coach_uses" integer DEFAULT 0 NOT NULL,
  "partner_coach_uses" integer DEFAULT 0 NOT NULL,
  "winner_side" text,
  "decision" text DEFAULT '' NOT NULL,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "updated_at" integer DEFAULT (unixepoch()) NOT NULL,
  "completed_at" integer
)`,
  `CREATE INDEX IF NOT EXISTS "idx_rebuttal_drills_creator" ON "rebuttal_drills" ("creator_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "idx_rebuttal_drills_partner" ON "rebuttal_drills" ("partner_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "idx_rebuttal_drills_open" ON "rebuttal_drills" ("status", "video_id")`,
];

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

let ensured: Promise<void> | null = null;

/** Creates the table (and any column added since) once per isolate; a failure is forgotten and retried. */
export function ensureRebuttalDrillTables(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of REBUTTAL_DRILLS_DDL) await (db as RawDB).run(sql.raw(statement));
    await ensureTableColumns(db, rebuttalDrills);
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the table was already created. */
export function resetEnsuredRebuttalDrillTables(): void {
  ensured = null;
}
