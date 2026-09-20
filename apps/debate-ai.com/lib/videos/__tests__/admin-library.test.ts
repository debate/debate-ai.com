/**
 * @fileoverview Exercises the admin video-library read/write helpers against a
 * real in-memory SQLite database, the same approach
 * `seed-videos-to-db.test.ts` uses: the interesting behavior here is the
 * interaction between three tables (`videos`, `youtube_round_videos` and
 * `youtube_video_exclusions`), which a mocked drizzle handle cannot show.
 *
 * The regressions being pinned:
 * - editing a title has to rewrite `search_text`, or the public feed's search
 *   keeps matching the old title and misses the new one;
 * - editing a publish date has to rewrite `published_ms` and `season_year`,
 *   or the video sorts and season-filters by its old date;
 * - a one-field edit must not blank the rest of the row;
 * - removing a published video has to record an exclusion, or the next weekly
 *   YouTube resync re-ingests and re-publishes what an admin just removed.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import {
  videos,
  youtubeRoundVideos,
  youtubeVideoExclusions,
  type VideoTableInsert,
} from "../../database/schema";
import {
  buildLibraryUpdate,
  deleteLibraryVideo,
  listLibraryVideos,
  updateLibraryVideo,
} from "../admin-library";

const drizzleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

/**
 * Migrations creating the three tables these helpers touch. Keep in sync with
 * `drizzle/` whenever one of them is altered.
 */
const MIGRATIONS = [
  "0003_dark_zarek.sql", // youtube_round_videos
  "0005_green_redwing.sql", // videos
  "0026_admin_youtube_management.sql", // youtube_video_exclusions
  "0041_video_stacks.sql", // videos.stack_key / stack_position
  "0045_video_documents_relations_issues.sql", // videos.availability, and the
  // video_documents / video_relations / video_issues tables
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

function videoRow(id: string, extra: Partial<VideoTableInsert> = {}): VideoTableInsert {
  return {
    videoId: id,
    source: "round",
    title: `Title ${id}`,
    publishedAt: "2024-09-01",
    publishedMs: Date.parse("2024-09-01"),
    channel: "Channel One",
    viewCount: 100,
    description: `Description ${id}`,
    style: 1,
    seasonYear: 2025,
    searchText: `title ${id} channel one description ${id}`,
    ...extra,
  };
}

describe("buildLibraryUpdate", () => {
  const current = {
    ...videoRow("abc"),
    updatedAt: new Date(0),
  } as any;

  it("writes only the fields the patch carries", () => {
    const update = buildLibraryUpdate(current, { title: "New title" }) as any;

    expect(update.title).toBe("New title");
    expect(update).not.toHaveProperty("channel");
    expect(update).not.toHaveProperty("tournament");
  });

  it("rebuilds search text from the merged row, not the patch alone", () => {
    const update = buildLibraryUpdate(current, { title: "New title" }) as any;

    expect(update.searchText).toBe("new title channel one description abc");
  });

  it("recomputes the sort and season columns when the publish date moves", () => {
    const update = buildLibraryUpdate(current, { publishedAt: "2019-03-04" }) as any;

    expect(update.publishedMs).toBe(Date.parse("2019-03-04"));
    expect(update.seasonYear).toBe(2019);
  });

  it("leaves the sort columns alone when the publish date is unchanged", () => {
    const update = buildLibraryUpdate(current, { publishedAt: "2024-09-01" }) as any;

    expect(update).not.toHaveProperty("publishedMs");
    expect(update).not.toHaveProperty("seasonYear");
  });

  it("keeps the stored publish date rather than accepting a blank one", () => {
    const update = buildLibraryUpdate(current, { publishedAt: "  " }) as any;

    expect(update).not.toHaveProperty("publishedAt");
    expect(update).not.toHaveProperty("publishedMs");
  });

  it("normalizes blank optional fields to null and keeps the tri-state winner", () => {
    const update = buildLibraryUpdate(current, {
      tournament: "   ",
      affWin: "",
      style: "3",
      isTopPick: "true",
    }) as any;

    expect(update.tournament).toBeNull();
    expect(update.affWin).toBeNull();
    expect(update.style).toBe(3);
    expect(update.isTopPick).toBe(true);
  });

  it("clears the numeric style when a round is re-labelled a lecture", () => {
    const update = buildLibraryUpdate(current, { style: null }) as any;

    expect(update.style).toBeNull();
  });

  it("flags the row as admin-edited so a re-seed leaves it alone", () => {
    const update = buildLibraryUpdate(current, { title: "New title" }) as any;

    expect(update.adminEdited).toBe(true);
  });
});

describe("listLibraryVideos", () => {
  it("searches title, channel, tournament and video id", async () => {
    const db = await freshDb();
    await db.insert(videos).values([
      videoRow("a", { title: "Harvard octas" }),
      videoRow("b", { title: "Berkeley finals", tournament: "Berkeley" }),
      videoRow("c", { title: "Some lecture", channel: "Harvard Debate" }),
      videoRow("zqx9", { title: "Unrelated", channel: "Elsewhere" }),
    ]);

    const byTitle = await listLibraryVideos(db, { q: "Harvard" });
    expect(byTitle.videos.map((v: any) => v.videoId).sort()).toEqual(["a", "c"]);

    const byTournament = await listLibraryVideos(db, { q: "Berkeley" });
    expect(byTournament.videos.map((v: any) => v.videoId)).toEqual(["b"]);

    const byId = await listLibraryVideos(db, { q: "zqx9" });
    expect(byId.videos.map((v: any) => v.videoId)).toEqual(["zqx9"]);
  });

  it("filters lectures by their missing numeric style", async () => {
    const db = await freshDb();
    await db.insert(videos).values([
      videoRow("a", { style: 1 }),
      videoRow("b", { style: null, source: "lecture", category: "Demo Debates" }),
    ]);

    const lectures = await listLibraryVideos(db, { source: "lecture" });
    expect(lectures.videos.map((v: any) => v.videoId)).toEqual(["b"]);

    const policy = await listLibraryVideos(db, { style: 1 });
    expect(policy.videos.map((v: any) => v.videoId)).toEqual(["a"]);
  });

  it("pages with a total and clamps a page past the end", async () => {
    const db = await freshDb();
    await db.insert(videos).values(
      ["a", "b", "c", "d", "e"].map((id) => videoRow(id)),
    );

    const first = await listLibraryVideos(db, { limit: 2, page: 1 });
    expect(first.total).toBe(5);
    expect(first.pageCount).toBe(3);
    expect(first.videos).toHaveLength(2);

    const past = await listLibraryVideos(db, { limit: 2, page: 99 });
    expect(past.page).toBe(3);
    expect(past.videos).toHaveLength(1);
  });

  it("sorts on the requested column and direction", async () => {
    const db = await freshDb();
    await db.insert(videos).values([
      videoRow("a", { viewCount: 10 }),
      videoRow("b", { viewCount: 300 }),
      videoRow("c", { viewCount: 50 }),
    ]);

    const mostViewed = await listLibraryVideos(db, { sort: "views", dir: "desc" });
    expect(mostViewed.videos.map((v: any) => v.videoId)).toEqual(["b", "c", "a"]);

    const leastViewed = await listLibraryVideos(db, { sort: "views", dir: "asc" });
    expect(leastViewed.videos.map((v: any) => v.videoId)).toEqual(["a", "c", "b"]);
  });
});

describe("updateLibraryVideo", () => {
  it("persists an edit without disturbing the untouched columns", async () => {
    const db = await freshDb();
    await db.insert(videos).values(videoRow("a", { tournament: "Glenbrooks" }));

    const updated = await updateLibraryVideo(db, "a", { title: "Corrected title" });

    expect(updated?.title).toBe("Corrected title");
    expect(updated?.tournament).toBe("Glenbrooks");
    expect(updated?.channel).toBe("Channel One");
    expect(updated?.searchText).toBe("corrected title channel one description a");
    expect(updated?.adminEdited).toBe(true);
  });

  it("returns null for a video that is not published", async () => {
    const db = await freshDb();

    expect(await updateLibraryVideo(db, "missing", { title: "x" })).toBeNull();
  });
});

describe("deleteLibraryVideo", () => {
  it("removes the video from both tables and records the exclusion", async () => {
    const db = await freshDb();
    await db.insert(videos).values(videoRow("a"));
    await db.insert(youtubeRoundVideos).values({
      id: "a",
      title: "Title a",
      publishedAt: "2024-09-01",
      channel: "Channel One",
      style: 1,
    });

    const removed = await deleteLibraryVideo(db, "a", "admin@example.com");

    expect(removed).toBe(true);
    expect(await db.select().from(videos).where(eq(videos.videoId, "a"))).toHaveLength(0);
    expect(
      await db.select().from(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, "a")),
    ).toHaveLength(0);

    const [exclusion] = await db
      .select()
      .from(youtubeVideoExclusions)
      .where(eq(youtubeVideoExclusions.videoId, "a"));
    expect(exclusion?.deletedBy).toBe("admin@example.com");
  });

  it("reports a miss without writing an exclusion for a video it never had", async () => {
    const db = await freshDb();

    expect(await deleteLibraryVideo(db, "ghost", "admin@example.com")).toBe(false);
    expect(await db.select().from(youtubeVideoExclusions)).toHaveLength(0);
  });

  it("re-records the exclusion rather than failing on a second removal", async () => {
    const db = await freshDb();
    await db.insert(videos).values(videoRow("a"));

    expect(await deleteLibraryVideo(db, "a", "first@example.com")).toBe(true);
    // The row is gone, so a repeat is a no-op miss — and must not throw on
    // the exclusion primary key.
    expect(await deleteLibraryVideo(db, "a", "second@example.com")).toBe(false);

    const rows = await db.select().from(youtubeVideoExclusions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedBy).toBe("first@example.com");
  });
});
