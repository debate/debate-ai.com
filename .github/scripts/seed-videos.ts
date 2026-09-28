/**
 * @fileoverview Loads the `data/videos/*.json` assets into the `videos` SQL
 * table so `/api/videos` can serve pages instead of the whole JSON blob.
 *
 * The JSON assets stay the source of truth that the YouTube sync writes to;
 * this script projects them into SQL and is safe to re-run — rows are upserted
 * by video id and ids that disappeared from the JSON are pruned.
 *
 * The statements themselves come from `debate-data-sync`'s shared builder, so
 * this script and the admin seed endpoint (`POST /api/admin/videos/seed`,
 * which runs them inside the Worker against the D1 binding) load byte-identical
 * data.
 *
 * Usage (from `apps/debate-ai.com`):
 * ```
 * bun run db:seed:videos          # write drizzle/seed/videos-seed.sql + apply locally
 * bun run db:seed:videos --sql-only
 * bun run db:seed:videos:d1       # apply the generated file to Cloudflare D1
 * ```
 * @module scripts/seed-videos
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildVideoRows, type VideoRow } from "debate-data-sync/src/videos/video-rows";
import { buildVideoSeedStatements } from "debate-data-sync/src/videos/video-seed-sql";
import roundsPolicy from "debate-data-sync/data/videos/rounds-policy.json" with { type: "json" };
import roundsPf from "debate-data-sync/data/videos/rounds-pf.json" with { type: "json" };
import roundsLd from "debate-data-sync/data/videos/rounds-ld.json" with { type: "json" };
import roundsCollege from "debate-data-sync/data/videos/rounds-college.json" with { type: "json" };
import lectures from "debate-data-sync/data/videos/debate-lectures.json" with { type: "json" };
import topPicks from "debate-data-sync/data/videos/debate-top-picks.json" with { type: "json" };

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_FILE = join(APP_DIR, "drizzle", "seed", "videos-seed.sql");

/** Reads the JSON assets and converts them into table rows. */
function loadRowsFromAssets(): VideoRow[] {
  return buildVideoRows({
    rounds: [roundsPolicy, roundsPf, roundsLd, roundsCollege] as any,
    lectures: lectures as any,
    topPicks: topPicks as any,
  });
}

/**
 * Applies the statements to the local SQLite file used in development.
 *
 * @param statements - Statements from `buildVideoSeedStatements`.
 */
async function applyLocally(statements: string[]) {
  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.DATABASE_URL || `file:${join(APP_DIR, "data", "db.sqlite")}`,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  for (const statement of statements) {
    await client.execute(statement);
  }
  client.close();
}

async function main() {
  const args = process.argv.slice(2);
  const sqlOnly = args.includes("--sql-only");

  const rows = loadRowsFromAssets();
  const statements = buildVideoSeedStatements(rows, Math.floor(Date.now() / 1000));
  const sql = `${statements.join(";\n\n")};\n`;

  await mkdir(dirname(SEED_FILE), { recursive: true });
  await writeFile(SEED_FILE, sql, "utf-8");
  console.log(
    `videos: wrote ${rows.length} rows to ${SEED_FILE} (${(sql.length / 1024 / 1024).toFixed(2)} MB)`,
  );

  if (sqlOnly) {
    console.log("videos: --sql-only, skipping local apply");
    return;
  }

  try {
    await applyLocally(statements);
    console.log("videos: applied to the local SQLite database");
  } catch (error) {
    console.error("videos: local apply failed (the SQL file is still written)", error);
    process.exitCode = 1;
  }
}

await main();
