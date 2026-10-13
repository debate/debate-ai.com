import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  applySchemaRules,
  booleanColumns,
  mysqlInsertsToSqlite,
  mysqlStringToSqlite,
  parseMysqlTables,
  seedCleanupStatements,
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

const RULES_DUMP = `
CREATE TABLE \`tourn\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`webname\` varchar(64) DEFAULT NULL,
  \`hidden\` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`),
  KEY \`id\` (\`id\`)
) ENGINE=InnoDB;
CREATE TABLE \`person\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`email\` varchar(127) NOT NULL DEFAULT '',
  \`phone\` bigint(20) DEFAULT NULL,
  \`password\` varchar(128) DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`person_email\` (\`email\`),
  KEY \`email\` (\`email\`)
) ENGINE=InnoDB;
CREATE TABLE \`ballot\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`side\` tinyint(1) NOT NULL DEFAULT 0,
  \`bye\` tinyint(1) NOT NULL DEFAULT 0,
  \`panel\` int(11) NOT NULL DEFAULT 0,
  \`entered_by\` int(11) DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`ballot_ejp\` (\`panel\`,\`entered_by\`),
  UNIQUE KEY \`uk_ballots\` (\`entered_by\`,\`panel\`),
  KEY \`panel\` (\`panel\`)
) ENGINE=InnoDB;
CREATE TABLE \`tourn_setting\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`tourn\` int(11) NOT NULL DEFAULT 0,
  \`tag\` varchar(31) NOT NULL DEFAULT '',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_tourn_setting\` (\`tourn\`,\`tag\`),
  UNIQUE KEY \`tourn_tag\` (\`tourn\`,\`tag\`),
  KEY \`tourn\` (\`tourn\`),
  KEY \`tags\` (\`tag\`,\`tourn\`)
) ENGINE=InnoDB;
CREATE TABLE \`panel\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
INSERT INTO \`tourn\` VALUES (1,'open',0);
INSERT INTO \`person\` VALUES (1,'a@b.c',4155550100,'$2b$hash');
INSERT INTO \`tourn_setting\` VALUES (1,0,'orphan');
`;

describe("schema rules", () => {
  const tables = applySchemaRules(parseMysqlTables(RULES_DUMP));
  const byName = (name: string) => tables.find((t) => t.name === name)!;
  const col = (table: string, name: string) => byName(table).columns.find((c) => c.name === name)!;
  const indexNames = (table: string) => byName(table).indexes.map((i) => i.name);

  it("drops indexes the primary key or another index already covers", () => {
    expect(indexNames("tourn")).toEqual(["webname"]);
    expect(indexNames("person")).toEqual(["person_email"]);
    expect(indexNames("ballot")).toEqual(["ballot_ejp"]);
    expect(indexNames("tourn_setting")).toEqual(["tourn_tag", "tags"]);
    expect(byName("tourn_setting").droppedIndexes.sort()).toEqual(["tourn", "uk_tourn_setting"]);
  });

  it("widens lossy types and checks flag columns", () => {
    expect(col("person", "phone").type).toBe("TEXT");
    expect(col("tourn", "hidden").check).toBe("IN (0, 1)");
    expect(col("ballot", "side").check).toBe("IN (0, 1, 2)");
  });

  it("only treats INTEGER columns named after a table as references", () => {
    expect(col("person", "email").reference).toBeNull();
    expect(col("ballot", "panel").reference).toBe("panel");
    expect(col("ballot", "entered_by").reference).toBe("person");
    expect(col("tourn_setting", "tag").reference).toBeNull();
  });

  it("turns a reference's DEFAULT 0 into a nullable column", () => {
    expect(col("ballot", "panel")).toMatchObject({ sentinel: true, notNull: false, default: "NULL" });
    const db = new DatabaseSync(":memory:");
    for (const s of tablesToSqlite(tables)) db.exec(s);
    db.exec("INSERT INTO ballot (side) VALUES (2)");
    expect(db.prepare("SELECT panel FROM ballot").get()).toEqual({ panel: null });
    expect(() => db.exec("INSERT INTO ballot (side) VALUES (3)")).toThrow(/CHECK/);
    expect(() => db.exec("INSERT INTO tourn (hidden) VALUES (2)")).toThrow(/CHECK/);
  });

  it("cleans sample rows: sentinels become NULL and passwords are blanked", () => {
    const db = new DatabaseSync(":memory:");
    for (const s of tablesToSqlite(tables)) db.exec(s);
    for (const s of mysqlInsertsToSqlite(RULES_DUMP)) db.exec(s);
    for (const s of seedCleanupStatements(tables)) db.exec(s);
    expect(db.prepare("SELECT tourn FROM tourn_setting").get()).toEqual({ tourn: null });
    expect(db.prepare("SELECT phone, password FROM person").get()).toEqual({ phone: "4155550100", password: null });
  });
});
