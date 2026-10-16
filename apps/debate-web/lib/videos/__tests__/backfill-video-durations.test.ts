/**
 * @fileoverview `backfillVideoDurations` against a real in-memory SQLite
 * database with the YouTube API mocked: ids are deduplicated across the
 * published and queued tables, the cursor walk terminates even when YouTube
 * skips ids, and a default run only fetches what has no duration yet.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videoDurations, videos, youtubeRoundVideos } from "../../database/schema";
import {
  backfillVideoDurations,
  ensureVideoDurationsTable,
  getVideoDurationStatus,
  getVideoDurations,
} from "../backfill-video-durations";

const mockFetchVideoDurations = vi.fn();

vi.mock("@debate/data-sync/src/youtube/youtube-api", () => ({
  fetchVideoDurations: (...args: unknown[]) => mockFetchVideoDurations(...args),
  setYouTubeApiKey: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn((key: string) => (key === "YOUTUBE_API_KEY" ? "test-api-key" : undefined)),
}));

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

async function insertVideo(db: ReturnType<typeof drizzle>, id: string) {
  await db.insert(videos).values({ videoId: id, source: "round" } as any);
}

async function insertQueued(db: ReturnType<typeof drizzle>, id: string) {
  await db.insert(youtubeRoundVideos).values({
    id,
    title: "Queued",
    publishedAt: "2025-01-01",
    channel: "Channel",
    style: 1,
  } as any);
}

/** Answers every id with `seconds`, except those listed as gone. */
function answer(seconds: number, gone: string[] = []) {
  mockFetchVideoDurations.mockImplementation(async (ids: string[]) => ({
    durations: Object.fromEntries(ids.filter((id) => !gone.includes(id)).map((id) => [id, seconds])),
    missing: ids.filter((id) => gone.includes(id)),
  }));
}

describe("backfillVideoDurations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when no YouTube API key is configured", async () => {
    const { getEnv } = await import("@/lib/env");
    vi.mocked(getEnv).mockReturnValueOnce(undefined);
    await expect(backfillVideoDurations({} as never)).rejects.toThrow(
      "YouTube API key not configured",
    );
  });

  it("creates the table on a database that predates it", async () => {
    const db = await freshDb();
    await db.run("DROP TABLE video_durations" as any);
    await ensureVideoDurationsTable(db);
    await ensureVideoDurationsTable(db);
    expect((await getVideoDurationStatus(db)).videos).toBe(0);
  });

  it("fetches each id once across both tables and totals the library", async () => {
    const db = await freshDb();
    await insertVideo(db, "lecture");
    await insertVideo(db, "round");
    await insertQueued(db, "round");
    await insertQueued(db, "queued");
    answer(600);

    const result = await backfillVideoDurations(db);

    expect(mockFetchVideoDurations).toHaveBeenCalledTimes(1);
    expect(mockFetchVideoDurations.mock.calls[0][0]).toEqual(["lecture", "queued", "round"]);
    expect(result.stored).toBe(3);
    expect(result.nextCursor).toBeNull();
    expect(result.status).toEqual({
      videos: 3,
      withDuration: 3,
      withoutDuration: 0,
      publishedSeconds: 1200,
      queuedSeconds: 1200,
      totalSeconds: 1800,
    });
  });

  it("pages with a cursor and finishes even when YouTube skips ids", async () => {
    const db = await freshDb();
    for (const id of ["a", "b", "c", "d", "e"]) await insertVideo(db, id);
    answer(60, ["a", "b"]);

    const first = await backfillVideoDurations(db, { limit: 2 });
    expect(first.checked).toBe(2);
    expect(first.stored).toBe(0);
    expect(first.missing).toBe(2);
    expect(first.nextCursor).toBe("b");

    const second = await backfillVideoDurations(db, { after: first.nextCursor, limit: 2 });
    expect(mockFetchVideoDurations.mock.calls[1][0]).toEqual(["c", "d"]);
    const third = await backfillVideoDurations(db, { after: second.nextCursor, limit: 2 });
    expect(third.checked).toBe(1);
    expect(third.nextCursor).toBeNull();
    expect(third.status.withDuration).toBe(3);
    expect(third.status.withoutDuration).toBe(2);
  });

  it("skips ids that already have a duration unless asked to refresh", async () => {
    const db = await freshDb();
    await insertVideo(db, "a");
    await insertVideo(db, "b");
    await db.insert(videoDurations).values({ videoId: "a", durationSeconds: 10 });
    answer(99);

    await backfillVideoDurations(db);
    expect(mockFetchVideoDurations.mock.calls[0][0]).toEqual(["b"]);

    const refreshed = await backfillVideoDurations(db, { refresh: true });
    expect(mockFetchVideoDurations.mock.calls[1][0]).toEqual(["a", "b"]);
    expect(refreshed.status.totalSeconds).toBe(198);
  });
});

describe("getVideoDurations", () => {
  it("returns stored lengths for the asked ids and omits the rest", async () => {
    const db = await freshDb();
    await ensureVideoDurationsTable(db);
    await db.insert(videoDurations).values([
      { videoId: "a", durationSeconds: 3900 },
      { videoId: "b", durationSeconds: 120 },
    ] as any);

    expect(await getVideoDurations(db, ["a", "c", "a"])).toEqual({ a: 3900 });
    expect(await getVideoDurations(db, [])).toEqual({});
  });

  it("reads a database without the table as having no durations", async () => {
    const client = createClient({ url: ":memory:" });
    const db = drizzle(client, { schema });
    expect(await getVideoDurations(db, ["a"])).toEqual({});
  });
});
