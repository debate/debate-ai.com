/**
 * @fileoverview The admin video-library routes (`/api/admin/videos/library` and
 * `.../library/[id]`) against a real SQLite database and the real staff-access
 * check: only content editors may list, add, edit or delete; a hand-added video
 * is validated and cannot overwrite a published one; a delete leaves an
 * exclusion so a YouTube resync does not bring it back; and a busy database
 * answers 503 with a retry hint instead of a 500.
 */

import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
let dbError: Error | null = null;
let email: string | null = null;
const env: Record<string, string | undefined> = {};
const watch = vi.hoisted(() => ({ href: (_id: string, _title: string): string | null => null, fail: false }));

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => {
    if (dbError) throw dbError;
    return db;
  },
  getCloudflareContext: () => undefined,
}));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (email ? { user: { id: email, email, name: email }, session: {} } : null),
}));
vi.mock("@/lib/videos/video-repository", () => ({
  getVideoById: async (id: string) => {
    if (watch.fail) throw new Error("feed down");
    const [row] = await db.select().from(schema.videos).where(eq(schema.videos.videoId, id)).limit(1);
    return row ? { id, title: row.title } : null;
  },
}));
vi.mock("@debate-ai/videos", async (importActual) => ({
  ...(await importActual<typeof import("@debate-ai/videos")>()),
  videoRouteHref: (video: { id: string; title: string }) => watch.href(video.id, video.title),
}));

const list = await import("@/app/api/admin/videos/library/route");
const one = await import("@/app/api/admin/videos/library/[id]/route");

const ID = "aaaaaaaaaaa";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, url: string, body?: unknown) =>
  new NextRequest(`https://debate-ai.com${url}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

async function addVideo(videoId: string, fields: Partial<typeof schema.videos.$inferInsert> = {}) {
  await db.insert(schema.videos).values({ videoId, source: "lecture", title: `Title ${videoId}`, ...fields });
}

beforeEach(async () => {
  db = await freshSchemaDb();
  dbError = null;
  email = "editor@example.com";
  env.ADMIN_EMAILS = "editor@example.com";
  watch.href = (id, title) => `/videos/${id}/${title.toLowerCase().replace(/\W+/g, "-")}`;
  watch.fail = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("GET /api/admin/videos/library", () => {
  it("is for content editors only", async () => {
    email = null;
    expect((await list.GET(req("GET", "/api/admin/videos/library"))).status).toBe(403);
    email = "someone@example.com";
    expect((await list.GET(req("GET", "/api/admin/videos/library"))).status).toBe(403);
  });

  it("lists the published library with paging, search, source and style filters", async () => {
    await addVideo("aaaaaaaaaaa", { title: "Alpha lecture", publishedMs: 3 });
    await addVideo("bbbbbbbbbbb", { title: "Beta round", source: "round", style: 2, publishedMs: 2, searchText: "beta round" });
    await addVideo("ccccccccccc", { title: "Gamma lecture", publishedMs: 1 });

    const all = await (await list.GET(req("GET", "/api/admin/videos/library"))).json();
    expect(all.videos.map((v: { videoId: string }) => v.videoId)).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]);
    expect(all).toMatchObject({ page: 1, total: 3, pageCount: 1 });

    const paged = await (await list.GET(req("GET", "/api/admin/videos/library?limit=2&page=2&sort=published&dir=desc"))).json();
    expect(paged.videos.map((v: { videoId: string }) => v.videoId)).toEqual(["ccccccccccc"]);
    expect(paged).toMatchObject({ page: 2, pageCount: 2, total: 3 });

    const oldestFirst = await (await list.GET(req("GET", "/api/admin/videos/library?sort=published&dir=asc&limit=1"))).json();
    expect(oldestFirst.videos[0].videoId).toBe("ccccccccccc");

    const rounds = await (await list.GET(req("GET", "/api/admin/videos/library?style=2"))).json();
    expect(rounds.videos.map((v: { videoId: string }) => v.videoId)).toEqual(["bbbbbbbbbbb"]);

    const keyset = await (await list.GET(req("GET", "/api/admin/videos/library?sort=id&dir=asc&after=aaaaaaaaaaa"))).json();
    expect(keyset.videos.map((v: { videoId: string }) => v.videoId)).toEqual(["bbbbbbbbbbb", "ccccccccccc"]);
    expect(keyset.total).toBeNull();
  });

  it("filters on a typed-up transcript document, counting a blank one as none", async () => {
    await addVideo("aaaaaaaaaaa");
    await addVideo("bbbbbbbbbbb");
    await db.insert(schema.videoTranscripts).values({ videoId: "bbbbbbbbbbb", lang: "en", snippets: "[]" });
    await db.insert(schema.videoDocuments).values([
      { videoId: "aaaaaaaaaaa", kind: "transcript", body: "one two three", author: "editor", wordCount: 3 },
      { videoId: "bbbbbbbbbbb", kind: "transcript", body: "", author: "editor", wordCount: 0 },
    ]);
    const ids = async (query: string) =>
      (await (await list.GET(req("GET", `/api/admin/videos/library${query}`))).json()).videos.map((v: { videoId: string }) => v.videoId);

    expect(await ids("?transcript=with")).toEqual(["aaaaaaaaaaa"]);
    expect(await ids("?transcript=without")).toEqual(["bbbbbbbbbbb"]);
    const rows = (await (await list.GET(req("GET", "/api/admin/videos/library?sort=id&dir=asc"))).json()).videos;
    expect(rows.map((v: { transcriptWords: number | null; hasCaptions: boolean }) => [v.transcriptWords, v.hasCaptions])).toEqual([
      [3, false],
      [null, true],
    ]);
  });

  it("answers 503 with Retry-After when the database is overloaded, and 500 on any other fault", async () => {
    dbError = Object.assign(new Error("session gone"), { name: "SessionUnavailableError" });
    const busy = await list.GET(req("GET", "/api/admin/videos/library"));
    expect(busy.status).toBe(503);
    expect(busy.headers.get("Retry-After")).toBeTruthy();
    expect(await busy.json()).toMatchObject({ busy: true });

    dbError = new Error("boom");
    const broken = await list.GET(req("GET", "/api/admin/videos/library"));
    expect(broken.status).toBe(500);
    expect(await broken.json()).toMatchObject({ error: "Failed to load videos" });
  });
});

describe("POST /api/admin/videos/library", () => {
  it("is for content editors only", async () => {
    email = "someone@example.com";
    expect((await list.POST(req("POST", "/api/admin/videos/library", { videoId: ID, title: "T" }))).status).toBe(403);
    expect(await db.select().from(schema.videos)).toEqual([]);
  });

  it("rejects a malformed body, a non-object body and a bad video id", async () => {
    expect((await list.POST(req("POST", "/api/admin/videos/library", "{not json"))).status).toBe(400);
    expect((await list.POST(req("POST", "/api/admin/videos/library", "[1]"))).status).toBe(400);
    expect((await list.POST(req("POST", "/api/admin/videos/library", "null"))).status).toBe(400);
    const bad = await list.POST(req("POST", "/api/admin/videos/library", { videoId: "short", title: "T" }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "`videoId` must be a YouTube video id" });
    expect((await list.POST(req("POST", "/api/admin/videos/library", { title: "No id" }))).status).toBe(400);
  });

  it("requires a title", async () => {
    const res = await list.POST(req("POST", "/api/admin/videos/library", { videoId: ID, title: "   " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "A title is required." });
  });

  it("adds a lecture, or a round when the form gives a style, and clears an old exclusion", async () => {
    await db.insert(schema.youtubeVideoExclusions).values({ videoId: ID, deletedBy: "x", deletedAt: new Date() });

    const lecture = await list.POST(req("POST", "/api/admin/videos/library", { videoId: ID, title: " New lecture ", channel: "Chan", publishedAt: "2025-03-04" }));
    expect(lecture.status).toBe(201);
    const { video } = await lecture.json();
    expect(video).toMatchObject({ videoId: ID, title: "New lecture", source: "lecture", channel: "Chan" });
    expect(video.publishedMs).toBeGreaterThan(0);
    expect(video.searchText).toContain("new lecture");
    expect(await db.select().from(schema.youtubeVideoExclusions)).toEqual([]);

    const round = await list.POST(req("POST", "/api/admin/videos/library", { videoId: "bbbbbbbbbbb", title: "A round", style: 2 }));
    expect((await round.json()).video).toMatchObject({ source: "round", style: 2 });
  });

  it("will not overwrite a published video", async () => {
    await addVideo(ID, { title: "Original" });
    const res = await list.POST(req("POST", "/api/admin/videos/library", { videoId: ID, title: "Replacement" }));
    expect(res.status).toBe(409);
    expect((await db.select().from(schema.videos))[0].title).toBe("Original");
  });

  it("answers 500 when the write fails", async () => {
    dbError = new Error("boom");
    const res = await list.POST(req("POST", "/api/admin/videos/library", { videoId: ID, title: "T" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Failed to add video", details: expect.any(String) });
  });
});

describe("GET /api/admin/videos/library/[id]", () => {
  it("is open to everyone and returns the stored row", async () => {
    email = null;
    await addVideo(ID, { title: "Public" });
    const res = await one.GET(req("GET", "/x"), ctx(ID));
    expect(res.status).toBe(200);
    expect((await res.json()).video).toMatchObject({ videoId: ID, title: "Public" });
  });

  it("404s for an unknown video and 500s on a database fault", async () => {
    expect((await one.GET(req("GET", "/x"), ctx("zzzzzzzzzzz"))).status).toBe(404);
    dbError = new Error("boom");
    expect((await one.GET(req("GET", "/x"), ctx(ID))).status).toBe(500);
  });
});

describe("PATCH /api/admin/videos/library/[id]", () => {
  it("is for content editors only", async () => {
    await addVideo(ID);
    email = "someone@example.com";
    expect((await one.PATCH(req("PATCH", "/x", { title: "Hacked" }), ctx(ID))).status).toBe(403);
    expect((await db.select().from(schema.videos))[0].title).toBe(`Title ${ID}`);
  });

  it("rejects a malformed or non-object body", async () => {
    await addVideo(ID);
    expect((await one.PATCH(req("PATCH", "/x", "{oops"), ctx(ID))).status).toBe(400);
    expect((await one.PATCH(req("PATCH", "/x", "[]"), ctx(ID))).status).toBe(400);
    expect((await one.PATCH(req("PATCH", "/x", "null"), ctx(ID))).status).toBe(400);
  });

  it("writes only the fields sent, keeps search text in step, and reports the old and new watch-page address", async () => {
    await addVideo(ID, { title: "Old title", channel: "Chan", description: "About" });
    const res = await one.PATCH(req("PATCH", "/x", { title: "New title", viewCount: "42" }), ctx(ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      previousHref: `/videos/${ID}/old-title`,
      href: `/videos/${ID}/new-title`,
      video: { title: "New title", channel: "Chan", description: "About", viewCount: 42 },
    });
    expect(body.video.searchText).toBe("new title chan about");
  });

  it("still saves when the watch-page address cannot be built", async () => {
    await addVideo(ID);
    watch.fail = true;
    const res = await one.PATCH(req("PATCH", "/x", { title: "Fine" }), ctx(ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, href: null, previousHref: null, video: { title: "Fine" } });
  });

  it("404s for an unknown video and 500s on a database fault", async () => {
    expect((await one.PATCH(req("PATCH", "/x", { title: "T" }), ctx("zzzzzzzzzzz"))).status).toBe(404);
    dbError = new Error("boom");
    expect((await one.PATCH(req("PATCH", "/x", { title: "T" }), ctx(ID))).status).toBe(500);
  });
});

describe("DELETE /api/admin/videos/library/[id]", () => {
  it("is for content editors only", async () => {
    await addVideo(ID);
    email = "someone@example.com";
    expect((await one.DELETE(req("DELETE", "/x"), ctx(ID))).status).toBe(403);
    expect(await db.select().from(schema.videos)).toHaveLength(1);
  });

  it("removes the video and records who removed it, so a resync does not republish it", async () => {
    await addVideo(ID);
    const res = await one.DELETE(req("DELETE", "/x"), ctx(ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: ID });
    expect(await db.select().from(schema.videos)).toEqual([]);
    expect(await db.select().from(schema.youtubeVideoExclusions)).toMatchObject([{ videoId: ID, deletedBy: "editor@example.com" }]);
  });

  it("404s without leaving an exclusion for an unknown video, and 500s on a database fault", async () => {
    expect((await one.DELETE(req("DELETE", "/x"), ctx("zzzzzzzzzzz"))).status).toBe(404);
    expect(await db.select().from(schema.youtubeVideoExclusions)).toEqual([]);
    dbError = new Error("boom");
    expect((await one.DELETE(req("DELETE", "/x"), ctx(ID))).status).toBe(500);
  });
});
