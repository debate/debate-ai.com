/**
 * @fileoverview The catch-up lecture filing against a real SQLite database:
 * Congressional Debate lectures (queued and published) move onto the Congress
 * shelf, unplaced queued lectures move onto Miscellaneous, rounds and
 * civics-about-Congress lectures are left alone, a dry run reports without
 * writing, and a second run changes nothing.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { normalizeCategoryKey } from "@debate-ai/videos/src/data/video-rows";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";
import { refileLectures } from "@/lib/videos/refile-lectures";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;

async function queue(id: string, fields: Partial<typeof schema.youtubeRoundVideos.$inferInsert> = {}) {
  await db.insert(schema.youtubeRoundVideos).values({ id, title: `Lecture ${id}`, publishedAt: "2025-01-01", channel: "Debate Channel", style: null, ...fields });
}

async function publish(videoId: string, fields: Partial<typeof schema.videos.$inferInsert> = {}) {
  await db.insert(schema.videos).values({ videoId, source: "lecture", title: `Lecture ${videoId}`, channel: "Debate Channel", style: null, ...fields });
}

const queuedCategory = async (id: string) =>
  (await db.select().from(schema.youtubeRoundVideos)).find((row) => row.id === id)?.category;
const publishedRow = async (id: string) => (await db.select().from(schema.videos)).find((row) => row.videoId === id)!;

beforeEach(async () => {
  db = await freshSchemaDb();
});

describe("refileLectures", () => {
  it("moves Congressional Debate lectures to Congress, wherever they sit", async () => {
    await queue("queuedcong1", { title: "How to win Student Congress", category: "Topic Lectures" });
    await publish("pubcongres1", { title: "Congressional Debate: points of order", category: "Topic Lectures", categoryKey: "topic-lectures" });

    const result = await refileLectures(db);
    expect(result.dryRun).toBe(false);
    expect(result.congress).toMatchObject({ queued: 1, published: 1 });
    expect(await queuedCategory("queuedcong1")).toBe("Congress");
    expect(await publishedRow("pubcongres1")).toMatchObject({ category: "Congress", categoryKey: "congress" });
  });

  it("leaves a US-Congress civics lecture, a Congress round and an already-filed lecture alone", async () => {
    await queue("civics00001", { title: "How a bill becomes law in Congress", category: "Topic Lectures" });
    await queue("round000001", { title: "Student Congress round", style: 9, category: null });
    await queue("alreadyfile", { title: "Student Congress tips", category: "Congress" });
    await publish("pubround001", { title: "Student Congress finals", style: 9, category: "Congress", categoryKey: "congress" });

    const result = await refileLectures(db);
    expect(result.congress).toMatchObject({ queued: 0, published: 0, samples: [] });
    expect(await queuedCategory("civics00001")).toBe("Topic Lectures");
    expect(await queuedCategory("round000001")).toBeNull();
  });

  it("files unplaced or unknown-category queued lectures under Miscellaneous, not rounds or placed lectures", async () => {
    await queue("nocategory1", { category: null });
    await queue("unknowncat1", { category: "Made Up Shelf" });
    await queue("placed00001", { category: "Topic Lectures" });
    await queue("round000002", { style: 2, category: null });

    const result = await refileLectures(db);
    expect(result.miscellaneous.queued).toBe(2);
    expect(await queuedCategory("nocategory1")).toBe("Miscellaneous");
    expect(await queuedCategory("unknowncat1")).toBe("Miscellaneous");
    expect(await queuedCategory("placed00001")).toBe("Topic Lectures");
    expect(await queuedCategory("round000002")).toBeNull();
  });

  it("counts unsorted published lectures without rewriting them", async () => {
    await publish("nokey000001", { category: null, categoryKey: null });
    await publish("badkey00001", { category: "Whatever", categoryKey: "whatever" });
    await publish("goodkey0001", { category: "Topic Lectures", categoryKey: normalizeCategoryKey("Topic Lectures") });
    await publish("roundrow001", { style: 1, categoryKey: null });

    const result = await refileLectures(db);
    expect(result.miscellaneous.publishedUnsorted).toBe(2);
    expect((await publishedRow("badkey00001")).category).toBe("Whatever");
  });

  it("reports what it would do in a dry run, and writes nothing", async () => {
    await queue("queuedcong1", { title: "Student Congress basics" });
    await queue("nocategory1", { category: null });
    await publish("pubcongres1", { title: "Congressional Debate speeches" });

    const result = await refileLectures(db, { dryRun: true });
    expect(result).toMatchObject({ dryRun: true, congress: { queued: 1, published: 1 }, miscellaneous: { queued: 1 } });
    expect(await queuedCategory("queuedcong1")).toBeNull();
    expect(await queuedCategory("nocategory1")).toBeNull();
    expect((await publishedRow("pubcongres1")).category).toBeNull();
  });

  it("lists up to fifteen samples, queued first, and is idempotent", async () => {
    for (let n = 0; n < 10; n++) await queue(`queued${String(n).padStart(5, "0")}`, { title: `Student Congress lesson ${n}` });
    for (let n = 0; n < 10; n++) await publish(`pub${String(n).padStart(8, "0")}`, { title: `Student Congress talk ${n}` });

    const first = await refileLectures(db);
    expect(first.congress).toMatchObject({ queued: 10, published: 10 });
    expect(first.congress.samples).toHaveLength(15);
    expect(first.congress.samples.slice(0, 10).every((sample) => sample.where === "queued")).toBe(true);
    expect(first.congress.samples[10].where).toBe("published");

    const second = await refileLectures(db);
    expect(second.congress).toMatchObject({ queued: 0, published: 0 });
    expect(second.miscellaneous.queued).toBe(0);
  });

  it("does nothing on an empty library", async () => {
    expect(await refileLectures(db)).toEqual({
      dryRun: false,
      congress: { queued: 0, published: 0, samples: [] },
      miscellaneous: { queued: 0, publishedUnsorted: 0 },
    });
  });
});
