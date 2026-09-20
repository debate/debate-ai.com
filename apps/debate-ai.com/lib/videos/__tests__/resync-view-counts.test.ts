/**
 * @fileoverview Exercises `resyncVideoViewCounts` against a real in-memory
 * SQLite database with the YouTube API mocked, so we can assert the end-to-end
 * flow: reading rows, deduplicating ids across tables, writing back changed
 * view counts, classifying availability, and building the result object.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import type { YouTubeVideoStatus, YouTubeStatusReport } from "debate-data-sync/src/youtube/youtube-api";
import * as schema from "../../database/schema";
import { videos, youtubeRoundVideos } from "../../database/schema";
import { resyncVideoViewCounts, type ViewCountResyncResult } from "../resync-view-counts";

const drizzleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

const VIDEOS_TABLE_MIGRATIONS = [
  "0003_dark_zarek.sql",
  "0005_green_redwing.sql",
  "0041_video_stacks.sql",
  "0045_video_documents_relations_issues.sql",
];

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  for (const migration of VIDEOS_TABLE_MIGRATIONS) {
    const contents = readFileSync(path.join(drizzleDir, migration), "utf8");
    for (const statement of contents.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
  return drizzle(client, { schema });
}

// Helpers for inserting test rows
async function insertVideo(
  db: ReturnType<typeof drizzle>,
  id: string,
  views: number,
  publishedMs: number,
  availability = "available",
) {
  await db
    .insert(videos)
    .values({
      videoId: id,
      source: "round",
      publishedAt: new Date(publishedMs).toISOString().split("T")[0],
      publishedMs,
      viewCount: views,
      availability,
    } as any);
}

async function insertQueuedVideo(
  db: ReturnType<typeof drizzle>,
  id: string,
  views: number,
  publishedAt: string,
) {
  await db
    .insert(youtubeRoundVideos)
    .values({
      id,
      title: "Queued",
      publishedAt,
      channel: "Channel",
      views,
      style: 1,
    } as any);
}

function makeStatus(
  videoId: string,
  viewCount: number | null,
  overrides: Partial<YouTubeVideoStatus> = {},
): YouTubeVideoStatus {
  return {
    videoId,
    viewCount,
    privacyStatus: "public",
    uploadStatus: "processed",
    embeddable: true,
    ...overrides,
  };
}

const mockFetchVideoStatuses = vi.fn();
const mockSetYouTubeApiKey = vi.fn();

vi.mock("debate-data-sync/src/youtube/youtube-api", () => ({
  fetchVideoStatuses: (...args: Parameters<typeof mockFetchVideoStatuses>) =>
    mockFetchVideoStatuses(...args),
  setYouTubeApiKey: (...args: Parameters<typeof mockSetYouTubeApiKey>) =>
    mockSetYouTubeApiKey(...args),
}));

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn((key: string) => (key === "YOUTUBE_API_KEY" ? "test-api-key" : undefined)),
}));

describe("resyncVideoViewCounts", () => {
  let mockConsoleLog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  it("throws when no YouTube API key is configured", async () => {
    const { getEnv } = await import("@/lib/env");
    vi.mocked(getEnv).mockReturnValueOnce(undefined);

    await expect(resyncVideoViewCounts({} as never)).rejects.toThrow(
      "YouTube API key not configured",
    );
  });

  it("returns empty result when no videos are stored", async () => {
    const db = await freshDb();
    mockFetchVideoStatuses.mockResolvedValue({ statuses: {}, missing: [] });

    const result = await resyncVideoViewCounts(db);

    expect(mockFetchVideoStatuses).not.toHaveBeenCalled();
    expect(result.videosChecked).toBe(0);
    expect(result.viewCountsFetched).toBe(0);
    expect(result.missing).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.published.rows).toBe(0);
    expect(result.queued.rows).toBe(0);
    expect(result.availability.available).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("writes updated view counts and reports the tally", async () => {
    const db = await freshDb();
    await insertVideo(db, "vid1", 100, Date.parse("2025-01-01"));
    await insertVideo(db, "vid2", 200, Date.parse("2025-06-01"));

    mockFetchVideoStatuses.mockResolvedValue({
      statuses: {
        vid1: makeStatus("vid1", 150),
        vid2: makeStatus("vid2", 200),
      },
      missing: [],
    });

    const result = await resyncVideoViewCounts(db);

    expect(result.videosChecked).toBe(2);
    expect(result.viewCountsFetched).toBe(2);
    expect(result.missing).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.published.rows).toBe(2);
    expect(result.published.updated).toBe(1);
    expect(result.queued.rows).toBe(0);

    const stored = await db.select().from(videos).orderBy(videos.videoId);
    expect(stored[0]?.viewCount).toBe(150);
    expect(stored[1]?.viewCount).toBe(200);
  });

  it("marks missing ids as removed in availability", async () => {
    const db = await freshDb();
    await insertVideo(db, "gone", 500, Date.parse("2025-01-01"));
    await insertVideo(db, "kept", 300, Date.parse("2025-06-01"));

    mockFetchVideoStatuses.mockResolvedValue({
      statuses: { kept: makeStatus("kept", 300) },
      missing: ["gone"],
    });

    const result = await resyncVideoViewCounts(db);

    expect(result.missing).toBe(1);
    expect(result.availability.removed).toBe(1);
    expect(result.availability.available).toBe(1);
    expect(result.availability.changed).toBe(1);

    const gone = (await db.select().from(videos).where(eq(videos.videoId, "gone")))[0];
    expect(gone.availability).toBe("removed");
    expect(gone.missingChecks).toBe(1);
  });

  it("classifies private and not-embeddable videos correctly", async () => {
    const db = await freshDb();
    await insertVideo(db, "priv", 100, Date.parse("2025-01-01"));
    await insertVideo(db, "noembed", 200, Date.parse("2025-01-01"));
    await insertVideo(db, "ok", 300, Date.parse("2025-01-01"));

    mockFetchVideoStatuses.mockResolvedValue({
      statuses: {
        priv: makeStatus("priv", 100, { privacyStatus: "private" }),
        noembed: makeStatus("noembed", 200, { embeddable: false }),
        ok: makeStatus("ok", 300),
      },
      missing: [],
    });

    const result = await resyncVideoViewCounts(db);

    expect(result.availability.private).toBe(1);
    expect(result.availability.notEmbeddable).toBe(1);
    expect(result.availability.available).toBe(1);
  });

  it("resets missingChecks when a previously missing video returns", async () => {
    const db = await freshDb();
    await db
      .insert(videos)
      .values({
        videoId: "returned",
        source: "round",
        publishedAt: "2025-01-01",
        publishedMs: Date.parse("2025-01-01"),
        viewCount: 500,
        availability: "removed",
        missingChecks: 3,
      } as any);

    mockFetchVideoStatuses.mockResolvedValue({
      statuses: { returned: makeStatus("returned", 500) },
      missing: [],
    });

    const result = await resyncVideoViewCounts(db);

    expect(result.availability.available).toBe(1);
    expect(result.availability.changed).toBe(1);
    expect(result.availability.removed).toBe(0);

    const row = (await db.select().from(videos).where(eq(videos.videoId, "returned")))[0];
    expect(row.availability).toBe("available");
    expect(row.missingChecks).toBe(0);
  });

  it("deduplicates ids that appear in both tables", async () => {
    const db = await freshDb();
    await insertVideo(db, "shared", 100, Date.parse("2025-01-01"));
    await insertQueuedVideo(db, "shared", 100, "2025-01-01");
    await insertQueuedVideo(db, "only_queued", 50, "2025-03-01");

    mockFetchVideoStatuses.mockResolvedValue({
      statuses: {
        shared: makeStatus("shared", 200),
        only_queued: makeStatus("only_queued", 75),
      },
      missing: [],
    });

    const result = await resyncVideoViewCounts(db);

    expect(result.videosChecked).toBe(2);
    expect(result.published.rows).toBe(1);
    expect(result.queued.rows).toBe(2);
    expect(mockFetchVideoStatuses).toHaveBeenCalledExactlyOnceWith(["shared", "only_queued"]);
  });

  it("sorts published videos by publishedMs desc and queued by publishedAt desc", async () => {
    const db = await freshDb();
    await insertVideo(db, "old", 100, Date.parse("2025-01-01"));
    await insertVideo(db, "new", 100, Date.parse("2025-06-01"));
    await insertQueuedVideo(db, "q_old", 100, "2024-01-01");
    await insertQueuedVideo(db, "q_new", 100, "2025-12-01");

    const receivedIds: string[] = [];
    mockFetchVideoStatuses.mockImplementation(async (ids: string[]) => {
      receivedIds.push(...ids);
      return { statuses: {}, missing: [] };
    });

    await resyncVideoViewCounts(db);

    // publishedMs DESC: "new" (2025-06-01) before "old" (2025-01-01)
    // publishedAt DESC: "q_new" (2025-12-01) before "q_old" (2024-01-01)
    expect(receivedIds).toEqual(["new", "old", "q_new", "q_old"]);
  });

  it("writes availability batches grouped by state", async () => {
    const db = await freshDb();
    await insertVideo(db, "avail1", 100, Date.parse("2025-01-01"));
    await insertVideo(db, "avail2", 100, Date.parse("2025-01-01"));
    await insertVideo(db, "priv", 100, Date.parse("2025-01-01"));
    await insertVideo(db, "gone", 100, Date.parse("2025-01-01"));

    mockFetchVideoStatuses.mockResolvedValue({
      statuses: {
        avail1: makeStatus("avail1", 100),
        avail2: makeStatus("avail2", 100),
        priv: makeStatus("priv", 100, { privacyStatus: "private" }),
      },
      missing: ["gone"],
    });

    const result = await resyncVideoViewCounts(db);

    expect(result.availability.available).toBe(2);
    expect(result.availability.private).toBe(1);
    expect(result.availability.removed).toBe(1);

    const rows = await db.select().from(videos);
    const byId = new Map(rows.map((r) => [r.videoId, r]));
    expect(byId.get("avail1")?.availability).toBe("available");
    expect(byId.get("avail2")?.availability).toBe("available");
    expect(byId.get("priv")?.availability).toBe("private");
    expect(byId.get("gone")?.availability).toBe("removed");
  });

  it("formats duration in the result", async () => {
    const db = await freshDb();
    await insertVideo(db, "v1", 100, Date.parse("2025-01-01"));

    mockFetchVideoStatuses.mockResolvedValue({
      statuses: { v1: makeStatus("v1", 100) },
      missing: [],
    });

    const result: ViewCountResyncResult = await resyncVideoViewCounts(db);

    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
