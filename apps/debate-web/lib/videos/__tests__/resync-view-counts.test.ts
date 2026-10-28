/**
 * @fileoverview Exercises `resyncVideoViewCounts` against a real in-memory
 * SQLite database with the YouTube API mocked, so we can assert the end-to-end
 * flow: reading rows, deduplicating ids across tables, writing back changed
 * view counts, classifying availability, and building the result object.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import type { YouTubeVideoStatus, YouTubeStatusReport } from "@debate-ai/videos-admin/src/sync/youtube/youtube-api";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videos, youtubeRoundVideos, youtubeVideoExclusions } from "../../database/schema";
import {
  countUnavailableVideos,
  deleteUnavailableVideos,
  parseUnavailableStates,
  resyncVideoViewCounts,
  type ViewCountResyncResult,
} from "../resync-view-counts";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
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

vi.mock("@debate-ai/videos-admin/src/sync/youtube/youtube-api", () => ({
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

describe("removing unavailable videos", () => {
  /** Inserts a published row as a resync would have left it. */
  async function flagged(db: ReturnType<typeof drizzle>, id: string, availability: string, checked = true) {
    await insertVideo(db, id, 10, 1_700_000_000_000, availability);
    if (checked) {
      await db
        .update(videos)
        .set({ availabilityCheckedAt: new Date(), missingChecks: 1 })
        .where(eq(videos.videoId, id));
    }
  }

  it("counts published rows per takedown state", async () => {
    const db = await freshDb();
    await flagged(db, "gone1", "removed");
    await flagged(db, "gone2", "removed");
    await flagged(db, "priv1", "private");
    await flagged(db, "fine1", "available");

    expect(await countUnavailableVideos(db)).toEqual({ removed: 2, private: 1, not_embeddable: 0 });
  });

  it("removes only the chosen states, drops the queue copy, and excludes them from resync", async () => {
    const db = await freshDb();
    await flagged(db, "gone1", "removed");
    await flagged(db, "priv1", "private");
    await flagged(db, "noembed1", "not_embeddable");
    await flagged(db, "fine1", "available");
    await insertQueuedVideo(db, "gone1", 10, "2024-01-01");

    const removed = await deleteUnavailableVideos(db, ["removed", "not_embeddable"], "admin@example.com");

    expect(removed.sort()).toEqual(["gone1", "noembed1"]);
    const left = (await db.select({ id: videos.videoId }).from(videos)).map((row) => row.id).sort();
    expect(left).toEqual(["fine1", "priv1"]);
    expect(await db.select().from(youtubeRoundVideos)).toHaveLength(0);
    const exclusions = await db.select().from(youtubeVideoExclusions);
    expect(exclusions.map((row) => row.videoId).sort()).toEqual(["gone1", "noembed1"]);
    expect(exclusions.every((row) => row.deletedBy === "admin@example.com")).toBe(true);
  });

  it("leaves rows no resync has checked", async () => {
    const db = await freshDb();
    await flagged(db, "unchecked", "removed", false);

    expect(await deleteUnavailableVideos(db, ["removed"], null)).toEqual([]);
    expect(await db.select().from(videos)).toHaveLength(1);
  });

  it("removes more rows than one batch carries, and refreshes an existing exclusion", async () => {
    const db = await freshDb();
    const ids = Array.from({ length: 45 }, (_, i) => `gone${String(i).padStart(2, "0")}`);
    for (const id of ids) await flagged(db, id, "removed");
    await db.insert(youtubeVideoExclusions).values({ videoId: "gone00", deletedBy: "old@example.com" });

    expect(await deleteUnavailableVideos(db, ["removed"], "admin@example.com")).toHaveLength(45);
    expect(await db.select().from(videos)).toHaveLength(0);
    const [old] = await db
      .select()
      .from(youtubeVideoExclusions)
      .where(eq(youtubeVideoExclusions.videoId, "gone00"));
    expect(old.deletedBy).toBe("admin@example.com");
  });

  it("removes nothing when no state is chosen", async () => {
    const db = await freshDb();
    await flagged(db, "gone1", "removed");
    expect(await deleteUnavailableVideos(db, [], null)).toEqual([]);
    expect(await db.select().from(videos)).toHaveLength(1);
  });

  it("keeps only known states from untrusted input", () => {
    expect(parseUnavailableStates(["private", "available", "removed", 3])).toEqual(["removed", "private"]);
    expect(parseUnavailableStates("removed")).toEqual([]);
  });
});
