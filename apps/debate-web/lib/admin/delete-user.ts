import { eq, getTableColumns, is } from "drizzle-orm";
import { SQLiteTable, getTableConfig, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { getDBFromContext } from "@/lib/database/context";
import * as schema from "@/lib/database/schema";
import { user } from "@/lib/database/schema";

type AdminDB = Awaited<ReturnType<typeof getDBFromContext>>;

interface UserReference {
  table: SQLiteTable;
  column: AnySQLiteColumn;
  /** The drizzle key for `column`, which `.set()` needs rather than the SQL name. */
  key: string;
  setNull: boolean;
}

/**
 * Every column in the schema with a foreign key onto `user.id`, read from the
 * schema itself so a table added later is cleaned up without anyone having to
 * remember this list. `set null` references (Stripe subscriptions, card
 * analyses) keep their row and lose the owner; everything else is the user's
 * own data and is deleted.
 */
const USER_REFERENCES: UserReference[] = (Object.values(schema) as unknown[])
  .filter((value): value is SQLiteTable => is(value, SQLiteTable))
  .flatMap((table) =>
    getTableConfig(table).foreignKeys.flatMap((foreignKey) => {
      const reference = foreignKey.reference();
      if (reference.foreignTable !== user) return [];
      const columns = Object.entries(getTableColumns(table));
      return reference.columns.map((column) => ({
        table,
        column,
        key: columns.find(([, candidate]) => candidate === column)![0],
        setNull: foreignKey.onDelete === "set null",
      }));
    }),
  );

const sqliteMaster = sqliteTable("sqlite_master", { name: text("name"), type: text("type") });

export interface DeletedUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Permanently removes an account and everything it owns.
 *
 * The schema declares `ON DELETE CASCADE` on these references, but production
 * has been migrated by hand-reconciled files (see `migration-sql.ts`), so a
 * table there is not guaranteed to carry the constraint. Each reference is
 * therefore cleared explicitly, and the whole thing is sent as one batch so
 * it applies as a single transaction and costs one query of the Worker's
 * budget. Tables the database does not have yet are skipped rather than
 * failing the batch with "no such table".
 *
 * @returns The removed account, or `null` if no user has that id.
 */
export async function deleteUserAccount(db: AdminDB, id: string): Promise<DeletedUser | null> {
  const [target] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!target) return null;

  const existing = new Set(
    (
      await db.select({ name: sqliteMaster.name }).from(sqliteMaster).where(eq(sqliteMaster.type, "table"))
    ).map((row: { name: string | null }) => row.name),
  );

  const cleanup = USER_REFERENCES.filter(({ table }) => existing.has(getTableConfig(table).name)).map(
    ({ table, column, key, setNull }) =>
      setNull
        ? db.update(table).set({ [key]: null }).where(eq(column, id))
        : db.delete(table).where(eq(column, id)),
  );

  await (db as any).batch([...cleanup, db.delete(user).where(eq(user.id, id))]);
  return target;
}
