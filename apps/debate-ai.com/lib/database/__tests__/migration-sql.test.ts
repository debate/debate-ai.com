import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  BENIGN_ALTER_ERROR,
  isAlterAdd,
  makeIdempotent,
  planMigration,
  splitStatements,
} from "../migration-sql";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const MIGRATIONS_DIR = join(APP_ROOT, "drizzle");

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

describe("splitStatements", () => {
  it("splits on drizzle's statement-breakpoint marker", () => {
    const sql = "CREATE TABLE `a` (`id` integer);\n--> statement-breakpoint\nCREATE INDEX `i` ON `a` (`id`);";
    expect(splitStatements(sql)).toEqual([
      "CREATE TABLE `a` (`id` integer)",
      "CREATE INDEX `i` ON `a` (`id`)",
    ]);
  });

  it("splits hand-written files on semicolons", () => {
    const sql = "CREATE TABLE `a` (`id` integer);\nCREATE TABLE `b` (`id` integer);\n";
    expect(splitStatements(sql)).toHaveLength(2);
  });

  // The marker is itself a `--` line comment. A comment strip that does not
  // spare `-->` swallows it and yields the whole file as a single statement,
  // which then fails as soon as any one of its creates collides.
  it("does not let the comment strip eat the breakpoint marker", () => {
    const sql = [
      "-- a leading note",
      "CREATE TABLE `a` (`id` integer);",
      "--> statement-breakpoint",
      "CREATE TABLE `b` (`id` integer);",
    ].join("\n");
    const statements = splitStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).not.toContain("a leading note");
  });

  it("splits every real migration into at least one statement", () => {
    for (const name of migrationFiles) {
      const statements = splitStatements(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
      expect(statements.length, name).toBeGreaterThan(0);
      // A file that came back as one blob is the failure mode above.
      const creates = statements.filter((s) => /^\s*CREATE\s+TABLE/i.test(s)).length;
      expect(creates, name).toBeLessThanOrEqual(statements.length);
    }
  });
});

describe("makeIdempotent", () => {
  it.each([
    ["CREATE TABLE `a` (`id` integer)", "CREATE TABLE IF NOT EXISTS `a` (`id` integer)"],
    ["CREATE INDEX `i` ON `a` (`id`)", "CREATE INDEX IF NOT EXISTS `i` ON `a` (`id`)"],
    [
      "CREATE UNIQUE INDEX `i` ON `a` (`id`)",
      "CREATE UNIQUE INDEX IF NOT EXISTS `i` ON `a` (`id`)",
    ],
  ])("rewrites %s", (input, expected) => {
    expect(makeIdempotent(input)).toBe(expected);
  });

  it("leaves an already-guarded statement alone", () => {
    const sql = "CREATE TABLE IF NOT EXISTS `a` (`id` integer)";
    expect(makeIdempotent(sql)).toBe(sql);
  });

  it("leaves statements it cannot guard alone", () => {
    const sql = "ALTER TABLE `a` ADD `b` text";
    expect(makeIdempotent(sql)).toBe(sql);
  });
});

describe("isAlterAdd", () => {
  it("recognises a column add", () => {
    expect(isAlterAdd("ALTER TABLE `user_settings` ADD `color_theme` text")).toBe(true);
  });

  it("does not claim creates", () => {
    expect(isAlterAdd("CREATE TABLE `a` (`id` integer)")).toBe(false);
  });
});

describe("planMigration", () => {
  it("merges a consecutive run of batchable statements into one step", () => {
    const sql = [
      "CREATE TABLE `a` (`id` integer);",
      "--> statement-breakpoint",
      "CREATE INDEX `i` ON `a` (`id`);",
    ].join("\n");
    expect(planMigration(sql)).toEqual([
      {
        sql: "CREATE TABLE IF NOT EXISTS `a` (`id` integer);\nCREATE INDEX IF NOT EXISTS `i` ON `a` (`id`)",
        tolerateDuplicateColumn: false,
      },
    ]);
  });

  // 0025_flat_wrecker.sql adds documents.parent_id and then indexes it. Hoist
  // the creates ahead of the column adds and the index fails with "no such
  // column: parent_id", so a column add has to split the run, not be deferred.
  it("keeps a column add in position, splitting the run around it", () => {
    const sql = [
      "ALTER TABLE `documents` ADD `parent_id` integer;",
      "--> statement-breakpoint",
      "CREATE INDEX `idx_documents_parent_id` ON `documents` (`parent_id`);",
    ].join("\n");
    expect(planMigration(sql)).toEqual([
      { sql: "ALTER TABLE `documents` ADD `parent_id` integer", tolerateDuplicateColumn: true },
      {
        sql: "CREATE INDEX IF NOT EXISTS `idx_documents_parent_id` ON `documents` (`parent_id`)",
        tolerateDuplicateColumn: false,
      },
    ]);
  });

  it("gives each column add its own step so one can be forgiven alone", () => {
    const sql = [
      "ALTER TABLE `a` ADD `b` text;",
      "--> statement-breakpoint",
      "ALTER TABLE `a` ADD `c` text;",
    ].join("\n");
    expect(planMigration(sql).map((step) => step.tolerateDuplicateColumn)).toEqual([true, true]);
  });
});

describe("BENIGN_ALTER_ERROR", () => {
  it("forgives a re-added column and nothing else", () => {
    expect(BENIGN_ALTER_ERROR.test("duplicate column name: color_theme")).toBe(true);
    expect(BENIGN_ALTER_ERROR.test("no such table: saved_flows")).toBe(false);
    expect(BENIGN_ALTER_ERROR.test("table `user` already exists")).toBe(false);
  });
});

/**
 * The regression that motivated all of the above: replay every migration, the
 * way the runner would, onto a database that already holds part of the schema,
 * and check it converges instead of stopping at the first collision.
 */
describe("replaying every migration onto a partially-migrated database", () => {
  // Mirrors applyMigration() in scripts/migrate-d1.ts, against SQLite directly
  // instead of through wrangler.
  const applyAll = (db: DatabaseSync) => {
    let benign = 0;
    for (const name of migrationFiles) {
      for (const step of planMigration(readFileSync(join(MIGRATIONS_DIR, name), "utf8"))) {
        try {
          db.exec(step.sql);
        } catch (error) {
          const message = (error as Error).message;
          if (step.tolerateDuplicateColumn && BENIGN_ALTER_ERROR.test(message)) {
            benign++;
            continue;
          }
          throw new Error(`${name}: ${message}\n  ${step.sql.slice(0, 200)}`);
        }
      }
    }
    return benign;
  };

  const tableNames = (db: DatabaseSync) =>
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
      .map((row) => row.name);

  it("applies cleanly to an empty database", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = OFF;");
    expect(() => applyAll(db)).not.toThrow();
    expect(tableNames(db)).toContain("saved_flows");
    db.close();
  });

  it("applies cleanly a second time, changing nothing", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = OFF;");
    applyAll(db);
    const first = tableNames(db).sort();
    expect(() => applyAll(db)).not.toThrow();
    expect(tableNames(db).sort()).toEqual(first);
    db.close();
  });

  // Production's shape when the drift was found: the auth/base tables from the
  // 2024 lineage present, everything from migration 0008 on missing.
  it("brings a database that stopped at the base tables fully forward", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec(`
      CREATE TABLE \`user\` (\`id\` text PRIMARY KEY NOT NULL, \`name\` text NOT NULL,
        \`email\` text NOT NULL, \`email_verified\` integer DEFAULT false NOT NULL,
        \`image\` text, \`created_at\` integer NOT NULL, \`updated_at\` integer NOT NULL,
        \`is_anonymous\` integer DEFAULT false NOT NULL);
      CREATE TABLE \`session\` (\`id\` text PRIMARY KEY NOT NULL, \`expires_at\` integer NOT NULL,
        \`token\` text NOT NULL, \`created_at\` integer NOT NULL, \`updated_at\` integer NOT NULL,
        \`ip_address\` text, \`user_agent\` text, \`user_id\` text NOT NULL);
      CREATE TABLE \`documents\` (\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`title\` text DEFAULT 'Untitled' NOT NULL, \`content\` text DEFAULT '' NOT NULL,
        \`user_id\` text, \`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\` integer DEFAULT (unixepoch()) NOT NULL);
      CREATE INDEX \`idx_documents_user_id\` ON \`documents\` (\`user_id\`);
    `);

    expect(() => applyAll(db)).not.toThrow();

    const tables = tableNames(db);
    // The eight tables the admin user directory counts from, all of which were
    // missing in production and every one of which 500'd that route.
    for (const table of [
      "documents",
      "saved_flows",
      "saved_rounds",
      "saved_word_count_rounds",
      "saved_judge_decisions",
      "saved_speech_send_log",
      "practice_vs_ai_debates",
      "saved_drill_sets",
    ]) {
      expect(tables, table).toContain(table);
    }

    // The column adds landed on the pre-existing table too.
    const documentColumns = (
      db.prepare("SELECT name FROM pragma_table_info('documents')").all() as { name: string }[]
    ).map((row) => row.name);
    expect(documentColumns).toContain("parent_id");
    expect(documentColumns).toContain("is_folder");

    db.close();
  });
});
