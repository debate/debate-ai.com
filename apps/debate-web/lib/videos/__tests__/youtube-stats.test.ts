/**
 * @fileoverview `getYouTubeStats` against a real in-memory SQLite database:
 * the per-channel, per-style, per-year and per-elim-round totals the
 * `/api/youtube-stats` charts read, computed in SQL from the `videos` table.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videos } from "../../database/schema";
import { getYouTubeStats } from "../youtube-stats";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

const ms = (date: string) => Date.parse(`${date}T00:00:00Z`);

describe("getYouTubeStats", () => {
  it("returns empty totals for an empty library", async () => {
    const stats = await getYouTubeStats(await freshDb());
    expect(stats.summary).toEqual({ totalViews: 0, totalVideos: 0, totalChannels: 0, totalDebateStyles: 0 });
    expect(stats.byChannel).toEqual([]);
    expect(stats.byElimRound).toEqual([]);
  });

  it("groups views by channel, style, year and elim round", async () => {
    const db = await freshDb();
    await db.insert(videos).values([
      { videoId: "a", source: "round", title: "NDT Finals: A vs B", channel: "Stream", viewCount: 100, style: 4, publishedMs: ms("2024-03-01") },
      { videoId: "b", source: "round", title: "TOC Double Octafinals", channel: "Stream", viewCount: 50, style: 1, publishedMs: ms("2024-04-01") },
      { videoId: "c", source: "round", title: "Harvard Quarterfinals", channel: "PF Videos", viewCount: 30, style: 2, publishedMs: ms("2023-02-01") },
      { videoId: "d", source: "round", title: "Prelim round 3", channel: "PF Videos", viewCount: 9, style: 2, publishedMs: ms("2023-02-02") },
      { videoId: "e", source: "lecture", title: "Finals prep lecture", channel: "Coach", viewCount: 20, category: "Demo Debates", publishedMs: 0 },
      { videoId: "gone", source: "round", title: "Semifinals", channel: "Stream", viewCount: 999, style: 4, publishedMs: ms("2024-01-01"), availability: "removed" },
    ]);

    const stats = await getYouTubeStats(db);

    expect(stats.summary).toEqual({ totalViews: 209, totalVideos: 5, totalChannels: 3, totalDebateStyles: 4 });
    expect(stats.byChannel).toEqual([
      { channel: "Stream", totalViews: 150, videoCount: 2, avgViewsPerVideo: 75 },
      { channel: "PF Videos", totalViews: 39, videoCount: 2, avgViewsPerVideo: 20 },
      { channel: "Coach", totalViews: 20, videoCount: 1, avgViewsPerVideo: 20 },
    ]);
    expect(stats.byDebateStyle.map((s) => s.debateStyle)).toEqual(["4", "1", "2", "Demo Debates"]);
    expect(stats.byYear.map((y) => [y.year, y.videoCount])).toEqual([["2023", 2], ["2024", 2], ["unknown", 1]]);
    // Lectures never count as elim rounds, and the removed semifinal is excluded.
    expect(stats.byElimRound).toEqual([
      { round: "Finals", totalViews: 100, videoCount: 1, avgViewsPerVideo: 100 },
      { round: "Quarterfinals", totalViews: 30, videoCount: 1, avgViewsPerVideo: 30 },
      { round: "Double Octafinals", totalViews: 50, videoCount: 1, avgViewsPerVideo: 50 },
    ]);
  });
});
