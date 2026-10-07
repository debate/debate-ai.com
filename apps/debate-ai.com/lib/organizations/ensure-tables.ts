/**
 * @fileoverview Creates the better-auth `organization` plugin's tables on a
 * live D1 and adds `session.active_organization_id`.
 *
 * The app ships no migrations folder (`drizzle/` is untracked, so a deploy
 * applies none — see lib/database/ensure-columns.ts), and Drizzle names every
 * column in an insert: with the plugin registered, better-auth writes
 * `active_organization_id` on every new session, so a D1 without that column
 * would fail every sign-in. `getAuth()` therefore runs this once per isolate
 * before it builds the auth instance. Every statement is idempotent
 * (`IF NOT EXISTS`, and the column add goes through `ensureTableColumns`), so
 * running it against a database that already has them is a no-op.
 *
 * The DDL matches the `organization`, `member` and `invitation` definitions in
 * lib/database/schema.ts; an operator can also run {@link ORGANIZATION_DDL}
 * by hand with `wrangler d1 execute`.
 */
import { sql } from "drizzle-orm"
import { ensureTableColumns } from "@/lib/database/ensure-columns"
import { session } from "@/lib/database/schema"

export const ORGANIZATION_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "organization" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo" text,
  "created_at" integer NOT NULL,
  "metadata" text
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "organization_slug_unique" ON "organization" ("slug")`,
  `CREATE TABLE IF NOT EXISTS "member" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "role" text DEFAULT 'member' NOT NULL,
  "created_at" integer NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_member_organization" ON "member" ("organization_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_member_user" ON "member" ("user_id")`,
  `CREATE TABLE IF NOT EXISTS "invitation" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "role" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" integer NOT NULL,
  "created_at" integer NOT NULL,
  "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
)`,
  `CREATE INDEX IF NOT EXISTS "idx_invitation_organization" ON "invitation" ("organization_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_invitation_email" ON "invitation" ("email")`,
]

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> }

let ensured: Promise<void> | null = null

/** Creates the organization tables and session column once per isolate; a failure is forgotten and retried. */
export function ensureOrganizationTables(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of ORGANIZATION_DDL) await (db as RawDB).run(sql.raw(statement))
    await ensureTableColumns(db, session)
  })()
  ensured.catch(() => {
    ensured = null
  })
  return ensured
}

/** Test-only: forget that the tables were already created. */
export function resetEnsuredOrganizationTables(): void {
  ensured = null
}
