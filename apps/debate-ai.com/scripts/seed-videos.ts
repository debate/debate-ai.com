/**
 * @fileoverview Loads the `data/videos/*.json` assets into the `videos` SQL
 * table so `/api/videos` can serve pages instead of the whole JSON blob.
 *
 * The JSON assets stay the source of truth that the YouTube sync writes to;
 * this script projects them into SQL and is safe to re-run — rows are upserted
 * by video id and ids that disappeared from the JSON are pruned.
 *
 * Usage (from `apps/debate-ai.com`):
 * ```
 * bun run db:seed:videos          # write drizzle/seed/videos-seed.sql + apply locally
 * bun run db:seed:videos -- --sql-only
 * bun run db:seed:videos:d1       # apply the generated file to Cloudflare D1
 * ```
 * @module scripts/seed-videos
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildVideoRows,
  type VideoRow,
} from "debate-data-sync/src/videos/video-rows";
import roundsPolicy from "debate-data-sync/data/videos/rounds-policy.json" with { type: "json" };
import roundsPf from "debate-data-sync/data/videos/rounds-pf.json" with { type: "json" };
import roundsLd from "debate-data-sync/data/videos/rounds-ld.json" with { type: "json" };
import roundsCollege from "debate-data-sync/data/videos/rounds-college.json" with { type: "json" };
import lectures from "debate-data-sync/data/videos/debate-lectures.json" with { type: "json" };
import topPicks from "debate-data-sync/data/videos/debate-top-picks.json" with { type: "json" };

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_FILE = join(APP_DIR, "drizzle", "seed", "videos-seed.sql");

/** Rows per multi-row `INSERT`, keeping each statement well under D1's limits. */
const ROWS_PER_STATEMENT = 50;

/** Column order shared by the generated `INSERT` statements. */
const COLUMNS = [
  "video_id",
  "source",
  "title",
  "published_at",
  "published_ms",
  "channel",
  "view_count",
  "description",
  "style",
  "category",
  "category_key",
  "tournament",
  "round_level",
  "aff_team",
  "neg_team",
  "aff_win",
  "judge_decision",
  "arg_1ac",
  "arg_2nr",
  "is_top_pick",
  "speech_docs_url",
  "season_year",
  "search_text",
] as const;

/** Renders a JavaScript value as a SQLite literal. */
function literal(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${value.replace(/'/g, "''")}'`;
}

/** Projects a row onto {@link COLUMNS}, in order. */
function rowValues(row: VideoRow): (string | number | boolean | null)[] {
  return [
    row.videoId,
    row.source,
    row.title,
    row.publishedAt,
    row.publishedMs,
    row.channel,
    row.viewCount,
    row.description,
    row.style,
    row.category,
    row.categoryKey,
    row.tournament,
    row.roundLevel,
    row.affTeam,
    row.negTeam,
    row.affWin,
    row.judgeDecision,
    row.arg1ac,
    row.arg2nr,
    row.isTopPick,
    row.speechDocsUrl,
    row.seasonYear,
    row.searchText,
  ];
}

/**
 * Builds the seed statements: upsert every JSON row, then prune rows the JSON
 * no longer carries (any row left with a stamp older than this run).
 *
 * @param rows - Rows built from the JSON assets.
 * @param seededAt - Unix seconds captured before the upserts, used as the
 *   prune threshold.
 * @returns One SQL statement per array entry (no trailing semicolons).
 */
function buildSeedStatements(rows: VideoRow[], seededAt: number): string[] {
  const statements: string[] = [];
  const columnList = COLUMNS.map((c) => `"${c}"`).join(", ");
  const updateList = COLUMNS.filter((c) => c !== "video_id")
    .map((c) => `"${c}" = excluded."${c}"`)
    .join(", ");

  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const batch = rows.slice(i, i + ROWS_PER_STATEMENT);
    const values = batch
      .map((row) => `(${rowValues(row).map(literal).join(", ")})`)
      .join(",\n  ");
    statements.push(
      `INSERT INTO "videos" (${columnList}) VALUES\n  ${values}\n` +
        `ON CONFLICT("video_id") DO UPDATE SET ${updateList}, "updated_at" = unixepoch()`,
    );
  }

  // Every row present in the JSON was just stamped with the current time, so
  // anything still older than this run has been removed upstream.
  statements.push(`DELETE FROM "videos" WHERE "updated_at" < ${seededAt}`);

  return statements;
}

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
 * @param statements - Statements from {@link buildSeedStatements}.
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
  const statements = buildSeedStatements(rows, Math.floor(Date.now() / 1000));
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
