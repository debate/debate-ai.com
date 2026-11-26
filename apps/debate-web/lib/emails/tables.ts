/**
 * @fileoverview The D1 tables behind the admin Emails section (saved lists,
 * saved templates and settings). The app ships no migrations folder, so they
 * are created here, once per isolate.
 */

import { sql } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";

export type Database = Awaited<ReturnType<typeof getDBFromContext>>;

const DDL = [
  `CREATE TABLE IF NOT EXISTS "email_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value_enc" text NOT NULL,
  "hint" text,
  "updated_at" integer NOT NULL,
  "updated_by" text
)`,
  `CREATE TABLE IF NOT EXISTS "email_lists" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "emails" text NOT NULL,
  "count" integer NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "updated_by" text
)`,
  `CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "updated_by" text
)`,
];

let ensured: Promise<void> | null = null;

/** Creates the tables once per isolate; a failure is forgotten and retried. */
export function ensureEmailTables(db: Database): Promise<void> {
  const pending = (ensured ??= (async () => {
    for (const statement of DDL) await db.run(sql.raw(statement));
  })());
  pending.catch(() => {
    if (ensured === pending) ensured = null;
  });
  return pending;
}

/** Forgets that the tables were created (tests, which swap databases). */
export function resetEmailTables(): void {
  ensured = null;
}
