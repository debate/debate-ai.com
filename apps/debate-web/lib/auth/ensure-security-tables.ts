/**
 * @fileoverview Creates the `passkey` and `two_factor` tables that the
 * better-auth passkey and two-factor plugins (./security-plugins) read and
 * write, on a live D1.
 *
 * Same approach as lib/organizations/ensure-tables.ts: the app ships no
 * migrations folder (`drizzle/` and `packages/*\/migrations` are gitignored,
 * so a deploy applies none), so `getAuth()` runs this once per isolate before
 * auth handles anything. Every statement is idempotent (`IF NOT EXISTS`), so
 * running it against a database that already has the tables is a no-op. The
 * `user.two_factor_enabled` column is added by `ensureTableColumns(db, user)`,
 * which ./index already runs.
 *
 * The DDL matches the `passkey` and `twoFactor` definitions in
 * lib/database/schema.ts; an operator can also run {@link SECURITY_DDL} by hand
 * with `wrangler d1 execute`.
 */
import { sql } from "drizzle-orm"

export const SECURITY_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "passkey" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "public_key" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "credential_id" text NOT NULL,
  "counter" integer NOT NULL,
  "device_type" text NOT NULL,
  "backed_up" integer NOT NULL,
  "transports" text,
  "created_at" integer,
  "aaguid" text
)`,
  `CREATE INDEX IF NOT EXISTS "idx_passkey_user" ON "passkey" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_passkey_credential" ON "passkey" ("credential_id")`,
  `CREATE TABLE IF NOT EXISTS "two_factor" (
  "id" text PRIMARY KEY NOT NULL,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "verified" integer DEFAULT 1,
  "failed_verification_count" integer DEFAULT 0,
  "locked_until" integer
)`,
  `CREATE INDEX IF NOT EXISTS "idx_two_factor_user" ON "two_factor" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_two_factor_secret" ON "two_factor" ("secret")`,
]

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> }

let ensured: Promise<void> | null = null

/** Creates the passkey and two-factor tables once per isolate; a failure is forgotten and retried. */
export function ensureSecurityTables(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of SECURITY_DDL) await (db as RawDB).run(sql.raw(statement))
  })()
  ensured.catch(() => {
    ensured = null
  })
  return ensured
}

/** Test-only: forget that the tables were already created. */
export function resetEnsuredSecurityTables(): void {
  ensured = null
}
