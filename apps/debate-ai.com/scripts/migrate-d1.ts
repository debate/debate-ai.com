#!/usr/bin/env bun
/**
 * Applies `drizzle/*.sql` to the D1 database, once each, and fails the deploy
 * if any of them does not apply.
 *
 * The shell loop this replaces —
 *
 *   for f in drizzle/*.sql; do wrangler d1 execute debate-ai-db --remote --file=$f || true; done
 *
 * — re-ran every migration on every deploy, so the already-applied ones failed
 * with "table already exists", and the `|| true` that made *that* survivable
 * swallowed genuine failures along with it. Worse, wrangler abandons a file at
 * its first failing statement, so a file whose opening `CREATE TABLE` collided
 * never reached the statements after it either. Production drifted 26
 * migrations behind `master` without a single red deploy: 20 tables and 16
 * columns were simply absent, and every route that touched one — the admin
 * user directory among them — answered 500 "no such table".
 *
 * This runner instead:
 *
 *  1. Records each applied file in `_d1_applied_migrations`, so a migration
 *     runs exactly once and a steady-state deploy is one read.
 *  2. Rewrites creates to `IF NOT EXISTS` and isolates column adds, so a
 *     database that already holds part of a file still converges (see
 *     ../lib/database/migration-sql.ts).
 *  3. Exits non-zero on any other error, stopping `npm run deploy` before it
 *     ships a build whose schema never landed.
 *
 * Usage: bun run scripts/migrate-d1.ts [--local] [--dry-run]
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BENIGN_ALTER_ERROR, planMigration } from "../lib/database/migration-sql";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(APP_ROOT, "drizzle");
// Workspace packages that own tables in the same database ship their own
// migrations; each is tracked under "<package>/<file>" so names never clash.
const PACKAGE_MIGRATION_DIRS: Record<string, string> = {
  "debate-tournaments": join(APP_ROOT, "../../packages/debate-tournaments/migrations"),
};
const DATABASE = process.env.D1_DATABASE_NAME || "debate-ai-db";
const TRACKING_TABLE = "_d1_applied_migrations";

const args = new Set(process.argv.slice(2));
const TARGET = args.has("--local") ? "--local" : "--remote";
const DRY_RUN = args.has("--dry-run");

const scratch = mkdtempSync(join(tmpdir(), "d1-migrate-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

interface Result {
  ok: boolean;
  output: string;
}

/** Runs wrangler, handing the failure back rather than throwing, for the caller to judge. */
function wrangler(extraArgs: string[]): Result {
  const argv = ["d1", "execute", DATABASE, TARGET, "--json", ...extraArgs];
  try {
    return { ok: true, output: execFileSync("wrangler", argv, { encoding: "utf8" }) };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` || String(error) };
  }
}

function run(sql: string, file?: string): Result {
  if (!file) return wrangler(["--command", sql]);
  const path = join(scratch, file);
  writeFileSync(path, sql);
  return wrangler(["--file", path]);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readApplied(): Set<string> {
  const created = run(
    `CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (name text PRIMARY KEY NOT NULL, applied_at integer NOT NULL DEFAULT (unixepoch()))`,
  );
  if (!created.ok) fail(`Could not create ${TRACKING_TABLE}:\n${created.output}`);

  const listed = run(`SELECT name FROM ${TRACKING_TABLE}`);
  if (!listed.ok) fail(`Could not read ${TRACKING_TABLE}:\n${listed.output}`);

  try {
    const parsed = JSON.parse(listed.output.slice(listed.output.indexOf("[")));
    return new Set<string>((parsed[0]?.results ?? []).map((row: { name: string }) => row.name));
  } catch {
    // A database that has never been migrated returns nothing parseable.
    return new Set<string>();
  }
}

function applyMigration(name: string): boolean {
  const steps = planMigration(readFileSync(migrationPath(name), "utf8"));

  for (const [index, step] of steps.entries()) {
    // Batched runs go through a file; a lone column add through --command, so
    // its "duplicate column name" can be judged on its own.
    const result = step.tolerateDuplicateColumn
      ? run(step.sql)
      : run(`${step.sql};\n`, `${index}-${name.replace(/\//g, "__")}`);
    if (result.ok) continue;
    if (step.tolerateDuplicateColumn && BENIGN_ALTER_ERROR.test(result.output)) continue;

    console.error(`\n✗ ${name} failed on:\n  ${step.sql.slice(0, 300)}\n${result.output}`);
    return false;
  }

  return true;
}

/** A tracked migration name → its file: `0001_x.sql` or `<package>/0001_x.sql`. */
function migrationPath(name: string): string {
  const slash = name.indexOf("/");
  if (slash === -1) return join(MIGRATIONS_DIR, name);
  return join(PACKAGE_MIGRATION_DIRS[name.slice(0, slash)], name.slice(slash + 1));
}

const sqlFiles = (dir: string) => readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();

// App migrations first, then each package's, each in file order.
const migrations = [
  ...sqlFiles(MIGRATIONS_DIR),
  ...Object.entries(PACKAGE_MIGRATION_DIRS).flatMap(([pkg, dir]) => sqlFiles(dir).map((file) => `${pkg}/${file}`)),
];
const applied = readApplied();
const pending = migrations.filter((name) => !applied.has(name));

console.log(
  `${migrations.length} migrations, ${applied.size} already applied, ${pending.length} pending (${DATABASE} ${TARGET}).`,
);

if (DRY_RUN) {
  for (const name of pending) console.log(`  would apply ${name}`);
  process.exit(0);
}

for (const name of pending) {
  process.stdout.write(`  ${name} … `);
  if (!applyMigration(name)) process.exit(1);

  const recorded = run(
    `INSERT OR REPLACE INTO ${TRACKING_TABLE} (name, applied_at) VALUES ('${name}', unixepoch())`,
  );
  if (!recorded.ok) fail(`\n✗ applied ${name} but could not record it:\n${recorded.output}`);
  console.log("ok");
}

console.log(pending.length ? `Applied ${pending.length} migration(s).` : "Schema up to date.");
