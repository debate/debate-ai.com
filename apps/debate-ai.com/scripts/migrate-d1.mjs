/**
 * @fileoverview Applies `drizzle/*.sql` to a D1 database exactly once each,
 * recording what ran in a `schema_migrations` table so a later deploy can tell
 * an applied migration from an unapplied one.
 *
 * This replaces the previous `db:migrate:d1` one-liner:
 *
 * ```sh
 * for f in drizzle/*.sql; do wrangler d1 execute debate-ai-db --remote --file=$f || true; done
 * ```
 *
 * which had three defects that between them left production 24 migrations
 * behind while every deploy reported success:
 *
 * 1. **No record of what ran.** Every migration was replayed on every deploy,
 *    so `CREATE TABLE` for an existing table failed by design and the run
 *    could never distinguish that expected failure from a real one.
 * 2. **`|| true` swallowed everything.** A wrangler that could not reach the
 *    database (not logged in, wrong account, database id changed) exited
 *    non-zero and the loop marched on; `npm run deploy` then shipped a Worker
 *    whose code expected tables the database did not have. Every account-sync
 *    route (`/api/drill-sets`, `/api/judge-decisions`, …) answered 500 with
 *    `no such table`.
 * 3. **Whole-file execution.** `d1 execute --file` sends a file's statements as
 *    one batch, so the first failing statement takes the rest of the file with
 *    it — a partially-created migration, with no way to resume it.
 *
 * The runner here fixes all three: it skips migrations already recorded, runs
 * the remaining ones a statement at a time, and exits non-zero on the first
 * genuine error. "Already exists" / "duplicate column name" is the one
 * tolerated failure — that is a statement whose effect is already in place
 * (as it is for every table production created before this bookkeeping
 * existed), so the runner counts it as satisfied and records the migration
 * rather than requiring the database to be rebuilt from scratch.
 *
 * Usage (from `apps/debate-ai.com`):
 * ```
 * node scripts/migrate-d1.mjs --local     # local (miniflare) D1 for `wrangler dev`
 * node scripts/migrate-d1.mjs --remote    # Cloudflare D1, what `npm run deploy` runs
 * node scripts/migrate-d1.mjs --remote --dry-run   # list what would run
 * ```
 * @module scripts/migrate-d1
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Bookkeeping table. Deliberately not `d1_migrations`, which `wrangler d1 migrations apply` owns. */
const LEDGER_TABLE = "schema_migrations";

/**
 * A statement whose effect is already present. SQLite reports these for a
 * re-run `CREATE TABLE`/`CREATE INDEX` and for an `ALTER TABLE ... ADD COLUMN`
 * of a column that is already there — the exact shape of a database that was
 * migrated before any ledger existed. Every other error is real.
 */
const ALREADY_APPLIED = /already exists|duplicate column name/i;

function parseArgs(argv) {
  const args = { remote: false, local: false, dryRun: false, db: "debate-ai-db", dir: join(appDir, "drizzle") };
  for (const arg of argv) {
    if (arg === "--remote") args.remote = true;
    else if (arg === "--local") args.local = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--db=")) args.db = arg.slice("--db=".length);
    else if (arg.startsWith("--dir=")) args.dir = resolve(arg.slice("--dir=".length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.remote === args.local) {
    throw new Error("Pass exactly one of --remote or --local.");
  }
  return args;
}

/**
 * Runs one SQL file through wrangler. Returns the raw result rather than
 * throwing so the caller can decide whether a failure is tolerable.
 */
function wrangler(args, sqlPath) {
  const result = spawnSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      args.db,
      args.remote ? "--remote" : "--local",
      "--json",
      `--file=${sqlPath}`,
    ],
    { cwd: appDir, encoding: "utf8", env: process.env },
  );
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  return { ok: result.status === 0, stdout, stderr, output: `${stdout}\n${stderr}`, status: result.status };
}

/** Writes `sql` to a temp file and runs it — avoids shell-quoting backticks and newlines. */
function runSql(args, sql, scratchDir, label) {
  const sqlPath = join(scratchDir, `${label}.sql`);
  writeFileSync(sqlPath, sql, "utf8");
  return wrangler(args, sqlPath);
}

/**
 * Migration files in the order they are applied. Filename order matches the
 * numeric prefix drizzle-kit assigns, so it is the journal's order for every
 * file the journal tracks; files the journal has drifted away from (hand-written
 * migrations added alongside generated ones) still take their place by number
 * instead of being silently skipped the way a journal-only listing would skip
 * them.
 */
function listMigrations(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ tag: name.replace(/\.sql$/, ""), path: join(dir, name) }));
}

/**
 * drizzle-kit separates statements with `--> statement-breakpoint`. A file
 * without any (a hand-written migration) is sent as one chunk, which is what
 * `d1 execute --file` did for it before.
 */
function splitStatements(sql) {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function readAppliedTags(args, scratchDir) {
  const create = runSql(
    args,
    `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (\n` +
      "\ttag text PRIMARY KEY NOT NULL,\n" +
      "\tapplied_at integer DEFAULT (unixepoch()) NOT NULL\n" +
      ");",
    scratchDir,
    "__ledger",
  );
  if (!create.ok) {
    throw new Error(`Could not create the ${LEDGER_TABLE} ledger:\n${create.output}`);
  }

  const read = runSql(args, `SELECT tag FROM ${LEDGER_TABLE};`, scratchDir, "__ledger_read");
  if (!read.ok) {
    throw new Error(`Could not read ${LEDGER_TABLE}:\n${read.output}`);
  }

  // `--json` prints an array of per-statement results on stdout. wrangler also
  // writes banners and proxy/compatibility warnings around it (on either
  // stream, depending on the version), so slice stdout to the outermost
  // brackets rather than parsing the whole capture.
  const start = read.stdout.indexOf("[");
  const end = read.stdout.lastIndexOf("]");
  if (start === -1 || end < start) return new Set();
  try {
    const parsed = JSON.parse(read.stdout.slice(start, end + 1));
    const rows = parsed.flatMap((entry) => entry?.results ?? []);
    return new Set(rows.map((row) => row.tag));
  } catch {
    throw new Error(`Could not parse the ${LEDGER_TABLE} listing:\n${read.stdout}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const migrations = listMigrations(args.dir);
  const scratchDir = mkdtempSync(join(tmpdir(), "migrate-d1-"));
  const target = args.remote ? "remote" : "local";

  try {
    const applied = readAppliedTags(args, scratchDir);
    const pending = migrations.filter((migration) => !applied.has(migration.tag));

    console.log(`${migrations.length} migration(s) on disk, ${applied.size} already applied to ${target}.`);
    if (pending.length === 0) {
      console.log("Nothing to apply.");
      return;
    }
    console.log(`Applying ${pending.length}:`);

    for (const migration of pending) {
      if (args.dryRun) {
        console.log(`  - ${migration.tag} (dry run)`);
        continue;
      }

      const statements = splitStatements(readFileSync(migration.path, "utf8"));
      let satisfied = 0;

      for (const [index, statement] of statements.entries()) {
        const result = runSql(args, statement, scratchDir, `${migration.tag}-${index}`);
        if (result.ok) continue;
        if (ALREADY_APPLIED.test(result.output)) {
          satisfied++;
          continue;
        }
        // Fail loudly: a half-applied migration is why this runner exists.
        throw new Error(
          `${migration.tag} failed on statement ${index + 1}/${statements.length}:\n` +
            `${statement}\n\n${result.output}`,
        );
      }

      const record = runSql(
        args,
        `INSERT OR REPLACE INTO ${LEDGER_TABLE} (tag) VALUES ('${migration.tag}');`,
        scratchDir,
        `${migration.tag}-record`,
      );
      if (!record.ok) {
        throw new Error(`Applied ${migration.tag} but could not record it:\n${record.output}`);
      }

      const note = satisfied > 0 ? ` (${satisfied} statement(s) already in place)` : "";
      console.log(`  ✓ ${migration.tag}${note}`);
    }

    console.log(`Done — ${target} schema is up to date.`);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`\nMigration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
