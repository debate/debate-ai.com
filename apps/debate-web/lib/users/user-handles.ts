/**
 * Usernames — the `alexgul` in a personal file's `/alexgul/aff/k-aff-answers`
 * address (`@debate-ai/reason-docs/lib/reason-docs/personal-doc-paths`).
 *
 * Each signed-in user gets one handle, made from their name the first time it
 * is asked for and then kept, so a link stays put even if they rename
 * themselves. Two people with the same name get `alexgul` and `alexgul2`;
 * names that are page routes (`admin`, `videos`, …) are numbered the same way.
 *
 * `user_handles` is created here on first use: the app has no tracked
 * migrations (see `lib/database/ensure-columns.ts`). `handle` is UNIQUE, so two
 * first asks racing for the same name cannot both win — the loser re-reads
 * and picks the next number.
 */

import { sql } from "drizzle-orm";
import { pickUsername, usernameBase } from "@debate-ai/reason-docs/lib/reason-docs/personal-doc-paths";
import type { getDBFromContext } from "@/lib/database/context";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

export const CREATE_USER_HANDLES_SQL = `CREATE TABLE IF NOT EXISTS "user_handles" (
  "user_id" text PRIMARY KEY NOT NULL,
  "handle" text NOT NULL UNIQUE,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL
)`;

let tableReady: Promise<void> | null = null;

function ensureTable(db: Database): Promise<void> {
  tableReady ??= Promise.resolve(db.run(sql.raw(CREATE_USER_HANDLES_SQL))).then(
    () => undefined,
    (error) => {
      tableReady = null;
      throw error;
    },
  );
  return tableReady;
}

async function readHandle(db: Database, userId: string): Promise<string | null> {
  const rows = (await db.all(sql`SELECT handle FROM user_handles WHERE user_id = ${userId}`)) as Array<{
    handle: string;
  }>;
  return rows[0]?.handle ?? null;
}

/** Handles already taken that start with `base` — every one `pickUsername`
 *  could collide with. */
async function takenWithBase(db: Database, base: string): Promise<Set<string>> {
  const rows = (await db.all(
    sql`SELECT handle FROM user_handles WHERE handle = ${base} OR handle LIKE ${`${base}%`}`,
  )) as Array<{ handle: string }>;
  return new Set(rows.map((row) => row.handle));
}

const MAX_ATTEMPTS = 5;

/**
 * The user's handle, assigning one from `name` (or the email's local part)
 * on first ask.
 */
export async function getOrCreateUserHandle(
  db: Database,
  user: { id: string; name?: string | null; email?: string | null },
): Promise<string> {
  await ensureTable(db);
  const existing = await readHandle(db, user.id);
  if (existing) return existing;

  const base = usernameBase(user.name, user.email);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const taken = await takenWithBase(db, base);
    const handle = pickUsername(base, (candidate) => taken.has(candidate));
    await db.run(sql`INSERT OR IGNORE INTO user_handles (user_id, handle) VALUES (${user.id}, ${handle})`);
    const saved = await readHandle(db, user.id);
    if (saved) return saved;
    // Someone else took `handle` between the read and the insert; go again.
  }
  throw new Error(`Could not assign a username for user ${user.id}`);
}
