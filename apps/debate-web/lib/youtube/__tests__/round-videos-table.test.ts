/**
 * @fileoverview Pins the upgrade of an older `youtube_round_videos` table
 * (no `category`, `style NOT NULL`) to the schema that also queues lectures.
 * Runs against a real in-memory SQLite database because the fix is DDL.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { resetEnsuredColumns } from "../../database/ensure-columns";
import { youtubeRoundVideos } from "../../database/schema";
import {
  ensureRoundVideosTable,
  isStaleRoundVideosTableError,
  planStyleNullableRebuild,
  resetEnsuredRoundVideosTable,
} from "../round-videos-table";

/** The table as production created it, before lectures joined the queue. */
const LEGACY_DDL = [
  `CREATE TABLE "youtube_round_videos" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "published_at" text NOT NULL,
  "channel" text NOT NULL,
  "views" integer DEFAULT 0 NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "style" integer NOT NULL,
  "tournament" text,
  "round_level" text,
  "aff" text,
  "neg" text,
  "winner" integer,
  "judge_decision" text,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "updated_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE INDEX "idx_youtube_round_videos_style" ON "youtube_round_videos" ("style")`,
  `INSERT INTO "youtube_round_videos" ("id", "title", "published_at", "channel", "style") VALUES ('r1', 'Round', '2024-09-01', 'Chan', 2)`,
];

async function legacyDb() {
  const client = createClient({ url: ":memory:" });
  for (const statement of LEGACY_DDL) await client.execute(statement);
  return { client, db: drizzle(client, { schema }) };
}

describe("ensureRoundVideosTable", () => {
  beforeEach(() => {
    resetEnsuredRoundVideosTable();
    resetEnsuredColumns();
  });

  it("adds category, makes style nullable, and keeps existing rows and indexes", async () => {
    const { client, db } = await legacyDb();
    await ensureRoundVideosTable(db);

    const columns = (await client.execute(`PRAGMA table_info("youtube_round_videos")`)).rows;
    expect(columns.map((column) => column.name)).toContain("category");
    expect(Number(columns.find((column) => column.name === "style")?.notnull)).toBe(0);

    await db.insert(youtubeRoundVideos).values({
      id: "l1",
      title: "Lecture",
      publishedAt: "2024-09-02",
      channel: "Chan",
      style: null,
      category: "Theory",
    });
    const rows = await db.select().from(youtubeRoundVideos);
    expect(rows.map((row) => [row.id, row.style, row.category]).sort()).toEqual([
      ["l1", null, "Theory"],
      ["r1", 2, null],
    ]);

    const indexes = (await client.execute(`PRAGMA index_list("youtube_round_videos")`)).rows.map((row) => row.name);
    expect(indexes).toContain("idx_youtube_round_videos_style");
  });

  it("leaves an up-to-date table alone", () => {
    expect(planStyleNullableRebuild(`CREATE TABLE "youtube_round_videos" ("style" integer)`, [], ["style"])).toBeNull();
  });
});

describe("isStaleRoundVideosTableError", () => {
  it("matches the missing column and the old NOT NULL on style", () => {
    expect(
      isStaleRoundVideosTableError(new Error("D1_ERROR: table youtube_round_videos has no column named category: SQLITE_ERROR")),
    ).toBe(true);
    expect(isStaleRoundVideosTableError(new Error("NOT NULL constraint failed: youtube_round_videos.style"))).toBe(true);
    expect(isStaleRoundVideosTableError(new Error("no such table: videos"))).toBe(false);
  });
});

describe("ensureRoundVideosTable on a fresh database", () => {
  it("does not fail when the table does not exist yet", async () => {
    resetEnsuredRoundVideosTable();
    const client = createClient({ url: ":memory:" });
    await expect(ensureRoundVideosTable(drizzle(client, { schema }))).resolves.toBeUndefined();
  });
});
