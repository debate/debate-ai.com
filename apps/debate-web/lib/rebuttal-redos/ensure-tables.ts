/**
 * @fileoverview Creates the `rebuttal_redos` table on a live D1.
 *
 * The app ships no migrations folder (see lib/database/ensure-columns.ts), so
 * the redo routes run this once per isolate before their first query. Every
 * statement is idempotent. The DDL matches `rebuttalRedos` in
 * lib/database/schema.ts (a test holds them together).
 *
 * @module lib/rebuttal-redos/ensure-tables
 */
import { sql } from "drizzle-orm";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { rebuttalRedos } from "@/lib/database/schema";

export const REBUTTAL_REDOS_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "rebuttal_redos" (
  "id" text PRIMARY KEY NOT NULL,
  "round_key" text NOT NULL,
  "round_title" text DEFAULT '' NOT NULL,
  "format" text NOT NULL,
  "judge_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "student_email" text NOT NULL,
  "student_id" text REFERENCES "user"("id") ON DELETE cascade,
  "side" text NOT NULL,
  "speech" text NOT NULL,
  "ai_instructions" text DEFAULT '' NOT NULL,
  "judge_instructions" text DEFAULT '' NOT NULL,
  "time_limit_seconds" integer DEFAULT 300 NOT NULL,
  "due_at" integer,
  "status" text DEFAULT 'draft' NOT NULL,
  "submission_text" text DEFAULT '' NOT NULL,
  "audio_key" text,
  "submitted_at" integer,
  "feedback" text DEFAULT '' NOT NULL,
  "rating" integer,
  "reviewed_at" integer,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "updated_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_rebuttal_redos_round" ON "rebuttal_redos" ("round_key")`,
  `CREATE INDEX IF NOT EXISTS "idx_rebuttal_redos_judge" ON "rebuttal_redos" ("judge_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "idx_rebuttal_redos_student" ON "rebuttal_redos" ("student_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "idx_rebuttal_redos_email" ON "rebuttal_redos" ("student_email")`,
];

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

let ensured: Promise<void> | null = null;

/** Creates the table (and any column added since) once per isolate; a failure is forgotten and retried. */
export function ensureRebuttalRedoTables(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of REBUTTAL_REDOS_DDL) await (db as RawDB).run(sql.raw(statement));
    await ensureTableColumns(db, rebuttalRedos);
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the table was already created. */
export function resetEnsuredRebuttalRedoTables(): void {
  ensured = null;
}
