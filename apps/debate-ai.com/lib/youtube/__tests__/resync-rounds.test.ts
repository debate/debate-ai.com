/**
 * @fileoverview Exercises `resyncYouTubeRounds` against a real in-memory SQLite
 * database with the YouTube API surface mocked out. Three behaviors are pinned:
 *
 * 1. The optional `publishedAfterDate` argument is forwarded to
 *    `getVideosForChannel` as the cutoff; when absent the module-level default
 *    (`channel-config.ts`) is used instead.
 * 2. On conflict (a video already in the queue from a prior scan), the upsert
 *    only refreshes `views` and `updatedAt` — never the parsed columns. A
 *    re-scan that re-walks the channel's full history therefore cannot
 *    silently overwrite existing queue data.
 * 3. The existing cross-channel + exclusion dedup still fires: a video ID that
 *    appears twice across channels is upserted once, and a video on the
 *    `youtube_video_exclusions` list never lands in the queue at all.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { publishedAfter } from "debate-data-sync/src/youtube/channel-config";
import {
  getChannelId,
  getVideosForChannel,
  fetchFullDescriptions,
} from "debate-data-sync/src/youtube/youtube-api";
import { getDBFromContext } from "../../database/context";
import * as schema from "../../database/schema";
import {
  youtubeChannels,
  youtubeRoundVideos,
  youtubeSyncRuns,
  youtubeVideoExclusions,
} from "../../database/schema";
import { resyncYouTubeRounds } from "../resync-rounds";

vi.mock("debate-data-sync/src/youtube/youtube-api", () => ({
  getChannelId: vi.fn(),
  getVideosForChannel: vi.fn(),
  fetchFullDescriptions: vi.fn(),
  setYouTubeApiKey: vi.fn(),
}));

vi.mock("../../database/context", () => ({
  getDBFromContext: vi.fn(),
  getCloudflareContext: vi.fn(),
  setCloudflareContext: vi.fn(),
  runWithContext: vi.fn(),
}));

const MIGRATIONS = [
  "0003_dark_zarek.sql", // youtube_round_videos + youtube_sync_runs
  "0026_admin_youtube_management.sql", // youtube_video_exclusions
  "0035_youtube_channels.sql", // youtube_channels
];

const drizzleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

async function freshClient() {
  const client = createClient({ url: ":memory:" });
  for (const migration of MIGRATIONS) {
    const contents = readFileSync(path.join(drizzleDir, migration), "utf8");
    for (const statement of contents.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
  return client;
}

async function freshDb() {
  return drizzle(await freshClient(), { schema });
}

/** A video tuple matching the shape `getVideosForChannel` returns: [id, title, date, channel, views, desc]. */
const ROUND_TITLE = "2024 TOC Policy Finals -- Team A vs Team B";
const ROUND_DESC = "Affirmative win 2-1 for the affirmative team.";

function videoEntry(
  id: string,
  title = ROUND_TITLE,
  date = "2024-09-01",
  channel = "ChannelAlpha",
  views = 100,
  desc = ROUND_DESC,
) {
  return [id, title, date, channel, views, desc];
}

const CHANNEL_IDS = { ChannelAlpha: "UC_alpha", ChannelBeta: "UC_beta" };

describe("resyncYouTubeRounds", () => {
  let db: ReturnType<typeof freshDb> extends Promise<infer T> ? T : never;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.YOUTUBE_API_KEY = "test-key";

    db = await freshDb();
    vi.mocked(getDBFromContext).mockResolvedValue(db as any);

    // Replace seeded channels with test channels that already have a
    // channel_id, so the function's resolve-and-write-back path is a no-op
    // and we avoid the unique-index on channel_id.
    await db.delete(youtubeChannels);
    await db.insert(youtubeChannels).values([
      { name: "ChannelAlpha", enabled: true, channelId: "UC_alpha" },
      { name: "ChannelBeta", enabled: true, channelId: "UC_beta" },
    ]);

    // Default: return the pre-set channel id for each channel name so the
    // function skips the resolve-and-update step. Individual tests can
    // override getChannelId and getVideosForChannel as needed.
    vi.mocked(getChannelId).mockImplementation(async (name: string) =>
      CHANNEL_IDS[name as keyof typeof CHANNEL_IDS] ?? null,
    );
    vi.mocked(getVideosForChannel).mockResolvedValue([]);
    vi.mocked(fetchFullDescriptions).mockResolvedValue({});
  });

  describe("cutoff date parameter", () => {
    it("forwards an explicit publishedAfterDate to getVideosForChannel", async () => {
      await resyncYouTubeRounds("admin@test.com", "2024-01-15");

      expect(getVideosForChannel).toHaveBeenCalledWith("UC_alpha", "ChannelAlpha", "2024-01-15");
      expect(getVideosForChannel).toHaveBeenCalledWith("UC_beta", "ChannelBeta", "2024-01-15");
    });

    it("uses the module-level default cutoff when no date is given", async () => {
      await resyncYouTubeRounds("admin@test.com");

      expect(getVideosForChannel).toHaveBeenCalledWith("UC_alpha", "ChannelAlpha", publishedAfter);
    });
  });

  describe("upsert does not override existing data", () => {
    it("preserves parsed fields when re-scanning an already-stored video", async () => {
      // Seed an existing queue entry with manually-corrected parsed fields.
      await db.insert(youtubeRoundVideos).values({
        id: "vid1",
        title: "Old Title",
        publishedAt: "2024-09-01",
        channel: "ChannelAlpha",
        views: 50,
        description: "Old description",
        style: 2,
        tournament: "Preserved Tournament",
        roundLevel: "Semifinals",
        aff: "Preserved Aff",
        neg: "Preserved Neg",
        winner: false,
        judgeDecision: "Preserved decision",
      });

      // The re-scan returns the same video ID with different data — if the
      // upsert overwrote everything, the parsed fields below would change.
      vi.mocked(getVideosForChannel).mockResolvedValue([
        videoEntry("vid1", "New Title", "2024-09-01", "ChannelAlpha", 250, "New description"),
      ]);

      const result = await resyncYouTubeRounds("admin@test.com");

      expect(result.success).toBe(true);
      const [row] = await db
        .select()
        .from(youtubeRoundVideos)
        .where(eq(youtubeRoundVideos.id, "vid1"));

      // Parsed fields preserved — the core guard against silent overrides.
      expect(row.title).toBe("Old Title");
      expect(row.description).toBe("Old description");
      expect(row.style).toBe(2);
      expect(row.tournament).toBe("Preserved Tournament");
      expect(row.roundLevel).toBe("Semifinals");
      expect(row.aff).toBe("Preserved Aff");
      expect(row.neg).toBe("Preserved Neg");
      expect(row.winner).toBe(false);
      expect(row.judgeDecision).toBe("Preserved decision");

      // views is the only field refreshed on conflict.
      expect(row.views).toBe(250);
    });

    it("does not override parsed fields when a video appears across multiple channels", async () => {
      await db.insert(youtubeRoundVideos).values({
        id: "shared1",
        title: "Original Title",
        publishedAt: "2024-09-01",
        channel: "ChannelAlpha",
        views: 50,
        description: "Original desc",
        style: 1,
        tournament: "Original Tournament",
        roundLevel: null,
        aff: "Team A",
        neg: "Team B",
        winner: null,
        judgeDecision: null,
      });

      vi.mocked(getVideosForChannel).mockImplementation(async (channelId: string) => [
        videoEntry("shared1", "Re-parsed Title", "2024-09-01", channelId, 999, "Re-parsed desc"),
      ]);

      await resyncYouTubeRounds("admin@test.com");

      const rows = await db
        .select()
        .from(youtubeRoundVideos)
        .where(eq(youtubeRoundVideos.id, "shared1"));
      expect(rows).toHaveLength(1);

      const [row] = rows;
      expect(row.title).toBe("Original Title");
      expect(row.tournament).toBe("Original Tournament");
      expect(row.aff).toBe("Team A");
      expect(row.views).toBe(999);
    });
  });

  describe("cross-channel dedup", () => {
    it("upserts a video that appears in two channels' results only once", async () => {
      vi.mocked(getVideosForChannel).mockImplementation(async (channelId: string) => [
        videoEntry("dup1", ROUND_TITLE, "2024-09-01", channelId, 100, ROUND_DESC),
      ]);

      await resyncYouTubeRounds("admin@test.com");

      const rows = await db
        .select()
        .from(youtubeRoundVideos)
        .where(eq(youtubeRoundVideos.id, "dup1"));
      expect(rows).toHaveLength(1);
    });
  });

  describe("exclusion list", () => {
    it("skips videos that are on the youtube_video_exclusions table", async () => {
      await db.insert(youtubeVideoExclusions).values({ videoId: "excluded1" });

      vi.mocked(getVideosForChannel).mockResolvedValue([
        videoEntry("excluded1"),
        videoEntry("kept1"),
      ]);

      await resyncYouTubeRounds("admin@test.com");

      const excluded = await db
        .select()
        .from(youtubeRoundVideos)
        .where(eq(youtubeRoundVideos.id, "excluded1"));
      expect(excluded).toHaveLength(0);

      const kept = await db
        .select()
        .from(youtubeRoundVideos)
        .where(eq(youtubeRoundVideos.id, "kept1"));
      expect(kept).toHaveLength(1);
    });
  });

  describe("run tracking", () => {
    it("records a success run with channelsSynced and videosUpserted", async () => {
      vi.mocked(getVideosForChannel).mockResolvedValue([videoEntry("vid1")]);

      const result = await resyncYouTubeRounds("admin@test.com");

      expect(result).toEqual({
        success: true,
        runId: expect.any(Number),
        channelsSynced: 2,
        videosFetched: 1,
        videosUpserted: 1,
      });

      const [run] = await db
        .select()
        .from(youtubeSyncRuns)
        .where(eq(youtubeSyncRuns.id, result.runId));
      expect(run.status).toBe("success");
      expect(run.channelsSynced).toBe(2);
      expect(run.videosFetched).toBe(1);
      expect(run.videosUpserted).toBe(1);
    });
  });
});
