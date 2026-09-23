import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  booleanColumns,
  mysqlInsertsToSqlite,
  mysqlStringToSqlite,
  parseMysqlTables,
  tablesToSqlite,
} from "../scripts/lib/mysql-to-sqlite.mjs";

const DUMP = `
CREATE TABLE \`tourn\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(63) NOT NULL DEFAULT '',
  \`hidden\` tinyint(1) NOT NULL DEFAULT 0,
  \`fee\` decimal(8,2) DEFAULT 0.00,
  \`timestamp\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (\`id\`),
  KEY \`name\` (\`name\`(32)),
  CONSTRAINT \`fk\` FOREIGN KEY (\`id\`) REFERENCES \`x\` (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
CREATE TABLE \`session\` (
  \`id\` int(11) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
CREATE TABLE \`entry_student\` (
  \`entry\` int(11) NOT NULL,
  \`student\` int(11) NOT NULL,
  \`hidden\` smallint(6) DEFAULT NULL,
  PRIMARY KEY (\`entry\`,\`student\`),
  UNIQUE KEY \`es\` (\`entry\`,\`student\`)
) ENGINE=InnoDB;
INSERT INTO \`tourn\` VALUES
(1,'O\\'Brien \\"Classic\\"',0,1.50,'2024-01-01 00:00:00');
`;

describe("mysql-to-sqlite", () => {
  const tables = parseMysqlTables(DUMP);

  it("parses tables, keys and columns", () => {
    expect(tables.map((t) => t.name)).toEqual(["tourn", "session", "entry_student"]);
    expect(tables[0].indexes).toEqual([{ name: "name", unique: false, columns: ["name"] }]);
    expect(tables[2].primaryKey).toEqual(["entry", "student"]);
  });

  it("emits DDL SQLite runs, skipping tables and foreign keys", () => {
    const ddl = tablesToSqlite(tables, { skipTables: ["session"] });
    expect(ddl.join("\n")).not.toMatch(/session|FOREIGN|ON UPDATE/);
    expect(ddl[0]).toContain('"id" INTEGER PRIMARY KEY AUTOINCREMENT');
    const db = new DatabaseSync(":memory:");
    for (const s of ddl) db.exec(s);
    for (const s of mysqlInsertsToSqlite(DUMP)) db.exec(s);
    expect(db.prepare("select name, fee from tourn").get()).toEqual({ name: 'O\'Brien "Classic"', fee: 1.5 });
  });

  it("only treats columns that are tinyint(1) everywhere as booleans", () => {
    expect(booleanColumns(tables)).not.toContain("hidden");
    expect(booleanColumns([tables[0]])).toContain("hidden");
  });

  it("re-quotes MySQL string escapes", () => {
    expect(mysqlStringToSqlite("'a\\'b\\nc'")).toBe("'a''b\nc'");
  });
});
