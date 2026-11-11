/**
 * @fileoverview Creates the `debate_challenges` table on a live D1.
 *
 * The app ships no migrations folder (see lib/database/ensure-columns.ts), so
 * the challenge routes run this once per isolate before their first query.
 * Every statement is idempotent; a database that already has the table pays
 * one `PRAGMA` per isolate (the column check) and nothing else.
 *
 * The DDL matches `debateChallenges` in lib/database/schema.ts (a test holds
 * them together); an operator can also run {@link DEBATE_CHALLENGES_DDL} by
 * hand with `wrangler d1 execute`.
 *
 * @module lib/debate-challenges/ensure-tables
 */
import { sql } from "drizzle-orm";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { debateChallenges } from "@/lib/database/schema";

export const DEBATE_CHALLENGES_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "debate_challenges" (
  "id" text PRIMARY KEY NOT NULL,
  "challenger_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "opponent_id" text REFERENCES "user"("id") ON DELETE cascade,
  "opponent_kind" text DEFAULT 'user' NOT NULL,
  "ai_level" text,
  "format" text NOT NULL,
  "topic" text NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "challenger_side" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "speeches" text DEFAULT '[]' NOT NULL,
  "deadline_at" integer,
  "winner_side" text,
  "decision_method" text,
  "decision" text DEFAULT '' NOT NULL,
  "challenger_claimed" integer DEFAULT false NOT NULL,
  "opponent_claimed" integer DEFAULT false NOT NULL,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "updated_at" integer DEFAULT (unixepoch()) NOT NULL,
  "completed_at" integer
)`,
  `CREATE INDEX IF NOT EXISTS "idx_debate_challenges_challenger" ON "debate_challenges" ("challenger_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "idx_debate_challenges_opponent" ON "debate_challenges" ("opponent_id", "status")`,
];

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

let ensured: Promise<void> | null = null;

/** Creates the table (and any column added since) once per isolate; a failure is forgotten and retried. */
export function ensureDebateChallengeTables(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of DEBATE_CHALLENGES_DDL) await (db as RawDB).run(sql.raw(statement));
    await ensureTableColumns(db, debateChallenges);
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the table was already created. */
export function resetEnsuredDebateChallengeTables(): void {
  ensured = null;
}
