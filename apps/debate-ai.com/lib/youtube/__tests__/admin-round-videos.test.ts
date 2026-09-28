/**
 * @fileoverview Exercises the admin "Round videos" queue query against a real
 * in-memory SQLite database, the same approach `admin-library.test.ts` uses:
 * the LIKE-escaping behavior this pins can't be seen through a mocked drizzle
 * handle.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { videos, youtubeRoundVideos, type VideoTableInsert, type YoutubeRoundVideo } from "../../database/schema";
import { listPendingRoundVideos } from "../admin-round-videos";

const drizzleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

const MIGRATIONS = [
  "0003_dark_zarek.sql", // youtube_round_videos
  "0005_green_redwing.sql", // videos
  "0041_video_stacks.sql", // videos.stack_key / stack_position
  "0045_video_documents_relations_issues.sql", // videos.availability
  "0047_video_admin_edited.sql", // videos.admin_edited
];

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  for (const migration of MIGRATIONS) {
    const contents = readFileSync(path.join(drizzleDir, migration), "utf8");
    for (const statement of contents.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
  return drizzle(client, { schema });
}

function roundVideo(id: string, extra: Partial<YoutubeRoundVideo> = {}): typeof youtubeRoundVideos.$inferInsert {
  return {
    id,
    title: `Title ${id}`,
    publishedAt: "2024-09-01",
    channel: "Channel One",
    style: 1,
    ...extra,
  };
}

function publishedVideo(id: string, extra: Partial<VideoTableInsert> = {}): VideoTableInsert {
  return {
    videoId: id,
    source: "round",
    title: `Title ${id}`,
    publishedAt: "2024-09-01",
    publishedMs: Date.parse("2024-09-01"),
    channel: "Channel One",
    viewCount: 100,
    description: "",
    style: 1,
    seasonYear: 2025,
    searchText: `title ${id} channel one`,
    ...extra,
  };
}

describe("listPendingRoundVideos", () => {
  it("treats a literal % or _ in the search text as itself, not a SQL wildcard", async () => {
    const db = await freshDb();
    await db.insert(youtubeRoundVideos).values([
      roundVideo("a", { title: "Win 50% of the time" }),
      roundVideo("b", { title: "Win 50 of the time" }),
      roundVideo("c", { title: "Case_Neg debrief" }),
      roundVideo("d", { title: "CaseXNeg debrief" }),
    ]);

    const byPercent = await listPendingRoundVideos(db, { q: "50%" });
    expect(byPercent.videos.map((v) => v.id)).toEqual(["a"]);

    const byUnderscore = await listPendingRoundVideos(db, { q: "Case_Neg" });
    expect(byUnderscore.videos.map((v) => v.id)).toEqual(["c"]);
  });

  it("searches title and channel", async () => {
    const db = await freshDb();
    await db.insert(youtubeRoundVideos).values([
      roundVideo("a", { title: "Harvard octas" }),
      roundVideo("b", { title: "Unrelated", channel: "Harvard Debate" }),
      roundVideo("c", { title: "Berkeley finals" }),
    ]);

    const byTitle = await listPendingRoundVideos(db, { q: "Harvard" });
    expect(byTitle.videos.map((v) => v.id).sort()).toEqual(["a", "b"]);
  });

  it("drops a round that's already published to the videos table", async () => {
    const db = await freshDb();
    await db.insert(youtubeRoundVideos).values([roundVideo("a"), roundVideo("b")]);
    await db.insert(videos).values([publishedVideo("a")]);

    const page = await listPendingRoundVideos(db, {});

    expect(page.videos.map((v) => v.id)).toEqual(["b"]);
  });
});
