/**
 * @fileoverview Exercises `listAdminChannels` against a real in-memory SQLite
 * database: each channel's video count and newest video come from one grouped
 * query over the library and the round queue, matched through the channel's
 * display title (or its name until a resync fills the title in), and the list
 * comes back most videos first.
 */
import { describe, expect, it } from "vitest";
import { freshSchemaDb } from "../../database/__tests__/schema-sql";
import { videos, youtubeChannels, youtubeRoundVideos } from "../../database/schema";
import { channelKey, listAdminChannels } from "../admin-channels";

describe("channelKey", () => {
  it("ignores case, a leading @ and punctuation", () => {
    expect(channelKey("@TexasDebate")).toBe(channelKey("Texas Debate"));
    expect(channelKey(null)).toBe("");
  });
});

describe("listAdminChannels", () => {
  it("counts library and queue videos per channel, newest video included, most videos first", async () => {
    const db = await freshSchemaDb();
    await db.delete(youtubeChannels);
    await db.insert(youtubeChannels).values([
      { name: "kansasdebate-wd4vf", title: "Kansas Debate" },
      { name: "TexasDebate" },
      { name: "EmptyChannel" },
    ]);
    await db.insert(videos).values([
      { videoId: "k1", source: "round", title: "Kansas old", publishedAt: "2024-01-01", channel: "Kansas Debate" },
      { videoId: "t1", source: "round", title: "Texas only", publishedAt: "2025-03-01", channel: "Texas Debate" },
    ]);
    await db.insert(youtubeRoundVideos).values([
      { id: "k2", title: "Kansas newest", publishedAt: "2026-02-02", channel: "Kansas Debate", style: 1 },
      { id: "k3", title: "Kansas middle", publishedAt: "2025-05-05", channel: "Kansas Debate", style: 1 },
    ]);

    const { channels, nextCursor } = await listAdminChannels(db);

    expect(nextCursor).toBeNull();
    expect(channels.map((c) => [c.name, c.videoCount])).toEqual([
      ["kansasdebate-wd4vf", 3],
      ["TexasDebate", 1],
      ["EmptyChannel", 0],
    ]);
    expect(channels[0].latestVideo).toEqual({ videoId: "k2", title: "Kansas newest", publishedAt: "2026-02-02" });
    expect(channels[1].latestVideo?.videoId).toBe("t1");
    expect(channels[2].latestVideo).toBeNull();
  });
});
