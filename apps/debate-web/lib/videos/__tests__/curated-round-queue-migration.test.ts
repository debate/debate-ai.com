/**
 * @fileoverview Runs `packages/debate-videos-admin/migrations/0002_curated_round_queue.sql`
 * the way `.github/scripts/migrate-d1.ts` does (split by `planMigration`)
 * against the full schema: every curated round lands in the admin queue,
 * pending approval, while a round already in the library or removed by an
 * admin is left out and the library itself is never touched.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { freshSchemaClient } from "../../database/__tests__/schema-sql";
import { planMigration } from "../../database/migration-sql";
import { videos, youtubeRoundVideos, youtubeVideoExclusions } from "../../database/schema";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MIGRATION = readFileSync(
  join(REPO_ROOT, "packages/debate-videos-admin/migrations/0002_curated_round_queue.sql"),
  "utf8",
);
const ROUNDS = 506;

async function setup() {
  const client = await freshSchemaClient();
  return { client, db: drizzle(client, { schema }) };
}

async function migrate(client: Awaited<ReturnType<typeof setup>>["client"]) {
  for (const step of planMigration(MIGRATION)) await client.executeMultiple(`${step.sql};`);
}

describe("the curated round queue migration", () => {
  it("queues every curated round for admin approval", async () => {
    const { client, db } = await setup();
    await migrate(client);

    const queued = await db.select().from(youtubeRoundVideos);
    expect(queued).toHaveLength(ROUNDS);
    expect(queued.every((row) => row.description.startsWith("Topic: ") || row.description.startsWith("Arguments: "))).toBe(true);
    expect(await db.select().from(videos)).toHaveLength(0);
  });

  it("leaves published and admin-removed rounds alone, and can be re-run", async () => {
    const { client, db } = await setup();
    await db.insert(videos).values({
      videoId: "YgWRowupoWw",
      source: "round",
      title: "Already published",
      publishedAt: "2025-04-01",
      channel: "Outreach Debate",
      style: 2,
    });
    await db.insert(youtubeVideoExclusions).values({ videoId: "OxnpS-aEyhE" });

    await migrate(client);
    await migrate(client);

    expect(await db.select().from(youtubeRoundVideos)).toHaveLength(ROUNDS - 2);
    const [published] = await db.select().from(videos).where(eq(videos.videoId, "YgWRowupoWw"));
    expect(published?.title).toBe("Already published");
  });
});
