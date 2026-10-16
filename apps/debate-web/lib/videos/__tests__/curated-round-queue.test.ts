/**
 * @fileoverview Runs the SQL `.github/scripts/queue-test-videos.ts` prints
 * against a real in-memory database: curated rounds land in the admin queue,
 * already-published and admin-removed videos stay out, a round already
 * waiting in the queue gains the curated lines, and publishing carries the
 * 1AC / 2NR arguments into the library.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  buildCuratedQueueStatement,
  curatedRecordToQueueRow,
  type CuratedRoundRecord,
} from "@debate/data-sync/src/videos/curated-round-queue";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videos, youtubeRoundVideos, youtubeVideoExclusions } from "../../database/schema";
import { publishRoundVideos } from "../publish-round-video";

function record(videoId: string, extra: Partial<CuratedRoundRecord> = {}): CuratedRoundRecord {
  return {
    record_id: `rec${videoId}`,
    title: "Lynbrook OM vs. Peninsula SU",
    event: "2023 TDI Quarters",
    format: "LD",
    arguments: ["Policy v K", "Setcol", "Fast", "Resolved: The United States ought to adopt a wealth tax."],
    url: `https://www.youtube.com/watch?v=${videoId}`,
    video_id: videoId,
    ...extra,
  };
}

async function setup() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return { client, db: drizzle(client, { schema }) };
}

async function queue(client: Awaited<ReturnType<typeof setup>>["client"], records: CuratedRoundRecord[]) {
  for (const r of records) await client.execute(buildCuratedQueueStatement(curatedRecordToQueueRow(r)));
}

describe("curated round queue SQL", () => {
  it("queues a new round with its topic and arguments in the description", async () => {
    const { client, db } = await setup();
    await queue(client, [record("new")]);

    const [row] = await db.select().from(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, "new"));
    expect(row?.style).toBe(3);
    expect(row?.tournament).toBe("TDI");
    expect(row?.roundLevel).toBe("Quarterfinals");
    expect(row?.aff).toBe("Lynbrook OM");
    expect(row?.neg).toBe("Peninsula SU");
    expect(row?.description).toContain("Topic: Resolved: The United States ought to adopt a wealth tax.");
    expect(row?.description).toContain("Arguments: Policy v K, Setcol, Fast");
    expect(row?.description).toContain("Aff 1AC args: Policy");
    expect(row?.description).toContain("Neg 2NR args: Setcol");
  });

  it("skips videos already in the library or removed by an admin", async () => {
    const { client, db } = await setup();
    await publishRoundVideos(db, [
      { ...curatedRecordToQueueRow(record("published")), createdAt: new Date(0), updatedAt: new Date(0) },
    ]);
    await db.insert(youtubeVideoExclusions).values({ videoId: "removed" });

    await queue(client, [record("published"), record("removed")]);

    expect(await db.select().from(youtubeRoundVideos)).toHaveLength(0);
  });

  it("appends the curated lines to a round already waiting in the queue, once", async () => {
    const { client, db } = await setup();
    await db.insert(youtubeRoundVideos).values({
      id: "queued",
      title: "YouTube title",
      publishedAt: "2023-11-02",
      channel: "Channel",
      description: "Original YouTube description",
      style: 3,
    });

    await queue(client, [record("queued"), record("queued")]);

    const [row] = await db.select().from(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, "queued"));
    expect(row?.title).toBe("YouTube title");
    expect(row?.publishedAt).toBe("2023-11-02");
    expect(row?.description.startsWith("Original YouTube description\n\nTopic: ")).toBe(true);
    expect(row?.description.match(/Neg 2NR args:/g)).toHaveLength(1);
  });

  it("rewrites a row it queued itself when the record changes", async () => {
    const { client, db } = await setup();
    await queue(client, [record("again", { event: "2023 TDI Round 2" })]);
    await queue(client, [record("again", { event: "2023 TDI Round 5" })]);

    const [row] = await db.select().from(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, "again"));
    expect(row?.description).toContain("Event: 2023 TDI Round 5");
    expect(row?.description).not.toContain("Round 2");
  });

  it("publishes the queued arguments into arg_1ac / arg_2nr", async () => {
    const { client, db } = await setup();
    await queue(client, [record("pub", { arguments: ["K v T-Framework", "Setcol", "Fast", "Resolved: X."] })]);

    await publishRoundVideos(db, await db.select().from(youtubeRoundVideos));

    const [row] = await db.select().from(videos).where(eq(videos.videoId, "pub"));
    expect(row?.arg1ac).toBe("Setcol");
    expect(row?.arg2nr).toBe("T-Framework");
    expect(row?.description).toContain("Topic: Resolved: X.");
  });
});
