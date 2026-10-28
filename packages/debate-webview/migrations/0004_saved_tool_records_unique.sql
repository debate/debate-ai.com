-- Makes sure `saved_tool_records` and the unique key its upserts conflict on
-- exist in production. The table had no migration in git; any drizzle file
-- for it lived in the now-removed `apps/debate-ai.com/drizzle/`, so nothing in
-- git guaranteed the deployed D1 had it, or had the
-- (user_id, collection, client_id) unique index. Without that index every
-- `PUT /api/tool-records/<collection>` fails with "ON CONFLICT clause does not
-- match any PRIMARY KEY or UNIQUE constraint" (a 500) — the likely cause
-- of the `debateVideoWatchHistory` sync 500s. Every statement is idempotent.
CREATE TABLE IF NOT EXISTS saved_tool_records (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  collection text NOT NULL,
  client_id text NOT NULL,
  data text NOT NULL,
  created_at integer NOT NULL DEFAULT (unixepoch()),
  updated_at integer NOT NULL DEFAULT (unixepoch())
);

-- A table that existed without the unique index may hold duplicate keys,
-- which would stop the index below from being created. Keep the newest row.
DELETE FROM saved_tool_records
WHERE id NOT IN (
  SELECT MAX(id) FROM saved_tool_records GROUP BY user_id, collection, client_id
);

CREATE INDEX IF NOT EXISTS idx_saved_tool_records_user_collection
  ON saved_tool_records (user_id, collection);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_tool_records_user_collection_client
  ON saved_tool_records (user_id, collection, client_id);
