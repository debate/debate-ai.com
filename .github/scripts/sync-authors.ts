/**
 * @fileoverview Builds the authors dataset from the docs' References pages,
 * writes it to `apps/debate-web/lib/authors/authors-snapshot.json`, and loads
 * it into the `authors`, `citations` and `citation_authors` SQL tables.
 *
 * The docs MDX stays the source of truth; the snapshot and the tables are a
 * projection of it. The snapshot carries no timestamps, so running this on
 * unchanged docs rewrites it byte for byte and the committed file only moves
 * when the References pages do. The SQL comes from the app's shared builder,
 * so this script and the admin endpoint (`POST /api/admin/authors/sync`) load
 * identical data.
 *
 * Usage (from `apps/debate-web`):
 * ```
 * bun run db:sync:authors            # write the snapshot + apply to the local SQLite database
 * bun run db:sync:authors --sql-only # write the snapshot + drizzle/seed/authors-seed.sql, no local apply
 * bun run db:seed:authors:d1         # same, then apply the SQL file to Cloudflare D1
 * ```
 * @module .github/scripts/sync-authors
 */

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAuthorsDataset } from "../../packages/debate-help-docs/lib/authors/collect-authors";
import { AUTHORS_DDL } from "../../apps/debate-web/lib/authors/authors-ddl";
import { buildAuthorSeedStatements } from "../../apps/debate-web/lib/authors/seed-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP_DIR = join(REPO_ROOT, "apps", "debate-web");
const SNAPSHOT_FILE = join(APP_DIR, "lib", "authors", "authors-snapshot.json");
const SEED_FILE = join(APP_DIR, "drizzle", "seed", "authors-seed.sql");

async function applyLocally(statements: string[]) {
  // The driver is a dependency of the app, not of the repo root this script lives under.
  const driver = createRequire(join(APP_DIR, "package.json")).resolve("@libsql/client");
  const { createClient } = (await import(pathToFileURL(driver).href)) as {
    createClient(config: { url: string; authToken?: string }): {
      execute(statement: string): Promise<unknown>;
      batch(statements: string[], mode: "write"): Promise<unknown>;
      close(): void;
    };
  };
  const client = createClient({
    url: process.env.DATABASE_URL || `file:${join(APP_DIR, "data", "db.sqlite")}`,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  try {
    for (const statement of AUTHORS_DDL) await client.execute(statement);
    await client.batch(statements, "write");
  } finally {
    client.close();
  }
}

async function main() {
  const sqlOnly = process.argv.slice(2).includes("--sql-only");

  const dataset = buildAuthorsDataset();
  const { stats } = dataset;
  console.log(
    `authors: ${stats.authors} authors (${stats.persons} people, ${stats.institutions} organizations), ${stats.citations} citations ` +
      `(${stats.citationsWithQuotes} with quotes, ${stats.unauthoredCitations} unsigned, ${stats.etAlCitations} "et al.")`,
  );
  for (const warning of dataset.warnings) console.warn(`authors: ${warning.kind}: ${warning.message}`);

  await mkdir(dirname(SNAPSHOT_FILE), { recursive: true });
  await writeFile(SNAPSHOT_FILE, `${JSON.stringify(dataset, null, 1)}\n`, "utf-8");
  console.log(`authors: wrote ${SNAPSHOT_FILE}`);

  const statements = buildAuthorSeedStatements(dataset);
  const sql = `${[...AUTHORS_DDL, ...statements].join(";\n\n")};\n`;
  await mkdir(dirname(SEED_FILE), { recursive: true });
  await writeFile(SEED_FILE, sql, "utf-8");
  console.log(`authors: wrote ${SEED_FILE} (${(sql.length / 1024 / 1024).toFixed(2)} MB)`);

  if (sqlOnly) {
    console.log("authors: --sql-only, skipping local apply");
    return;
  }

  try {
    await applyLocally(statements);
    console.log("authors: applied to the local SQLite database");
  } catch (error) {
    console.error("authors: local apply failed (the snapshot and SQL file are still written)", error);
    process.exitCode = 1;
  }
}

await main();
