/**
 * @fileoverview Reads and writes a user's linked QwkSearch account in the
 * `qwksearch_connection` table (see ./connect.ts and the table's note in
 * lib/database/schema.ts).
 */
import { eq, sql } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { qwksearchConnection } from "@/lib/database/schema"
import { parseConnection, serializeConnection, type QwkSearchConnection } from "./connect"

/** DDL for the table, matching its Drizzle definition. */
export const CREATE_QWKSEARCH_CONNECTION_TABLE = `CREATE TABLE IF NOT EXISTS "qwksearch_connection" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "connection" text NOT NULL,
  "updated_at" integer NOT NULL
)`

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> }

let ensured: Promise<void> | null = null

/** Creates the table once per isolate; a failure is forgotten and retried. */
async function ensureTable(db: unknown): Promise<void> {
  ensured ??= (db as RawDB).run(sql.raw(CREATE_QWKSEARCH_CONNECTION_TABLE)).then(() => undefined)
  ensured.catch(() => {
    ensured = null
  })
  return ensured
}

export async function loadConnection(userId: string): Promise<QwkSearchConnection | null> {
  const db = await getDBFromContext()
  await ensureTable(db)
  const [row] = await db
    .select({ connection: qwksearchConnection.connection })
    .from(qwksearchConnection)
    .where(eq(qwksearchConnection.userId, userId))
    .limit(1)
  return parseConnection(row?.connection)
}

export async function saveConnection(userId: string, connection: QwkSearchConnection | null): Promise<void> {
  const db = await getDBFromContext()
  await ensureTable(db)
  const value = serializeConnection(connection)
  if (!value) {
    await db.delete(qwksearchConnection).where(eq(qwksearchConnection.userId, userId))
    return
  }
  const now = new Date()
  await db
    .insert(qwksearchConnection)
    .values({ userId, connection: value, updatedAt: now })
    .onConflictDoUpdate({ target: qwksearchConnection.userId, set: { connection: value, updatedAt: now } })
}

/** Test-only: forget that the table was already created. */
export function resetEnsuredTable(): void {
  ensured = null
}
