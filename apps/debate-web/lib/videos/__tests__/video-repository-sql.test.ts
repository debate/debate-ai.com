/**
 * @fileoverview The SQL side of the video library's read path.
 *
 * `video-repository.ts` answers every read from the `videos` table when it is
 * seeded and from the JSON assets otherwise, and promises both return the
 * same shapes. `video-route-lookup.test.ts` covers the JSON side; this suite
 * seeds a real in-memory SQLite database through the production seed
 * (`seedVideosIntoDb`) from the same rows the JSON side reads, then checks
 * that every SQL query agrees with the pure in-memory twin it mirrors
 * (`queryVideoRows`, `computeVideoFacets`, `computeVideoSuggestions`, …) —
 * so a drift between the SQL predicates and the JS filters shows up as a
 * failing case here instead of as different results per backend.
 */

import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { videos } from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { buildVideoRows, videoRowToTuple, type VideoRow, type VideoTuple } from "@debate-ai/videos/src/data/video-rows";
import { isVideoRoundPath } from "@debate-ai/videos/src/lib/video-topic-path";
import {
  computeLectureCategories,
  computeVideoFacets,
  computeVideoSuggestions,
  filterVideoRows,
  queryVideoRows,
  type VideoQueryParams,
} from "@debate-ai/videos/src/data/video-query";
import { videoRowToIndexTuple } from "@debate-ai/videos/src/data/video-index";

/** Rounds across formats, seasons, tournaments and view counts. */
const ROUNDS = [
  ["uQ1-3BOv_6E", "NDT 2026 - Octas - AFF Kansas LS v NEG Michigan SS", "2026-04-02", "Kansas Debate", 1840, "", 4, "NDT 2026", "Octas", "Kansas LS", "Michigan SS", null, null, null, null, false, null],
  ["kyR3michDtm", "Kentucky 2026 - Round 3 - Michigan GV vs Dartmouth CG", "2026-10-10", "Kentucky Debate", 120, "", 4, "Kentucky 2026", "Round 3", "Michigan GV", "Dartmouth CG", null, null, null, null, false, null, 2027],
  ["qx7Xx_6exzk", "NDT 2022 - Finals - Dartmouth SV (Aff) vs Michigan PR (Neg)", "2022-04-05", "Jacob Wilkus", 23533, "NDT 2022 - Finals", 4, "NDT 2022", "Finals", "Dartmouth SV", "Michigan PR", null, null, null, null, true],
  ["toc2024pfF1", "TOC 2024 PF Finals - Strake Jesuit AB vs Lake Highland CD", "2024-04-28", "NSDA", 980, "100% of the vote", 2, "TOC 2024", "Finals", "Strake Jesuit AB", "Lake Highland CD", null, null, null, null, false],
  ["ldGlenbrook", "Glenbrooks 2023 LD Semis - Harvard-Westlake JS vs Greenhill KM", "2023-11-20", "LD Channel", 455, "semis", 3, "Glenbrooks 2023", "Semis", "Harvard-Westlake JS", "Greenhill KM", null, null, null, null, false],
  ["policyOld01", "Old Policy Round", "2008-02-01", "Archive", 50, "", 1, null, null, null, null, null, null, null, null, false],
  ["wsdWorlds01", "Worlds 2025 WSD Final - England vs Australia", "2025-08-01", "WSDC", 3000, "", 5, "Worlds 2025", "Finals", "England", "Australia", null, null, null, null, false],
] as unknown as VideoTuple[];

/** Lectures in a few categories, one also a round analysis. */
const LECTURES = [
  ["Afl7_hl-H0c", "2022 NDT Finals - Round Analysis Infographic", "2026-08-03", "d3v", 1, "Full Round: https://www.youtube.com/watch?v=qx7Xx_6exzk", "Round Analysis"],
  ["lecKritik01", "Kritik basics 100% explained_with_underscores", "2024-09-01", "Coach", 7000, "kritik lecture", "Kritiks"],
  ["lecKritik02", "Advanced kritik answers", "2025-01-01", "Coach", 300, "framework", "Kritiks"],
  ["lecWsd00001", "How to give a WSD reply speech", "2025-02-02", "WSDC", 900, "", "WSD"],
  ["lecNoCat001", "An untagged talk", "2025-03-03", "Coach", 42, "", null],
  ["lecMisc0001", "Filed as miscellaneous", "2025-03-04", "Coach", 11, "", "Miscellaneous"],
] as unknown as VideoTuple[];

const fixtureRows: VideoRow[] = (() => {
  const rows = buildVideoRows({
    rounds: [{ data: ROUNDS }],
    lectures: { data: LECTURES },
    topPicks: { data: ["lecKritik01"] },
  });
  // One two-member stack (round + its analysis) and one orphan whose partner
  // is gone, which must not come back as a stack.
  for (const row of rows) {
    if (row.videoId === "qx7Xx_6exzk") Object.assign(row, { stackKey: "qx7Xx_6exzk", stackPosition: 0 });
    if (row.videoId === "Afl7_hl-H0c") Object.assign(row, { stackKey: "qx7Xx_6exzk", stackPosition: 1 });
    if (row.videoId === "toc2024pfF1") Object.assign(row, { stackKey: "toc2024pfF1", stackPosition: 0 });
  }
  // An admin-picked format outranks the title; the seed leaves the column
  // alone, so `beforeAll` stores it in the database too.
  for (const row of rows) if (row.videoId === "demoPick001") row.demoStyle = 3;
  return rows;
})();

vi.mock("@debate-ai/webview/lib/videos/video-json-source", () => ({
  getVideoRowsFromJson: async () => fixtureRows,
}));

let db: ReturnType<typeof drizzle<typeof schema>>;
let dbAvailable = true;
vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => {
    if (!dbAvailable) throw new Error("no binding");
    return db;
  },
}));

const { seedVideosIntoDb } = await import("../seed-videos-to-db");
const repo = await import("../video-repository");

const ids = (tuples: VideoTuple[]) => tuples.map((t) => t[0]);

beforeAll(async () => {
  db = drizzle(await freshSchemaClient(), { schema });
  await seedVideosIntoDb(db);
  await db.update(videos).set({ demoStyle: 3 }).where(eq(videos.videoId, "demoPick001"));
});

describe("getVideoPage on the SQL backend", () => {
  const cases: Array<[string, VideoQueryParams]> = [
    ["everything, newest first", { source: "all" }],
    ["everything by views", { source: "all", sort: "Views" }],
    ["rounds only", { source: "round" }],
    ["lectures only", { source: "lecture" }],
    ["the lecturesOnly tab", { lecturesOnly: true }],
    ["top picks", { topPicksOnly: true }],
    ["one style", { style: 4 }],
    ["several styles", { styles: [2, 3] }],
    ["one season", { year: "2026" }],
    ["legacy season", { year: "legacy" }],
    ["a tournament name, any year", { tournament: "NDT" }],
    ["a category key", { categoryKey: "kritiks" }],
    ["the demo category", { categoryKey: "demo_debates" }],
    ["one demo format", { categoryKey: "demo_debates", style: 2 }],
    ["a demo format the admin picked", { categoryKey: "demo_debates", style: 3 }],
    ["several demo formats", { categoryKey: "demo_debates", styles: [1, 3] }],
    ["a demo format outside the demo category", { categoryKey: "kritiks", style: 2 }],
    ["a category that is also a style (WSD)", { categoryKey: "wsd" }],
    ["Miscellaneous, which also lists unsorted lectures", { categoryKey: "miscellaneous" }],
    ["a one-word search", { q: "michigan" }],
    ["a multi-word search (all tokens must match)", { q: "dartmouth finals" }],
    ["a search holding a LIKE wildcard", { q: "100%" }],
    ["a search holding an underscore", { q: "with_underscores" }],
    ["a competitor", { competitors: ["Michigan"] }],
    ["a competitor only in a title", { competitors: ["England"] }],
    ["ids", { ids: ["kyR3michDtm", "toc2024pfF1", "missing0000"] }],
    ["excluded ids", { excludeIds: ["kyR3michDtm", "qx7Xx_6exzk"] }],
    ["filters combined", { source: "round", style: 4, q: "michigan", sort: "Views" }],
  ];

  it.each(cases)("matches the JSON twin for %s", async (_label, params) => {
    const page = await repo.getVideoPage({ limit: 50, offset: 0, ...params });
    expect(page.backend).toBe("sql");
    const expected = queryVideoRows(fixtureRows, { limit: 50, offset: 0, ...params });
    expect(page.total).toBe(expected.total);
    expect(ids(page.videos)).toEqual(expected.rows.map((r) => r.videoId));
  });

  it("returns full tuples identical to the JSON backend's", async () => {
    const page = await repo.getVideoPage({ source: "all", ids: ["qx7Xx_6exzk"] });
    expect(page.videos[0]).toEqual(videoRowToTuple(fixtureRows.find((r) => r.videoId === "qx7Xx_6exzk")!));
  });

  it("paginates with hasMore and never goes below offset 0", async () => {
    const first = await repo.getVideoPage({ source: "all", limit: 4, offset: -10 });
    expect(first.offset).toBe(0);
    expect(first.videos).toHaveLength(4);
    expect(first.hasMore).toBe(true);

    const last = await repo.getVideoPage({ source: "all", limit: 8, offset: 8 });
    expect(last.videos).toHaveLength(fixtureRows.length - 8);
    expect(last.hasMore).toBe(false);
    expect(new Set([...ids(first.videos), ...ids(last.videos)]).size).toBe(first.videos.length + last.videos.length);
  });

  it("handles id lists past D1's bound-parameter limit", async () => {
    const many = [...Array.from({ length: 120 }, (_, i) => `pad${String(i).padStart(8, "0")}`), "toc2024pfF1"];
    const page = await repo.getVideoPage({ ids: many });
    expect(ids(page.videos)).toEqual(["toc2024pfF1"]);

    const excluded = await repo.getVideoPage({ excludeIds: many, limit: 50 });
    expect(excluded.total).toBe(fixtureRows.length - 1);
    expect(ids(excluded.videos)).not.toContain("toc2024pfF1");
  });

  it("computes facets that ignore their own dimension", async () => {
    const params: VideoQueryParams = { source: "all", style: 4, year: "2026" };
    const page = await repo.getVideoPage(params, true);
    expect(page.facets).toEqual(computeVideoFacets(fixtureRows, params));
  });

  it("counts a demo category's formats, guessed from titles or picked", async () => {
    for (const params of [
      { categoryKey: "demo_debates" },
      { categoryKey: "demo_debates", style: 2 },
      { categoryKey: "demo_debates", year: "2025" },
    ] as VideoQueryParams[]) {
      const page = await repo.getVideoPage({ source: "all", ...params }, true);
      expect(page.facets).toEqual(computeVideoFacets(fixtureRows, params));
    }
    const facets = (await repo.getVideoPage({ categoryKey: "demo_debates" }, true)).facets!;
    expect(facets.styleCounts).toEqual({ 1: 1, 2: 2, 3: 1 });
  });

  it("omits facets unless asked", async () => {
    expect((await repo.getVideoPage({ source: "all" })).facets).toBeUndefined();
  });
});

describe("getVideoMeta / getVideoSuggestions on the SQL backend", () => {
  it("counts the library the way the JSON fallback does", async () => {
    const meta = await repo.getVideoMeta();
    expect(meta.backend).toBe("sql");
    expect(meta.counts).toEqual({
      total: fixtureRows.length,
      rounds: fixtureRows.filter((r) => r.source === "round").length,
      lectures: fixtureRows.filter((r) => r.source === "lecture").length,
      lecturesOnly: filterVideoRows(fixtureRows, { lecturesOnly: true }).length,
      topPicks: fixtureRows.filter((r) => r.isTopPick).length,
      byStyle: fixtureRows.reduce<Record<number, number>>((acc, r) => {
        if (r.style != null) acc[r.style] = (acc[r.style] ?? 0) + 1;
        return acc;
      }, {}),
    });
  });

  it("builds the same lecture category cards, most-viewed first", async () => {
    const meta = await repo.getVideoMeta();
    const sortCards = <T extends { key: string }>(list: T[]) => [...list].sort((a, b) => a.key.localeCompare(b.key));
    expect(sortCards(meta.lectureCategories)).toEqual(sortCards(computeLectureCategories(fixtureRows)));
    const views = meta.lectureCategories.map((c) => c.maxViews);
    expect(views).toEqual([...views].sort((a, b) => b - a));
  });

  it("suggests the same keyword and tournament chips", async () => {
    const meta = await repo.getVideoMeta();
    expect(meta.suggestions).toEqual(computeVideoSuggestions(fixtureRows));
  });

  it("scopes suggestions to a category and ignores the typed search", async () => {
    const scoped = await repo.getVideoSuggestions({ style: 4, q: "kansas" });
    expect(scoped).toEqual(computeVideoSuggestions(filterVideoRows(fixtureRows, { style: 4 })));
  });
});

describe("getVideoIndex on the SQL backend", () => {
  it("returns the whole library on a first sync", async () => {
    const before = Date.now();
    const index = await repo.getVideoIndex(null);
    expect(index).toMatchObject({ partial: false, total: fixtureRows.length, backend: "sql" });
    expect(index.syncedAt).toBeGreaterThanOrEqual(before);
    expect(index.rows.map((r) => r[0]).sort()).toEqual(fixtureRows.map((r) => r.videoId).sort());
    const tuple = index.rows.find((r) => r[0] === "toc2024pfF1");
    expect(tuple).toEqual(videoRowToIndexTuple(fixtureRows.find((r) => r.videoId === "toc2024pfF1")!));
  });

  it("returns only rows changed since the cursor, with the true total", async () => {
    const future = new Date(Date.now() + 3_600_000);
    await db.update(videos).set({ updatedAt: future }).where(eq(videos.videoId, "lecKritik02"));
    const delta = await repo.getVideoIndex(Date.now() + 60_000);
    expect(delta.partial).toBe(true);
    expect(delta.rows.map((r) => r[0])).toEqual(["lecKritik02"]);
    expect(delta.total).toBe(fixtureRows.length);
  });

  it.each([0, -5, Number.NaN])("treats a cursor of %s as a first sync", async (since) => {
    const index = await repo.getVideoIndex(since);
    expect(index.partial).toBe(false);
    expect(index.rows).toHaveLength(fixtureRows.length);
  });
});

describe("getVideoStacks on the SQL backend", () => {
  it("returns each stack's members in stack order and drops single-member stacks", async () => {
    const page = await repo.getVideoStacks(["qx7Xx_6exzk", "toc2024pfF1", "qx7Xx_6exzk", "", "nope"]);
    expect(page.backend).toBe("sql");
    expect(Object.keys(page.stacks)).toEqual(["qx7Xx_6exzk"]);
    expect(ids(page.stacks.qx7Xx_6exzk)).toEqual(["qx7Xx_6exzk", "Afl7_hl-H0c"]);
  });

  it("answers no keys without a query", async () => {
    expect(await repo.getVideoStacks(["", ""])).toEqual({ stacks: {}, backend: "sql" });
  });
});

describe("single-video lookups on the SQL backend", () => {
  it("finds a video by id, and null for an unknown one", async () => {
    expect((await repo.getVideoById("ldGlenbrook"))?.[0]).toBe("ldGlenbrook");
    expect(await repo.getVideoById("zzzzzzzzzzz")).toBeNull();
  });

  it("finds a video by a bare 11-character id slug and by an id-suffixed slug", async () => {
    expect((await repo.getVideoBySlug("toc2024pfF1"))?.[0]).toBe("toc2024pfF1");
    expect((await repo.getVideoBySlug("anything-at-all-toc2024pfF1/"))?.[0]).toBe("toc2024pfF1");
  });

  it("returns null for an empty slug", async () => {
    expect(await repo.getVideoBySlug("  /")).toBeNull();
  });

  it("returns null for routes too short or too long to be a video", async () => {
    expect(await repo.resolveVideoRoute(["2026", "ndt"])).toBeNull();
    expect(await repo.resolveVideoRoute(Array.from({ length: 9 }, () => "x"))).toBeNull();
  });

  it("tolerates a malformed escape in a route segment", async () => {
    await expect(repo.resolveVideoRoute(["26-27", "%E0%A4%A", "nothing"])).resolves.toBeNull();
  });
});

describe("getRelatedVideos on the SQL backend", () => {
  it("leads with the same tournament across years, never repeats, and excludes the video itself", async () => {
    const watched = (await repo.getVideoById("uQ1-3BOv_6E"))!;
    const related = await repo.getRelatedVideos(watched, 5);
    const relatedIds = ids(related);
    expect(relatedIds).not.toContain("uQ1-3BOv_6E");
    expect(relatedIds[0]).toBe("qx7Xx_6exzk");
    expect(relatedIds).toHaveLength(5);
    expect(new Set(relatedIds).size).toBe(relatedIds.length);
  });

  it("tops a lecture up from its category, then the rest of the library", async () => {
    const watched = (await repo.getVideoById("lecKritik01"))!;
    const related = ids(await repo.getRelatedVideos(watched, 3));
    expect(related[0]).toBe("lecKritik02");
    expect(related).toHaveLength(3);
  });

  it("returns at most the library minus the video itself", async () => {
    const watched = (await repo.getVideoById("policyOld01"))!;
    expect(await repo.getRelatedVideos(watched, 100)).toHaveLength(fixtureRows.length - 1);
  });
});

describe("getVideoSitemapEntries on the SQL backend", () => {
  it("lists only available videos, each with its row's last change", async () => {
    await db.update(videos).set({ availability: "unavailable" }).where(eq(videos.videoId, "policyOld01"));
    const entries = await repo.getVideoSitemapEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.path.startsWith("/videos/") || isVideoRoundPath(e.path))).toBe(true);
    expect(entries.every((e) => e.lastModified instanceof Date)).toBe(true);
    const available = await db.select({ id: videos.videoId }).from(videos).where(eq(videos.availability, "available"));
    expect(entries).toHaveLength(available.length);
  });

  it("drops the tournament year from the path, like the watch page does", async () => {
    const entries = await repo.getVideoSitemapEntries();
    expect(entries.some((e) => /ndt-20\d\d/.test(e.path))).toBe(false);
  });
});

describe("falling back to the JSON assets", () => {
  it("answers from JSON, with null lastmods, when no database is reachable", async () => {
    dbAvailable = false;
    try {
      const page = await repo.getVideoPage({ source: "all", limit: 50 });
      expect(page.backend).toBe("json");
      expect(page.total).toBe(fixtureRows.length);
      const entries = await repo.getVideoSitemapEntries();
      expect(entries).toHaveLength(fixtureRows.length);
      expect(entries.every((e) => e.lastModified === null)).toBe(true);
      expect((await repo.getVideoIndex(Date.now())).partial).toBe(false);
      expect((await repo.getVideoStacks(["qx7Xx_6exzk"])).backend).toBe("json");
      expect((await repo.getVideoMeta()).backend).toBe("json");
    } finally {
      dbAvailable = true;
    }
  });
});
