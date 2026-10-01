import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { schemaStatements } from "./schema-sql";

/**
 * Checks that `schema.ts` turns into a complete database, and, where the
 * untracked `drizzle/` folder is still on disk, that its migrations create
 * every table `schema.ts` declares. The folder is gitignored now (it is kept
 * locally for `db:migrate:d1`), so a fresh checkout has none and only the
 * first block runs there.
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

describe("schema.ts builds into a database", () => {
  it("has at least one table declared in schema.ts", () => {
    // A regression in the extraction regex itself (e.g. schema.ts changing
    // its import style) would otherwise let every other assertion here pass
    // vacuously on an empty list.
    expect(tableNamesFromSchema().length).toBeGreaterThan(60);
  });

  it("generates a CREATE TABLE for every table schema.ts declares", async () => {
    const sql = (await schemaStatements()).join("\n");
    const missing = tableNamesFromSchema().filter(
      (name) => !new RegExp(`CREATE TABLE[^;]*\`${name}\``, "i").test(sql),
    );
    expect(missing).toEqual([]);
  });
});

/**
 * `drizzle/` is no longer tracked in git (see `.gitignore`), so these run only
 * in a checkout that still has the folder on disk, which is the one deploys
 * run `db:migrate:d1` from.
 */
describe.runIf(existsSync(MIGRATIONS_DIR))("local drizzle migrations stay in sync with schema.ts", () => {
  it("has a non-empty drizzle/ migrations directory", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(60);
  });

  it("has a CREATE TABLE for every table schema.ts declares", () => {
    const sql = allMigrationsSql();
    const missing = tableNamesFromSchema().filter(
      (name) => !new RegExp(`CREATE TABLE[^;]*\`${name}\``, "i").test(sql),
    );
    expect(missing).toEqual([]);
  });
});
