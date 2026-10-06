/**
 * @fileoverview Exercises `publishRoundVideos` against a real in-memory
 * SQLite database, mirroring `admin-library.test.ts`'s approach — the
 * regression being pinned needs the actual `videos` table to already carry
 * an admin-edited row before the publish path writes to it, which a mocked
 * drizzle handle can't show.
 *
 * The regression: the weekly/manual YouTube resync (`resync-rounds.ts`)
 * re-walks every subscribed channel's uploads since a fixed floor date on
 * every run, with no check against the public `videos` table — an
 * already-published, already-admin-corrected round can resurface in
 * `youtube_round_videos` days or months later. `publishRoundVideos` must not
 * let that resurfaced, round-derived data silently overwrite the admin's
 * correction, the same "an admin's edit is this row's source of truth once
 * made" guarantee `video-seed-sql.ts#buildVideoSeedStatements` already gives
 * the JSON-seed path.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATEMENTS_PER_BATCH,
  D1_MAX_QUERIES_PER_INVOCATION,
} from "../../database/query-budget";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videos, youtubeRoundVideos, type YoutubeRoundVideo } from "../../database/schema";
import { dedupeRoundQueue, publishRoundVideos, roundVideoToVideoRow } from "../publish-round-video";

async function freshClient() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return client;
}

async function freshDb() {
  return drizzle(await freshClient(), { schema });
}

/**
 * A drizzle handle that also records how many parameters each statement binds
 * and how many round trips the driver actually made. Local SQLite happily
 * binds tens of thousands and counts no queries at all, so D1's two ceilings —
 * 100 bound parameters per statement, 1,000 queries per Worker invocation —
 * can only be pinned by counting what the driver was handed. A `batch()` is
 * one round trip however many statements it carries, which is exactly what
 * makes it the way under the second ceiling.
 */
async function recordingDb() {
  const client = await freshClient();
  const boundParamCounts: number[] = [];
  let roundTrips = 0;
  const count = (statement: unknown) => {
    const args = (statement as { args?: unknown })?.args;
    boundParamCounts.push(Array.isArray(args) ? args.length : Object.keys(args ?? {}).length);
  };
  const recorded = new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property === "execute" && typeof value === "function") {
        return (statement: unknown, ...rest: unknown[]) => {
          count(statement);
          roundTrips++;
          return (value as Function).call(target, statement, ...rest);
        };
      }
      if (property === "batch" && typeof value === "function") {
        return (statements: unknown[], ...rest: unknown[]) => {
          for (const statement of statements) count(statement);
          roundTrips++;
          return (value as Function).call(target, statements, ...rest);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return {
    db: drizzle(recorded as typeof client, { schema }),
    boundParamCounts,
    trips: () => roundTrips,
  };
}

function roundRow(id: string, extra: Partial<YoutubeRoundVideo> = {}): YoutubeRoundVideo {
  return {
    id,
    title: `Title ${id}`,
    publishedAt: "2024-09-01",
    channel: "Channel One",
    views: 100,
    description: `Description ${id}`,
    style: 1,
    tournament: null,
    roundLevel: null,
    aff: null,
    neg: null,
    winner: null,
    judgeDecision: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...extra,
  };
}

describe("publishRoundVideos", () => {
  it("publishes a queued round that has never been published before", async () => {
    const db = await freshDb();

    const published = await publishRoundVideos(db, [roundRow("a")]);

    expect(published).toBe(1);
    const [row] = await db.select().from(videos).where(eq(videos.videoId, "a"));
    expect(row?.title).toBe("Title a");
    expect(row?.adminEdited).toBe(false);
  });

  it("skips a queued round whose title matches a published video, and publishes only the oldest of a duplicate pair", async () => {
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("lib", { title: "Glenbrooks 2024 Semis: One vs Two" })]);

    const published = await publishRoundVideos(db, [
      roundRow("dupe", { title: "Glenbrooks 2024 Semis: One vs Two" }),
      roundRow("late", { title: "Berkeley 2025 Finals: Three vs Four", publishedAt: "2025-02-02" }),
      roundRow("early", { title: "Berkeley 2025 Finals: Three vs Four", publishedAt: "2025-02-01" }),
    ]);

    expect(published).toBe(1);
    const ids = (await db.select().from(videos)).map((row) => row.videoId).sort();
    expect(ids).toEqual(["early", "lib"]);
  });

  it("keeps the older published row when an already-published round is published again", async () => {
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("a", { title: "First sync title" })]);

    const published = await publishRoundVideos(db, [roundRow("a", { title: "Resynced title" })]);

    expect(published).toBe(0);
    const rows = await db.select().from(videos).where(eq(videos.videoId, "a"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("First sync title");
  });

  it("keeps an admin's correction through a round resurfacing in the resync queue (the lost-update race this closes)", async () => {
    // Reproduces the historical race: the round was published once, then an
    // admin corrected it directly on the `videos` row (title, tournament,
    // isTopPick, speechDocsUrl), and only afterward did the same round
    // resurface in `youtube_round_videos` — the weekly resync re-walking the
    // channel's whole upload history with no check against `videos` — and
    // reach `publishRoundVideos` again with the *original*, round-derived
    // data computed from a snapshot the admin's own edit had already
    // superseded.
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("a", { title: "Original title", tournament: "Regionals" })]);

    // The admin's own correction, applied directly to the published row —
    // mirrors what `updateLibraryVideo` would do.
    await db
      .update(videos)
      .set({
        title: "Corrected Title",
        tournament: "Glenbrooks",
        isTopPick: true,
        speechDocsUrl: "https://example.com/doc",
        adminEdited: true,
      })
      .where(eq(videos.videoId, "a"));

    // The round resurfaces in the queue (resync found it again) with the
    // original, unedited data, and gets published a second time.
    const published = await publishRoundVideos(db, [
      roundRow("a", { title: "Original title", tournament: "Regionals" }),
    ]);

    // The resurfaced round is skipped entirely — the admin's row wins.
    expect(published).toBe(0);
    const [row] = await db.select().from(videos).where(eq(videos.videoId, "a"));
    expect(row?.title).toBe("Corrected Title");
    expect(row?.tournament).toBe("Glenbrooks");
    expect(row?.isTopPick).toBe(true);
    expect(row?.speechDocsUrl).toBe("https://example.com/doc");
    expect(row?.adminEdited).toBe(true);
  });

  it("publishes every other queued round in the same batch even when one is skipped for being admin-edited", async () => {
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("a")]);
    await db.update(videos).set({ adminEdited: true, title: "Kept" }).where(eq(videos.videoId, "a"));

    const published = await publishRoundVideos(db, [
      roundRow("a", { title: "Should not land" }),
      roundRow("b", { title: "Brand new round" }),
    ]);

    expect(published).toBe(1);
    const [a] = await db.select().from(videos).where(eq(videos.videoId, "a"));
    const [b] = await db.select().from(videos).where(eq(videos.videoId, "b"));
    expect(a?.title).toBe("Kept");
    expect(b?.title).toBe("Brand new round");
  });
});

describe("publishRoundVideos over a large queue (D1 bound-parameter ceiling)", () => {
  it("keeps every statement inside D1's 100-parameter limit", async () => {
    // The production failure behind this test: "Publish all" over a queue of
    // more than 99 rounds built one `videoId IN (...)` over the whole batch
    // for the admin-edited lookup. D1 rejects a statement past 100 bound
    // parameters, so the request 500'd inside the D1 client before a single
    // row was written — and never reproduced locally, where SQLite's own
    // limit is in the tens of thousands.
    const { db, boundParamCounts } = await recordingDb();
    const queue = Array.from({ length: 250 }, (_, index) => roundRow(`round${index}`));

    const published = await publishRoundVideos(db, queue);

    expect(published).toBe(250);
    expect(boundParamCounts.length).toBeGreaterThan(0);
    expect(Math.max(...boundParamCounts)).toBeLessThanOrEqual(100);
  });

  it("spends a handful of D1 queries on the whole queue, not one per round", async () => {
    // The production failure behind this test: every statement was awaited on
    // its own, so a publish cost one D1 query per queued round plus the reads
    // around it. D1 allows a Worker invocation 1,000 queries (50 on the Free
    // plan), so a queue long enough — which is what "Publish all" is for —
    // crossed the ceiling mid-publish and 500'd at the driver, leaving the
    // rounds it had already written behind. Local SQLite counts no queries at
    // all, so only the round trips the driver was actually asked for show it.
    const { db, trips } = await recordingDb();
    const queue = Array.from({ length: 1200 }, (_, index) => roundRow(`round${index}`));

    const published = await publishRoundVideos(db, queue);

    expect(published).toBe(1200);
    expect(trips()).toBeLessThan(D1_MAX_QUERIES_PER_INVOCATION);
    // A batch per hundred statements for the lookups and the upserts, plus the
    // stack recompute's own read and writes — nothing that grows one-per-row.
    expect(trips()).toBeLessThanOrEqual(2 * Math.ceil(1200 / DEFAULT_STATEMENTS_PER_BATCH) + 20);
  });

  it("still skips the already-published rounds spread across the chunk boundary", async () => {
    // Chunking must not lose a hit: the lookup now runs as several
    // statements, and a round whose id lands in the second one is just as
    // published as one in the first.
    const db = await freshDb();
    const queue = Array.from({ length: 250 }, (_, index) => roundRow(`round${index}`));
    const kept = ["round0", "round98", "round99", "round100", "round198", "round249"];
    await publishRoundVideos(
      db,
      queue.filter((row) => kept.includes(row.id)).map((row) => ({ ...row, title: `Kept ${row.id}` })),
    );

    const published = await publishRoundVideos(
      db,
      queue.map((row) => ({ ...row, title: `Resynced title ${row.id}` })),
    );

    expect(published).toBe(250 - 6);
    for (const id of kept) {
      const [row] = await db.select().from(videos).where(eq(videos.videoId, id));
      expect(row?.title).toBe(`Kept ${id}`);
    }
    const [untouched] = await db.select().from(videos).where(eq(videos.videoId, "round101"));
    expect(untouched?.title).toBe("Resynced title round101");
  });
});

describe("publishRoundVideos stacking", () => {
  it("links a newly published round to an analysis video already in the table", async () => {
    // Closes the "no stacks until re-seeded" gap for the live pipeline: an
    // analysis video published earlier (through whichever path) sits in the
    // table unstacked until a round it links to is published.
    const db = await freshDb();
    await db.insert(videos).values({
      videoId: "analysisvid1",
      source: "lecture",
      publishedAt: "2024-09-05",
      publishedMs: Date.parse("2024-09-05"),
      description: "Full Debate: https://www.youtube.com/watch?v=roundvideo1",
    } as any);

    await publishRoundVideos(db, [roundRow("roundvideo1", { publishedAt: "2024-09-01" })]);

    const [round] = await db.select().from(videos).where(eq(videos.videoId, "roundvideo1"));
    const [analysis] = await db.select().from(videos).where(eq(videos.videoId, "analysisvid1"));
    expect(round?.stackKey).toBe("roundvideo1");
    expect(analysis?.stackKey).toBe("roundvideo1");
    expect(analysis?.stackPosition).toBe(1);
  });

  it("does not touch stacking when nothing was actually published", async () => {
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("a")]);
    await db.update(videos).set({ adminEdited: true }).where(eq(videos.videoId, "a"));

    // Every row in this batch is admin-edited, so nothing is published — and
    // recompute should not even run (there is nothing new to link).
    const published = await publishRoundVideos(db, [roundRow("a", { title: "Should not land" })]);

    expect(published).toBe(0);
  });
});

describe("dedupeRoundQueue", () => {
  it("removes only queued rounds already in the library and leaves the published rows untouched", async () => {
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("old", { title: "Original" })]);
    await db.insert(youtubeRoundVideos).values([
      roundRow("old", { title: "Resynced" }),
      roundRow("new"),
    ]);

    const removed = await dedupeRoundQueue(db);

    expect(removed).toEqual(["old"]);
    const queue = await db.select().from(youtubeRoundVideos);
    expect(queue.map((row) => row.id)).toEqual(["new"]);
    const [published] = await db.select().from(videos).where(eq(videos.videoId, "old"));
    expect(published?.title).toBe("Original");
  });

  it("matches a library row stored as a YouTube URL by its video id", async () => {
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("https://www.youtube.com/watch?v=abcdefghijk", { title: "Original" })]);
    await db.insert(youtubeRoundVideos).values([roundRow("abcdefghijk", { title: "Resynced" })]);

    expect(await dedupeRoundQueue(db)).toEqual(["abcdefghijk"]);
    expect(await db.select().from(youtubeRoundVideos)).toHaveLength(0);
  });

  it("removes a re-upload whose title matches a library video, keeping the library row", async () => {
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("old", { title: "TOC 2024 Finals: Alpha vs Beta" })]);
    await db.insert(youtubeRoundVideos).values([
      roundRow("reupload", { title: "TOC 2024 Finals — Alpha vs. Beta", publishedAt: "2024-01-01" }),
    ]);

    expect(await dedupeRoundQueue(db)).toEqual(["reupload"]);
    const library = await db.select().from(videos);
    expect(library.map((row) => row.videoId)).toEqual(["old"]);
  });

  it("keeps the older of two queued rounds that share a title", async () => {
    const db = await freshDb();
    await db.insert(youtubeRoundVideos).values([
      roundRow("newer", { title: "NDT 2025 Octafinals: Gamma vs Delta", publishedAt: "2025-03-02" }),
      roundRow("older", { title: "NDT 2025 Octafinals: Gamma vs Delta", publishedAt: "2025-03-01" }),
    ]);

    expect(await dedupeRoundQueue(db)).toEqual(["newer"]);
    const queue = await db.select().from(youtubeRoundVideos);
    expect(queue.map((row) => row.id)).toEqual(["older"]);
  });

  it("does not treat short generic titles as duplicates", async () => {
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("a", { title: "Finals" })]);
    await db.insert(youtubeRoundVideos).values([roundRow("b", { title: "Finals" })]);

    expect(await dedupeRoundQueue(db)).toEqual([]);
  });

  it("narrows to one style when given", async () => {
    const db = await freshDb();
    await publishRoundVideos(db, [roundRow("a"), roundRow("b")]);
    await db.insert(youtubeRoundVideos).values([roundRow("a", { style: 1 }), roundRow("b", { style: 2 })]);

    const removed = await dedupeRoundQueue(db, 2);

    expect(removed).toEqual(["b"]);
    const queue = await db.select().from(youtubeRoundVideos);
    expect(queue.map((row) => row.id)).toEqual(["a"]);
  });

  it("handles a queue past D1's bound-parameter ceiling", async () => {
    const { db, boundParamCounts } = await recordingDb();
    const queue = Array.from({ length: 250 }, (_, index) => roundRow(`round${index}`));
    await publishRoundVideos(db, queue.slice(0, 150));
    for (const row of queue) await db.insert(youtubeRoundVideos).values(row);
    boundParamCounts.length = 0;

    const removed = await dedupeRoundQueue(db);

    expect(removed).toHaveLength(150);
    expect(await db.select().from(youtubeRoundVideos)).toHaveLength(100);
    expect(Math.max(...boundParamCounts)).toBeLessThanOrEqual(100);
  });
});

describe("roundVideoToVideoRow", () => {
  it("derives a lowercased search_text from the round's title, channel and description", () => {
    const row = roundVideoToVideoRow(roundRow("a", { title: "Big Debate", channel: "Channel X" }));
    expect(row.searchText).toBe("big debate channel x description a");
  });

  it("copies the description's 1AC / 2NR argument lines into arg_1ac / arg_2nr", () => {
    const row = roundVideoToVideoRow(
      roundRow("a", {
        description: "Topic: Resolved: X.\nArguments: K v T-Framework, Setcol, Fast\nAff 1AC args: Setcol\nNeg 2NR args: T-Framework",
      }),
    );
    expect(row.arg1ac).toBe("Setcol");
    expect(row.arg2nr).toBe("T-Framework");
  });

  it("leaves the arguments empty for a resynced round without those lines", () => {
    const row = roundVideoToVideoRow(roundRow("a"));
    expect(row.arg1ac).toBeNull();
    expect(row.arg2nr).toBeNull();
  });
});
