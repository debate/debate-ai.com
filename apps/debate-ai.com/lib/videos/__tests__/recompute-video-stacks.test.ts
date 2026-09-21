/**
 * @fileoverview Exercises `recomputeVideoStacks` against a real in-memory
 * SQLite database, mirroring `publish-round-video.test.ts`'s approach — the
 * regression being pinned (a row inserted with no stack placement staying
 * unstacked forever) needs the actual `videos` table already carrying rows
 * from more than one insert path, which a mocked drizzle handle can't show.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { videos } from "../../database/schema";
import { recomputeVideoStacks } from "../recompute-video-stacks";

const drizzleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

const MIGRATIONS = [
  "0003_dark_zarek.sql", // youtube_round_videos
  "0005_green_redwing.sql", // videos
  "0041_video_stacks.sql", // videos.stack_key / stack_position
  "0045_video_documents_relations_issues.sql", // videos.availability
  "0047_video_admin_edited.sql", // videos.admin_edited
];

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  for (const migration of MIGRATIONS) {
    const contents = readFileSync(path.join(drizzleDir, migration), "utf8");
    for (const statement of contents.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
  return drizzle(client, { schema });
}

type Db = Awaited<ReturnType<typeof freshDb>>;

async function insertVideo(
  db: Db,
  id: string,
  overrides: { description?: string; source?: "round" | "lecture"; publishedMs?: number } = {},
) {
  await db.insert(videos).values({
    videoId: id,
    source: overrides.source ?? "round",
    publishedAt: "2026-01-01",
    publishedMs: overrides.publishedMs ?? 0,
    description: overrides.description ?? "",
  } as any);
}

describe("recomputeVideoStacks", () => {
  it("stacks two already-stored rows that were both inserted with no placement", async () => {
    // Reproduces the historical gap: a round and its analysis, both
    // published through the live pipeline (which never set stack fields at
    // all), sitting in the table unlinked.
    const db = await freshDb();
    await insertVideo(db, "roundvideo1", { source: "round", publishedMs: 1 });
    await insertVideo(db, "analysisvid1", {
      source: "lecture",
      publishedMs: 2,
      description: "Full Debate: https://www.youtube.com/watch?v=roundvideo1",
    });

    const result = await recomputeVideoStacks(db);

    expect(result.rows).toBe(2);
    expect(result.updated).toBe(2);
    const [round] = await db.select().from(videos).where(eq(videos.videoId, "roundvideo1"));
    const [analysis] = await db.select().from(videos).where(eq(videos.videoId, "analysisvid1"));
    expect(round?.stackKey).toBe("roundvideo1");
    expect(round?.stackPosition).toBe(0);
    expect(analysis?.stackKey).toBe("roundvideo1");
    expect(analysis?.stackPosition).toBe(1);
  });

  it("links a video to a stack partner published under a different pipeline weeks earlier", async () => {
    const db = await freshDb();
    await insertVideo(db, "roundvideo1", { source: "round", publishedMs: 1 });

    const first = await recomputeVideoStacks(db);
    expect(first.updated).toBe(0); // nothing to link to yet

    await insertVideo(db, "analysisvid1", {
      source: "lecture",
      publishedMs: 2,
      description: "Full Debate: https://www.youtube.com/watch?v=roundvideo1",
    });
    const second = await recomputeVideoStacks(db);

    expect(second.rows).toBe(2);
    // Only the two members of the newly-formed stack are rewritten.
    expect(second.updated).toBe(2);
    const [round] = await db.select().from(videos).where(eq(videos.videoId, "roundvideo1"));
    expect(round?.stackKey).toBe("roundvideo1");
  });

  it("does not rewrite a row whose placement already matches", async () => {
    const db = await freshDb();
    await insertVideo(db, "lonelyvideo1", { source: "round" });
    await recomputeVideoStacks(db); // baseline: unstacked, stackKey already null

    const result = await recomputeVideoStacks(db);

    expect(result.rows).toBe(1);
    expect(result.updated).toBe(0);
  });

  it("clears a video's stack placement once its partner is removed", async () => {
    const db = await freshDb();
    await insertVideo(db, "roundvideo1", { source: "round", publishedMs: 1 });
    await insertVideo(db, "analysisvid1", {
      source: "lecture",
      publishedMs: 2,
      description: "Full Debate: https://www.youtube.com/watch?v=roundvideo1",
    });
    await recomputeVideoStacks(db);

    await db.delete(videos).where(eq(videos.videoId, "analysisvid1"));
    const result = await recomputeVideoStacks(db);

    expect(result.updated).toBe(1);
    const [round] = await db.select().from(videos).where(eq(videos.videoId, "roundvideo1"));
    expect(round?.stackKey).toBeNull();
    expect(round?.stackPosition).toBe(0);
  });
});
