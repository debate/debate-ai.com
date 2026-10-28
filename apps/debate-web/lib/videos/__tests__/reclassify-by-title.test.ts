/**
 * @fileoverview The Dartmouth RR fix: the SQL migration files every matching
 * round under College, and the bulk reclassify pages through matches, writes
 * the model's round fields without blanking what it couldn't read, and keeps
 * going past a failed model call.
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
import { videos, youtubeRoundVideos, type VideoTableInsert } from "../../database/schema";
import { reclassifyVideosByTitle } from "../reclassify-by-title";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MIGRATION = readFileSync(
  join(REPO_ROOT, "packages/debate-videos-admin/migrations/0003_dartmouth_rr_college.sql"),
  "utf8",
);

async function setup() {
  const client = await freshSchemaClient();
  return { client, db: drizzle(client, { schema }) };
}

function videoRow(id: string, title: string, extra: Partial<VideoTableInsert> = {}): VideoTableInsert {
  return {
    videoId: id,
    source: "round",
    title,
    publishedAt: "2024-09-01",
    publishedMs: Date.parse("2024-09-01"),
    channel: "Channel",
    viewCount: 0,
    description: "",
    style: 1,
    seasonYear: 2025,
    searchText: title.toLowerCase(),
    ...extra,
  };
}

describe("the Dartmouth RR migration", () => {
  it("files matching videos and queued rounds under College and nothing else", async () => {
    const { client, db } = await setup();
    await db.insert(videos).values([
      videoRow("aaaaaaaaaaa", "Dartmouth RR 2024 Round 3 Michigan vs Harvard"),
      videoRow("bbbbbbbbbbb", "Glenbrooks Finals"),
    ]);
    await db.insert(youtubeRoundVideos).values({
      id: "ccccccccccc",
      title: "dartmouth rr Finals",
      publishedAt: "2024-09-01",
      channel: "Channel",
      style: 1,
    });

    for (const step of planMigration(MIGRATION)) await client.executeMultiple(`${step.sql};`);

    const [dartmouth] = await db.select().from(videos).where(eq(videos.videoId, "aaaaaaaaaaa"));
    const [other] = await db.select().from(videos).where(eq(videos.videoId, "bbbbbbbbbbb"));
    const [queued] = await db.select().from(youtubeRoundVideos);
    expect(dartmouth.style).toBe(4);
    expect(dartmouth.adminEdited).toBe(true);
    expect(other.style).toBe(1);
    expect(queued.style).toBe(4);
  });
});

describe("reclassifyVideosByTitle", () => {
  it("sets the style, applies the model's round fields, and pages to the end", async () => {
    const { db } = await setup();
    await db.insert(videos).values([
      videoRow("aaaaaaaaaaa", "Dartmouth RR R1 Michigan KS vs Harvard HS", { tournament: "Kept" }),
      videoRow("bbbbbbbbbbb", "Dartmouth RR R2 Emory vs Kansas"),
      videoRow("ddddddddddd", "Glenbrooks Finals"),
    ]);
    const ask = async (content: string) => {
      if (content.includes("Emory")) throw new Error("AI API returned 500.");
      return { tournament: null, roundLevel: "R1", affTeam: "Michigan KS", negTeam: "Harvard HS", affWin: null };
    };

    const first = await reclassifyVideosByTitle(db, { match: "Dartmouth RR", style: 4, parseRoundInfo: true, limit: 1 }, ask);
    expect(first.updated.map((v) => v.videoId)).toEqual(["aaaaaaaaaaa"]);
    expect(first.nextCursor).toBe("aaaaaaaaaaa");

    const second = await reclassifyVideosByTitle(
      db,
      { match: "Dartmouth RR", style: 4, parseRoundInfo: true, after: first.nextCursor, limit: 1 },
      ask,
    );
    expect(second.updated.map((v) => v.videoId)).toEqual(["bbbbbbbbbbb"]);
    expect(second.failed).toEqual([{ videoId: "bbbbbbbbbbb", error: "AI API returned 500." }]);
    expect(second.nextCursor).toBeNull();

    const rows = Object.fromEntries((await db.select().from(videos)).map((r) => [r.videoId, r]));
    expect(rows.aaaaaaaaaaa).toMatchObject({
      style: 4,
      tournament: "Kept",
      roundLevel: "R1",
      affTeam: "Michigan KS",
      negTeam: "Harvard HS",
    });
    expect(rows.bbbbbbbbbbb.style).toBe(4);
    expect(rows.ddddddddddd.style).toBe(1);
  });
});
