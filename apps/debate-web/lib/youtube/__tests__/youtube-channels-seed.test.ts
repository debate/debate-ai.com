/**
 * @fileoverview Covers `packages/debate-data-sync/migrations/`, the migrations
 * that keep the tracked channel list in the `youtube_channels` SQL table:
 *
 * 1. Its `CREATE` statements match what `schema.ts` declares for the table.
 * 2. Together they seed exactly the channels in `channel-config.ts`, so the two lists
 *    cannot drift apart.
 * 3. Re-applying it leaves an admin's edits alone — a paused channel stays
 *    paused, a resolved channel id is kept, and no duplicate rows appear.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { channels } from "@debate/data-sync/src/youtube/channel-config";
import { freshSchemaClient, schemaStatements } from "@/lib/database/__tests__/schema-sql";
import { makeIdempotent, splitStatements } from "@/lib/database/migration-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MIGRATIONS_DIR = join(REPO_ROOT, "packages/debate-data-sync/migrations");
// Every file, in the order `.github/scripts/migrate-d1.ts` applies them.
const SEED = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"))
  .join("\n--> statement-breakpoint\n");
const statements = splitStatements(SEED);

async function seededNames(client: Client): Promise<string[]> {
  const { rows } = await client.execute("SELECT name FROM youtube_channels ORDER BY id");
  return rows.map((row) => String(row.name));
}

describe("the youtube_channels seed shipped in debate-data-sync", () => {
  let client: Client;

  beforeEach(async () => {
    client = await freshSchemaClient();
  });

  afterEach(() => client.close());

  it("creates exactly what schema.ts declares for youtube_channels", async () => {
    const fromSchema = (await schemaStatements())
      .filter((statement) => statement.includes("`youtube_channels`"))
      .map((statement) => makeIdempotent(statement).trim().replace(/;$/, ""));
    expect(statements.filter((statement) => /^CREATE /i.test(statement))).toEqual(fromSchema);
  });

  it("seeds every channel in channel-config.ts, and nothing else", async () => {
    await client.executeMultiple(SEED);
    expect((await seededNames(client)).sort()).toEqual([...channels].sort());
  });

  it("lists each channel once, ignoring case", () => {
    const lowered = channels.map((name) => name.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });

  it("leaves admin edits alone when re-applied", async () => {
    await client.execute(
      "INSERT INTO youtube_channels (name, channel_id, enabled, added_by) VALUES ('VictoryBriefs', 'UC123', 0, 'admin@example.test')",
    );
    await client.executeMultiple(SEED);
    await client.executeMultiple(SEED);

    const { rows } = await client.execute("SELECT channel_id, enabled, added_by FROM youtube_channels WHERE name = 'VictoryBriefs'");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ channel_id: "UC123", enabled: 0, added_by: "admin@example.test" });
    expect(await seededNames(client)).toHaveLength(channels.length);
  });
});
