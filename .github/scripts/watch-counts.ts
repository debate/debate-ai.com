#!/usr/bin/env bun
/**
 * @fileoverview Logs how many videos each user has watched.
 *
 * The watch history (`debateVideoWatchHistory`, kept per browser by
 * `packages/debate-videos`' `state/videoWatchHistory.ts`) syncs to the
 * account as one `saved_tool_records` row per video — so the row count
 * per user *is* that user's watched-video count, and the record's own
 * `completed` flag says whether it was watched to the end.
 *
 * Reads the same database the app does: the local SQLite file in
 * development, or Cloudflare D1 with `--d1` (the deployed database
 * `wrangler` knows about, same as `migrate-d1.ts`).
 *
 * Usage (from anywhere):
 * ```
 * bun run .github/scripts/watch-counts.ts            # local dev database
 * bun run .github/scripts/watch-counts.ts --d1       # production D1
 * bun run .github/scripts/watch-counts.ts --json     # machine-readable
 * ```
 * Or from `apps/debate-ai.com`: `bun run db:watch-counts[:d1]`.
 * @module .github/scripts/watch-counts
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This script lives in `.github/scripts`, not in the app whose database
// it reads, so the app root is named explicitly rather than derived from
// its own folder.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP_DIR = join(REPO_ROOT, "apps", "debate-ai.com");
const LOCAL_DB = process.env.DATABASE_URL || `file:${join(APP_DIR, "data", "db.sqlite")}`;
const DATABASE = process.env.D1_DATABASE_NAME || "debate-ai-db";

const args = new Set(process.argv.slice(2));
const TARGET_D1 = args.has("--d1");
const JSON_OUT = args.has("--json");

/** One user's watch-history totals, as the query returns them. */
interface WatchCountRow {
  user_id: string;
  name: string | null;
  email: string | null;
  videos: number;
  completed: number;
}

/**
 * Counts each user's watched videos: every synced watch-history record
 * is one video, and `completed` is how many were watched to the end.
 */
const WATCH_COUNTS_SQL = `
  SELECT r.user_id AS user_id,
         u.name AS name,
         u.email AS email,
         COUNT(*) AS videos,
         COALESCE(SUM(CASE WHEN json_extract(r.data, '$.completed') = 1 THEN 1 ELSE 0 END), 0) AS completed
  FROM saved_tool_records r
  LEFT JOIN user u ON u.id = r.user_id
  WHERE r.collection = 'debateVideoWatchHistory'
  GROUP BY r.user_id
  ORDER BY videos DESC, u.email ASC
`;

/** Runs wrangler against D1, handing the failure back rather than throwing. */
function wranglerQuery(sql: string): WatchCountRow[] {
  let output: string;
  try {
    output = execFileSync(
      "wrangler",
      ["d1", "execute", DATABASE, "--remote", "--json", "--command", sql],
      { encoding: "utf8" },
    );
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    console.error(`${failure.stdout ?? ""}${failure.stderr ?? ""}` || String(error));
    process.exit(1);
  }
  try {
    const parsed = JSON.parse(output.slice(output.indexOf("["))) as { results: WatchCountRow[] }[];
    return parsed[0]?.results ?? [];
  } catch {
    console.error("Could not read the query results back from wrangler.");
    process.exit(1);
  }
}

/** Reads the local SQLite file (or `DATABASE_URL`, e.g. a libsql server). */
async function localQuery(): Promise<WatchCountRow[]> {
  const { createClient } = await import("@libsql/client");
  // A `file:` URL cannot open a path whose folder does not exist
  // yet — a fresh checkout has no `data/` — so create it first.
  if (LOCAL_DB.startsWith("file:")) {
    mkdirSync(dirname(LOCAL_DB.slice("file:".length)), { recursive: true });
  }
  const client = createClient({
    url: LOCAL_DB,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  try {
    const result = await client.execute(WATCH_COUNTS_SQL);
    return result.rows as unknown as WatchCountRow[];
  } catch (error) {
    // A fresh local database has no tables yet — nothing has been
    // watched, by anyone.
    if (/no such table/i.test(String((error as Error)?.message ?? error))) return [];
    throw error;
  } finally {
    client.close();
  }
}

const rows = TARGET_D1 ? wranglerQuery(WATCH_COUNTS_SQL) : await localQuery();

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

if (rows.length === 0) {
  console.log("watch-counts: no watched videos recorded yet.");
  process.exit(0);
}

const totalVideos = rows.reduce((sum, row) => sum + row.videos, 0);
const totalCompleted = rows.reduce((sum, row) => sum + row.completed, 0);
console.log(
  `watch-counts: ${rows.length} user(s), ${totalVideos} video(s) watched` +
    ` (${totalCompleted} to the end) — ${TARGET_D1 ? `${DATABASE} (remote)` : LOCAL_DB}`,
);
for (const row of rows) {
  const who = row.email ? `${row.email}${row.name ? ` (${row.name})` : ""}` : row.user_id;
  console.log(`  ${who}: ${row.videos} video(s), ${row.completed} watched to the end`);
}
