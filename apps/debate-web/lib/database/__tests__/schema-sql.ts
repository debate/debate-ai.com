/**
 * @fileoverview Builds a test database straight from `schema.ts`.
 *
 * `drizzle/` (the migration SQL) is no longer tracked in git, so tests can't
 * replay migrations to create tables. drizzle-kit instead diffs the schema
 * against an empty database and returns the `CREATE TABLE` / `CREATE INDEX`
 * statements, which these helpers run against a fresh libSQL database.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../schema";

let statements: Promise<string[]> | undefined;

/** Every statement needed to create the schema's tables, in dependency order. Built once per test file. */
export function schemaStatements(): Promise<string[]> {
  statements ??= (async () => {
    const { generateSQLiteDrizzleJson, generateSQLiteMigration } = await import("drizzle-kit/api");
    const empty = await generateSQLiteDrizzleJson({});
    const current = await generateSQLiteDrizzleJson(schema as Record<string, unknown>);
    return generateSQLiteMigration(empty, current);
  })();
  return statements;
}

/** Creates every table in `schema.ts` on `client`. */
export async function applySchema(client: Client): Promise<void> {
  for (const statement of await schemaStatements()) await client.execute(statement);
}

/** A fresh libSQL database (in memory unless `url` says otherwise) holding the whole schema. */
export async function freshSchemaClient(url = ":memory:"): Promise<Client> {
  const client = createClient({ url });
  await applySchema(client);
  return client;
}

/** {@link freshSchemaClient}, wrapped in drizzle with the app schema. */
export async function freshSchemaDb(url = ":memory:") {
  return drizzle(await freshSchemaClient(url), { schema });
}
