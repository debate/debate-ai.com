import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { applySchemaRules, parseMysqlTables, tablesToSqlite } from "../scripts/lib/mysql-to-sqlite.mjs";
import { upgradeStatements } from "../scripts/lib/schema-upgrade.mjs";
import { pkgPath } from "./helpers/sqlite-d1";

const DUMP = `
CREATE TABLE \`panel\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
CREATE TABLE \`ballot\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`bye\` tinyint(1) NOT NULL DEFAULT 0,
  \`panel\` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`),
  KEY \`panel\` (\`panel\`),
  KEY \`panel_bye\` (\`panel\`,\`bye\`)
) ENGINE=InnoDB;
`;

const sqlOf = (statements: string[]) => statements.join("\n--> statement-breakpoint\n");
const run = (db: DatabaseSync, sql: string) => db.exec(sql.replace(/--> statement-breakpoint/g, ""));
const schema = (db: DatabaseSync) =>
  db.prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();

describe("schema upgrade migration", () => {
  const parsed = parseMysqlTables(DUMP);
  const oldSql = sqlOf(tablesToSqlite(parsed));
  const ruled = applySchemaRules(parsed);
  const newSql = sqlOf(tablesToSqlite(ruled));
  const upgrade = sqlOf(upgradeStatements(oldSql, newSql, ruled));

  it("rebuilds changed tables, keeping rows and turning sentinels into NULL", () => {
    const db = new DatabaseSync(":memory:");
    run(db, oldSql);
    db.exec("INSERT INTO panel (id) VALUES (7); INSERT INTO ballot (id, bye, panel) VALUES (1, 0, 0), (2, 5, 7)");
    run(db, upgrade);
    expect(db.prepare("SELECT id, bye, panel FROM ballot ORDER BY id").all()).toEqual([
      { id: 1, bye: 0, panel: null },
      { id: 2, bye: 1, panel: 7 },
    ]);
    const fresh = new DatabaseSync(":memory:");
    run(fresh, newSql);
    expect(schema(db)).toEqual(schema(fresh));
    db.exec("INSERT INTO ballot (bye) VALUES (1)");
    expect(db.prepare("SELECT max(id) AS id FROM ballot").get()).toEqual({ id: 3 });
  });

  it("runs cleanly on a database that already has the new schema", () => {
    const db = new DatabaseSync(":memory:");
    run(db, newSql);
    run(db, upgrade);
    const fresh = new DatabaseSync(":memory:");
    run(fresh, newSql);
    expect(schema(db)).toEqual(schema(fresh));
  });

  it("the shipped upgrade migration leaves a fresh database's schema unchanged", () => {
    const fresh = () => {
      const db = new DatabaseSync(":memory:");
      run(db, readFileSync(pkgPath("migrations/0001_tabroom_schema.sql"), "utf8"));
      return db;
    };
    const db = fresh();
    db.exec("INSERT INTO tourn (id, name, webname, tz) VALUES (1, 'Open', 'open', 'UTC')");
    run(db, readFileSync(pkgPath("migrations/0003_tabroom_schema_upgrade.sql"), "utf8"));
    expect(schema(db)).toEqual(schema(fresh()));
    expect(db.prepare("SELECT webname FROM tourn").get()).toEqual({ webname: "open" });
  });
});
