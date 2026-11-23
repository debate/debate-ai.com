/**
 * @fileoverview Creates the Topic Sign-ups tables on a live D1.
 *
 * The app ships no migrations folder (see lib/database/ensure-columns.ts), so
 * `/api/topic-signups` runs this once per isolate before its first query.
 * Every statement is idempotent. The DDL matches `topicSignups`,
 * `topicSquads`, `topicSquadMembers` and `topicNotes` in
 * lib/database/schema.ts (a test holds them together).
 *
 * @module lib/topic-signups/ensure-tables
 */
import { sql } from "drizzle-orm";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { topicNotes, topicSignups, topicSquadMembers, topicSquads } from "@/lib/database/schema";

export const TOPIC_SIGNUPS_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "topic_signups" (
  "id" text PRIMARY KEY NOT NULL,
  "topic_key" text NOT NULL,
  "topic_text" text NOT NULL,
  "format" text,
  "source" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "role" text DEFAULT 'debate' NOT NULL,
  "side" text DEFAULT 'either' NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "updated_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_topic_signups_topic_user" ON "topic_signups" ("topic_key", "user_id")`,
  `CREATE TABLE IF NOT EXISTS "topic_squads" (
  "id" text PRIMARY KEY NOT NULL,
  "topic_key" text NOT NULL,
  "topic_text" text NOT NULL,
  "format" text,
  "source" text,
  "name" text NOT NULL,
  "about" text DEFAULT '' NOT NULL,
  "creator_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_topic_squads_topic" ON "topic_squads" ("topic_key")`,
  `CREATE TABLE IF NOT EXISTS "topic_squad_members" (
  "id" text PRIMARY KEY NOT NULL,
  "squad_id" text NOT NULL REFERENCES "topic_squads"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "joined_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_topic_squad_members_squad_user" ON "topic_squad_members" ("squad_id", "user_id")`,
  `CREATE TABLE IF NOT EXISTS "topic_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "topic_key" text NOT NULL,
  "topic_text" text NOT NULL,
  "format" text,
  "source" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "kind" text DEFAULT 'argument' NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "url" text,
  "body" text DEFAULT '' NOT NULL,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_topic_notes_topic" ON "topic_notes" ("topic_key", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_topic_notes_user" ON "topic_notes" ("user_id", "created_at")`,
];

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

let ensured: Promise<void> | null = null;

/** Creates the tables (and any column added since) once per isolate; a failure is forgotten and retried. */
export function ensureTopicSignupTables(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of TOPIC_SIGNUPS_DDL) await (db as RawDB).run(sql.raw(statement));
    for (const table of [topicSignups, topicSquads, topicSquadMembers, topicNotes]) await ensureTableColumns(db, table);
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the tables were already created. */
export function resetEnsuredTopicSignupTables(): void {
  ensured = null;
}
