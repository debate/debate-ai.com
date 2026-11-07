/**
 * @fileoverview Creates the forum's tables on a live D1 and adds the columns
 * categories and thread likes brought with them.
 *
 * The app ships no migrations folder (see lib/database/ensure-columns.ts), so
 * a column added to `forum_threads` in `schema.ts` never reaches D1 on its own
 * — and Drizzle names every column in a `select()`, so one missing column
 * would fail the whole feed with `no such column`. The forum routes run this
 * once per isolate before their first query. Every statement is idempotent
 * (`IF NOT EXISTS`, and the column adds go through `ensureTableColumns`), so a
 * database that already has them pays one `PRAGMA` per isolate and nothing
 * else.
 *
 * The DDL matches `comments`, `comment_likes`, `forum_threads` and
 * `forum_thread_likes` in lib/database/schema.ts; an operator can also run
 * {@link FORUM_DDL} by hand with `wrangler d1 execute`.
 *
 * @module lib/forums/ensure-tables
 */
import { sql } from "drizzle-orm";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { forumThreads } from "@/lib/database/schema";

export const FORUM_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "comments" (
  "id" text PRIMARY KEY NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "parent_id" text REFERENCES "comments"("id") ON DELETE cascade,
  "author_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "body" text NOT NULL,
  "deleted_at" integer,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "updated_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_comments_resource" ON "comments" ("resource_type", "resource_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_comments_parent" ON "comments" ("parent_id", "created_at")`,
  `CREATE TABLE IF NOT EXISTS "comment_likes" (
  "comment_id" text NOT NULL REFERENCES "comments"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY ("comment_id", "user_id")
)`,
  `CREATE INDEX IF NOT EXISTS "idx_comment_likes_comment" ON "comment_likes" ("comment_id")`,
  `CREATE TABLE IF NOT EXISTS "forum_threads" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "category" text DEFAULT 'general' NOT NULL,
  "like_count" integer DEFAULT 0 NOT NULL,
  "author_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "deleted_at" integer,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "updated_at" integer DEFAULT (unixepoch()) NOT NULL,
  "last_activity_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_forum_threads_activity" ON "forum_threads" ("last_activity_at", "id")`,
  `CREATE INDEX IF NOT EXISTS "idx_forum_threads_author" ON "forum_threads" ("author_id", "created_at")`,
  `CREATE TABLE IF NOT EXISTS "forum_thread_likes" (
  "thread_id" text NOT NULL REFERENCES "forum_threads"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY ("thread_id", "user_id")
)`,
  `CREATE INDEX IF NOT EXISTS "idx_forum_thread_likes_thread" ON "forum_thread_likes" ("thread_id")`,
];

/**
 * Created after the column adds: an index on `category` cannot be built on a
 * `forum_threads` that predates the column, and the `CREATE TABLE` above is a
 * no-op on exactly that table.
 */
const POST_COLUMN_DDL: readonly string[] = [
  `CREATE INDEX IF NOT EXISTS "idx_forum_threads_category" ON "forum_threads" ("category", "last_activity_at", "id")`,
];

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

let ensured: Promise<void> | null = null;

/** Creates the forum tables and adds missing columns once per isolate; a failure is forgotten and retried. */
export function ensureForumTables(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of FORUM_DDL) await (db as RawDB).run(sql.raw(statement));
    await ensureTableColumns(db, forumThreads);
    for (const statement of POST_COLUMN_DDL) await (db as RawDB).run(sql.raw(statement));
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the tables were already created. */
export function resetEnsuredForumTables(): void {
  ensured = null;
}
