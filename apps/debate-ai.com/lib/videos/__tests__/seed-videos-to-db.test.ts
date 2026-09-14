/**
 * @fileoverview Exercises `seedVideosIntoDb` against a real in-memory SQLite
 * database (the `videos` table migration, `drizzle/0005_green_redwing.sql`,
 * plus every later migration that alters `videos` — currently just
 * `drizzle/0041_video_stacks.sql`'s `stack_key`/`stack_position` columns),
 * the same approach `lib/admin/__tests__/debate-card-import.test.ts` uses —
 * atomic-batch behavior isn't provable with a mock of `db.run`/`db.batch`,
 * since a mock can't reproduce SQLite actually rolling back a failed
 * transaction.
 *
 * See `video-library.mdx`'s (now-closed) Known gap: a seed run used to await
 * each generated statement one at a time, so an interrupted run left whatever
 * had already committed — and because the video feed treats "the table has
 * any rows" as "the table is authoritative," a partial table was served as if
 * it were complete.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tupleToVideoRow, type VideoRow } from "debate-data-sync/src/videos/video-rows";
import * as schema from "../../database/schema";
import { videos } from "../../database/schema";

const drizzleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

/**
 * Every migration that creates or alters the `videos` table, in application
 * order. Keep this in sync with `drizzle/` — add a migration here whenever
 * one touches `videos`, or `freshDb()` drifts from the real schema again.
 */
const VIDEOS_TABLE_MIGRATIONS = ["0005_green_redwing.sql", "0041_video_stacks.sql"];

/** A fresh in-memory database with just the `videos` table migrated in. */
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

const row = (id: string, extra: Partial<VideoRow> = {}): VideoRow => ({
  ...tupleToVideoRow([id, `Title ${id}`, "2025-09-01", "Channel", 10, "", 1], "round")!,
  ...extra,
});

const fixtureRows: VideoRow[] = [row("a"), row("b"), row("c")];

vi.mock("../video-json-source", () => ({
  getVideoRowsFromJson: vi.fn(async () => fixtureRows),
}));

// Imported after the mock above so `seedVideosIntoDb` picks it up.
const { seedVideosIntoDb } = await import("../seed-videos-to-db");

describe("seedVideosIntoDb", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts every row from the JSON assets and reports accurate counts", async () => {
    const db = await freshDb();

    const result = await seedVideosIntoDb(db);

    expect(result.rows).toBe(fixtureRows.length);
    const stored = await db.select().from(videos);
    expect(stored.map((r) => r.videoId).sort()).toEqual(["a", "b", "c"]);
    expect(stored.find((r) => r.videoId === "a")?.title).toBe("Title a");
  });

  it("prunes a row the assets no longer carry on the next run", async () => {
    const db = await freshDb();
    await seedVideosIntoDb(db);

    // Force "c"'s `updated_at` (stamped by the first run's real `unixepoch()`)
    // to look old, rather than mocking `Date.now` — the prune threshold is
    // computed in JS but compared against SQLite's own clock, so only the
    // latter needs faking here.
    await db.run(sql`UPDATE videos SET updated_at = 0 WHERE video_id = 'c'`);

    // Re-seed with one fewer row, so "c" is no longer among the upserts and
    // is old enough to be pruned by the trailing `DELETE`.
    vi.mocked((await import("../video-json-source")).getVideoRowsFromJson).mockResolvedValue([
      row("a"),
      row("b"),
    ]);

    await seedVideosIntoDb(db);

    const stored = await db.select().from(videos);
    expect(stored.map((r) => r.videoId).sort()).toEqual(["a", "b"]);
  });

  it("runs every statement as one atomic batch, not sequential awaited calls", async () => {
    const db = await freshDb();
    const runSpy = vi.spyOn(db, "run");
    const batchSpy = vi.spyOn(db, "batch");

    await seedVideosIntoDb(db);

    // One insert statement (3 small rows fit in one batch) plus the prune.
    expect(runSpy).toHaveBeenCalledTimes(2);
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(batchSpy.mock.calls[0]?.[0]).toHaveLength(2);
  });
});

describe("db.batch atomicity (the guarantee the fix above relies on)", () => {
  it("rolls back every statement in the batch when one of them fails", async () => {
    const db = await freshDb();

    // A valid insert followed by one missing the NOT NULL `source` column —
    // the same `db.run(sql.raw(...))`-array-passed-to-`db.batch` shape
    // `seedVideosIntoDb` now uses.
    await expect(
      db.batch([
        db.run(sql.raw(`INSERT INTO "videos" ("video_id", "source") VALUES ('ok', 'round')`)),
        db.run(sql.raw(`INSERT INTO "videos" ("video_id") VALUES ('missing-source')`)),
      ]),
    ).rejects.toThrow();

    // Neither row is present — the first statement's insert did not survive
    // the second statement's failure, proving the batch is atomic rather
    // than committing statement-by-statement.
    const stored = await db.select().from(videos);
    expect(stored).toHaveLength(0);
  });
});
