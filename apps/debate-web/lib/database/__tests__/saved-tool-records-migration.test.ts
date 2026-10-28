/**
 * @fileoverview Runs `packages/debate-webview/migrations/0004_saved_tool_records_unique.sql`
 * the way `.github/scripts/migrate-d1.ts` does (split by `planMigration`):
 * against the full schema it changes nothing, and against a
 * `saved_tool_records` that is missing its unique key — what makes every
 * `PUT /api/tool-records/<collection>` upsert fail — it drops duplicate keys,
 * adds the index, and leaves the route's upsert working.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { freshSchemaClient } from "./schema-sql";
import { planMigration } from "../migration-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MIGRATION = readFileSync(
  join(REPO_ROOT, "packages/debate-webview/migrations/0004_saved_tool_records_unique.sql"),
  "utf8",
);

async function migrate(client: Client) {
  for (const step of planMigration(MIGRATION)) await client.executeMultiple(`${step.sql};`);
}

/** The upsert `app/api/tool-records/[collection]/route.ts` sends. */
function upsert(client: Client, clientId: string, data: string) {
  return client.execute({
    sql: `INSERT INTO saved_tool_records (user_id, collection, client_id, data)
          VALUES ('u1', 'debateVideoWatchHistory', ?, ?)
          ON CONFLICT (user_id, collection, client_id) DO UPDATE SET data = excluded.data`,
    args: [clientId, data],
  });
}

async function rows(client: Client) {
  const { rows } = await client.execute(
    "SELECT client_id, data FROM saved_tool_records ORDER BY client_id",
  );
  return rows.map((row) => ({ clientId: String(row.client_id), data: String(row.data) }));
}

describe("the saved_tool_records unique-key migration", () => {
  it("is a no-op on the schema as declared, and safe to re-run", async () => {
    const client = await freshSchemaClient();
    await client.execute("INSERT INTO user (id, name, email, created_at, updated_at) VALUES ('u1', 'U', 'u@example.com', 0, 0)");
    await upsert(client, "vid", '{"v":1}');
    await migrate(client);
    await migrate(client);
    await upsert(client, "vid", '{"v":2}');
    expect(await rows(client)).toEqual([{ clientId: "vid", data: '{"v":2}' }]);
    client.close();
  });

  it("repairs a table created without its unique index", async () => {
    const client = createClient({ url: ":memory:" });
    await client.execute(`CREATE TABLE saved_tool_records (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id text NOT NULL,
      collection text NOT NULL,
      client_id text NOT NULL,
      data text NOT NULL,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    )`);
    await expect(upsert(client, "vid", '{"v":1}')).rejects.toThrow(/ON CONFLICT clause does not match/);

    // Duplicates a plain INSERT could have left behind; the newest one wins.
    for (const data of ['{"v":"old"}', '{"v":"new"}']) {
      await client.execute({
        sql: "INSERT INTO saved_tool_records (user_id, collection, client_id, data) VALUES ('u1', 'debateVideoWatchHistory', 'vid', ?)",
        args: [data],
      });
    }

    await migrate(client);
    expect(await rows(client)).toEqual([{ clientId: "vid", data: '{"v":"new"}' }]);

    await upsert(client, "vid", '{"v":3}');
    await upsert(client, "other", '{"v":1}');
    expect(await rows(client)).toEqual([
      { clientId: "other", data: '{"v":1}' },
      { clientId: "vid", data: '{"v":3}' },
    ]);
    client.close();
  });
});
