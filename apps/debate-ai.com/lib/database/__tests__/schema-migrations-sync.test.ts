import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards against `apps/debate-ai.com/drizzle/` being deleted or falling out of
 * sync with `schema.ts` again. That exact directory has been deleted from
 * mainline by an unreviewed direct commit four times (see TODO.md and
 * `de88ca2`, `53656dd`, `35c6117`, `de88ca2` again, each "restore deleted
 * drizzle migrations" fix) — every time silently, since nothing failed until
 * a test or a production route that replays migrations hit `ENOENT` or a
 * missing table. This test fails immediately and specifically instead, at
 * the exact place a future deletion (or an un-generated schema change) would
 * first show up.
 */

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCHEMA_FILE = join(APP_ROOT, "lib/database/schema.ts");
const MIGRATIONS_DIR = join(APP_ROOT, "drizzle");

function tableNamesFromSchema(): string[] {
  const source = readFileSync(SCHEMA_FILE, "utf8");
  const names: string[] = [];
  for (const match of source.matchAll(/sqliteTable\(\s*["']([a-z0-9_]+)["']/gs)) {
    names.push(match[1]);
  }
  return names;
}

function allMigrationsSql(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
  return files.map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8")).join("\n");
}

describe("drizzle migrations stay in sync with schema.ts", () => {
  it("has a non-empty drizzle/ migrations directory", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(60);
  });

  it("has at least one table declared in schema.ts", () => {
    // A regression in the extraction regex itself (e.g. schema.ts changing
    // its import style) would otherwise let every other assertion here pass
    // vacuously on an empty list.
    expect(tableNamesFromSchema().length).toBeGreaterThan(60);
  });

  it("has a CREATE TABLE for every table schema.ts declares", () => {
    const sql = allMigrationsSql();
    const missing = tableNamesFromSchema().filter(
      (name) => !new RegExp(`CREATE TABLE[^;]*\`${name}\``, "i").test(sql),
    );
    expect(missing).toEqual([]);
  });
});
