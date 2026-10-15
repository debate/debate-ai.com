/**
 * The Tabroom tables (`packages/debate-tournaments/migrations`) and the
 * prediction-market tables live in the same D1 database as the app's own
 * schema (`debate_db`). Every migration statement is `CREATE … IF NOT EXISTS`,
 * so a name clash would not fail the deploy: the second table would silently
 * never be created and the first one's columns would be read by code expecting
 * the other's. These tests build that shared database the way production
 * holds it and prove nothing collides.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";

import { splitStatements } from "../../database/migration-sql";
import { applySchema, schemaStatements } from "../../database/__tests__/schema-sql";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..");
const packageMigration = (pkg: string, file: string) =>
  splitStatements(readFileSync(join(REPO_ROOT, "packages", pkg, "migrations", file), "utf8"));

const tabroom = () => packageMigration("debate-tournaments", "0001_tabroom_schema.sql");
const predictions = () => packageMigration("debate-predictions", "0001_prediction_markets.sql");

/** The table and index names a list of statements creates. */
function createdNames(statements: string[]): { tables: Set<string>; indexes: Set<string> } {
  const tables = new Set<string>();
  const indexes = new Set<string>();
  for (const statement of statements) {
    const match = /CREATE\s+(TABLE|(?:UNIQUE\s+)?INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?([A-Za-z0-9_]+)/i.exec(statement);
    if (!match) continue;
    (match[1].toUpperCase() === "TABLE" ? tables : indexes).add(match[2].toLowerCase());
  }
  return { tables, indexes };
}

const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((name) => b.has(name)).sort();

describe("the Tabroom schema in the app's D1 database", () => {
  it("creates no table or index the app's schema already has", async () => {
    const app = createdNames(await schemaStatements());
    const tab = createdNames(tabroom());
    expect(tab.tables.size).toBeGreaterThan(100);
    expect(overlap(tab.tables, app.tables)).toEqual([]);
    expect(overlap(tab.indexes, app.indexes)).toEqual([]);
  });

  it("creates no table or index the prediction markets already have", () => {
    const tab = createdNames(tabroom());
    const markets = createdNames(predictions());
    expect(overlap(tab.tables, markets.tables)).toEqual([]);
    expect(overlap(tab.indexes, markets.indexes)).toEqual([]);
  });

  it("leaves better-auth's session table to the app", () => {
    expect(createdNames(tabroom()).tables.has("session")).toBe(false);
  });

  it("applies on top of the app's schema in deploy order, and a hosted tournament can be written", async () => {
    const client = createClient({ url: ":memory:" });
    await applySchema(client);
    for (const statement of [...tabroom(), ...predictions()]) await client.execute(statement);

    const sessionColumns = (await client.execute("SELECT name FROM pragma_table_info('session')")).rows.map(
      (row) => row.name,
    );
    expect(sessionColumns).toEqual(expect.arrayContaining(["token", "user_id", "expires_at"]));

    await client.execute("INSERT INTO person (id, email, first, last) VALUES (1, 'host@example.com', 'Host', 'Person')");
    await client.execute("INSERT INTO tourn (id, name, webname, tz) VALUES (1, 'Shared DB Open', 'shared-db-open', 'UTC')");
    await client.execute("INSERT INTO category (id, name, abbr, tourn) VALUES (1, 'BP', 'BP', 1)");
    await client.execute(
      "INSERT INTO event (id, name, abbr, type, level, tourn, category) VALUES (1, 'British Parliamentary', 'BP', 'wudc', 'open', 1, 1)",
    );
    await client.execute("INSERT INTO event_setting (event, tag, value) VALUES (1, 'max_entry', '2')");
    await client.execute("INSERT INTO permission (tourn, person, tag) VALUES (1, 1, 'owner')");
    const owned = await client.execute(
      "SELECT tourn.name, event.type FROM tourn JOIN permission ON permission.tourn = tourn.id JOIN event ON event.tourn = tourn.id WHERE permission.person = 1",
    );
    expect(owned.rows.map((row) => ({ name: row.name, type: row.type }))).toEqual([
      { name: "Shared DB Open", type: "wudc" },
    ]);
    client.close();
  });
});
