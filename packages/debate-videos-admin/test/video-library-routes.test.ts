/**
 * @fileoverview The staff video-library routes — the published library
 * listing and add form, one video's edit/delete, its linked videos and its
 * documents — run against a real in-memory database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { staffRoles, videoDocuments, videoRelations, videos, youtubeVideoExclusions } from "@/lib/database/schema";
import { ADMIN, MODERATOR, access } from "./helpers/access";
import { freshDb, params, request, type DB } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./helpers/access")).contextMock,
}));

const library = await import("../src/api/admin/videos/library");
const video = await import("../src/api/admin/videos/library/[id]");
const related = await import("../src/api/admin/videos/library/[id]/related");
const documents = await import("../src/api/admin/videos/library/[id]/documents");

const ROUND = "roundAAAAAA";
const ANALYSIS = "analysisBBB";
const OTHER = "otherCCCCCC";

let db: DB;

async function seedVideo(videoId: string, title: string, extra: Partial<typeof videos.$inferInsert> = {}) {
  await db.insert(videos).values({ videoId, source: "round", title, searchText: title.toLowerCase(), ...extra });
}

beforeEach(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  db = await freshDb();
  access.db = db;
  access.email = ADMIN;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const broken = {
  select: () => {
    throw new Error("D1 down");
  },
  insert: () => {
    throw new Error("D1 down");
  },
  update: () => {
    throw new Error("D1 down");
  },
  delete: () => {
    throw new Error("D1 down");
  },
};

describe("/api/admin/videos/library", () => {
  it("lists published videos with filters", async () => {
    await seedVideo(ROUND, "Harvard Finals", { style: 1 });
    await seedVideo(OTHER, "Lecture on theory", { source: "lecture" });
    const res = await library.GET(request("/api/admin/videos/library?q=harvard&style=1&dir=asc&page=1&limit=10"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.videos.map((row: { videoId: string }) => row.videoId)).toEqual([ROUND]);
  });

  it("adds a video by hand, and refuses a duplicate", async () => {
    await db.insert(youtubeVideoExclusions).values({ videoId: OTHER });
    const add = (body: unknown) => library.POST(request("/api/admin/videos/library", { method: "POST", body }));

    const res = await add({ videoId: OTHER, title: "New lecture" });
    expect(res.status).toBe(201);
    expect((await res.json()).video).toMatchObject({ videoId: OTHER, title: "New lecture", source: "lecture" });
    // Adding back a removed video lifts its exclusion.
    expect(await db.select().from(youtubeVideoExclusions)).toEqual([]);

    expect((await add({ videoId: OTHER, title: "Again" })).status).toBe(409);
  });

  it.each([
    ["not JSON", "{"],
    ["an array", [1]],
    ["a bad id", { videoId: "short", title: "x" }],
    ["no title", { videoId: OTHER }],
  ])("rejects %s", async (_label, body) => {
    expect((await library.POST(request("/api/admin/videos/library", { method: "POST", body }))).status).toBe(400);
  });

  it("is staff-only, and moderators count", async () => {
    access.email = "viewer@example.com";
    expect((await library.GET(request("/api/admin/videos/library"))).status).toBe(403);
    expect((await library.POST(request("/api/admin/videos/library", { method: "POST", body: {} }))).status).toBe(403);

    await db.insert(staffRoles).values({ email: MODERATOR, role: "moderator", createdAt: new Date() });
    access.email = MODERATOR;
    expect((await library.GET(request("/api/admin/videos/library"))).status).toBe(200);
  });

  it("answers 500 when the database fails", async () => {
    // Access is decided before the broken handle is used.
    access.db = broken;
    expect((await library.GET(request("/api/admin/videos/library"))).status).toBe(500);
    expect(
      (await library.POST(request("/api/admin/videos/library", { method: "POST", body: { videoId: OTHER, title: "x" } })))
        .status,
    ).toBe(500);
  });
});

describe("/api/admin/videos/library/[id]", () => {
  const ctx = params({ id: ROUND });

  it("reads a video for anyone", async () => {
    await seedVideo(ROUND, "Harvard Finals");
    access.email = null;
    const res = await video.GET(request(`/api/admin/videos/library/${ROUND}`), ctx);
    expect((await res.json()).video).toMatchObject({ videoId: ROUND, title: "Harvard Finals" });
    expect((await video.GET(request("/x"), params({ id: OTHER }))).status).toBe(404);
  });

  it("edits a video and marks it admin-edited", async () => {
    await seedVideo(ROUND, "Harvard Finals");
    const res = await video.PATCH(request(`/x`, { method: "PATCH", body: { title: "Harvard Final Round" } }), ctx);
    expect((await res.json()).video).toMatchObject({ title: "Harvard Final Round", adminEdited: true });
    expect((await video.PATCH(request(`/x`, { method: "PATCH", body: { title: "y" } }), params({ id: OTHER }))).status).toBe(404);
  });

  it.each([["not JSON", "{"], ["an array", []], ["null", "null"]])("rejects an edit body that is %s", async (_label, body) => {
    expect((await video.PATCH(request(`/x`, { method: "PATCH", body }), ctx)).status).toBe(400);
  });

  it("deletes a video and excludes it from the resync", async () => {
    await seedVideo(ROUND, "Harvard Finals");
    const res = await video.DELETE(request(`/x`, { method: "DELETE" }), ctx);
    expect(await res.json()).toEqual({ ok: true, id: ROUND });
    expect(await db.select().from(videos)).toEqual([]);
    expect((await db.select().from(youtubeVideoExclusions)).map((row) => row.videoId)).toEqual([ROUND]);
    expect((await video.DELETE(request(`/x`, { method: "DELETE" }), ctx)).status).toBe(404);
  });

  it("keeps writes staff-only", async () => {
    access.email = "viewer@example.com";
    expect((await video.PATCH(request(`/x`, { method: "PATCH", body: {} }), ctx)).status).toBe(403);
    expect((await video.DELETE(request(`/x`, { method: "DELETE" }), ctx)).status).toBe(403);
  });

  it("answers 500 when the database fails", async () => {
    access.db = broken;
    expect((await video.GET(request(`/x`), ctx)).status).toBe(500);
    expect((await video.PATCH(request(`/x`, { method: "PATCH", body: { title: "x" } }), ctx)).status).toBe(500);
    expect((await video.DELETE(request(`/x`, { method: "DELETE" }), ctx)).status).toBe(500);
  });
});

describe("/api/admin/videos/library/[id]/related", () => {
  const ctx = params({ id: ROUND });
  const link = (body: unknown) => related.POST(request("/x", { method: "POST", body }), ctx);

  it("links, lists, reorders and unlinks videos", async () => {
    expect(await (await link({ relatedVideoId: ANALYSIS, note: "  Coach breakdown " })).json()).toMatchObject({
      ok: true,
      relation: { videoId: ROUND, relatedVideoId: ANALYSIS, relation: "analysis", note: "Coach breakdown", createdBy: ADMIN },
    });
    await link({ relatedVideoId: OTHER, relation: "rematch" });

    const listed = await (await related.GET(request("/x"), ctx)).json();
    expect(listed.relations.map((row: { relatedVideoId: string }) => row.relatedVideoId)).toEqual([ANALYSIS, OTHER]);

    const reordered = await (
      await related.PATCH(request("/x", { method: "PATCH", body: { order: [OTHER, ANALYSIS, 7] } }), ctx)
    ).json();
    expect(reordered.relations.map((row: { relatedVideoId: string }) => row.relatedVideoId)).toEqual([OTHER, ANALYSIS]);

    const removed = await related.DELETE(request(`/x?relatedVideoId=${OTHER}&relation=rematch`, { method: "DELETE" }), ctx);
    expect(await removed.json()).toEqual({ ok: true, relatedVideoId: OTHER, relation: "rematch" });
    expect(await db.select().from(videoRelations)).toHaveLength(1);
    expect((await related.DELETE(request(`/x?relatedVideoId=${OTHER}`, { method: "DELETE" }), ctx)).status).toBe(404);
  });

  it("falls back to an analysis link for an unknown relation", async () => {
    expect((await (await link({ relatedVideoId: ANALYSIS, relation: "cousin" })).json()).relation.relation).toBe("analysis");
  });

  it.each([
    ["not JSON", "{"],
    ["a bad id", { relatedVideoId: "nope" }],
    ["a link to itself", { relatedVideoId: ROUND }],
  ])("rejects %s", async (_label, body) => {
    expect((await link(body)).status).toBe(400);
  });

  it("rejects a bad reorder or unlink", async () => {
    expect((await related.PATCH(request("/x", { method: "PATCH", body: "{" }), ctx)).status).toBe(400);
    expect((await related.PATCH(request("/x", { method: "PATCH", body: { order: "x" } }), ctx)).status).toBe(400);
    expect((await related.DELETE(request("/x?relatedVideoId=bad", { method: "DELETE" }), ctx)).status).toBe(400);
  });

  it("is staff-only", async () => {
    access.email = null;
    expect((await related.GET(request("/x"), ctx)).status).toBe(403);
    expect((await link({ relatedVideoId: ANALYSIS })).status).toBe(403);
    expect((await related.PATCH(request("/x", { method: "PATCH", body: { order: [] } }), ctx)).status).toBe(403);
    expect((await related.DELETE(request(`/x?relatedVideoId=${ANALYSIS}`, { method: "DELETE" }), ctx)).status).toBe(403);
  });

  it("answers 500 when the database fails", async () => {
    access.db = broken;
    expect((await related.GET(request("/x"), ctx)).status).toBe(500);
    expect((await link({ relatedVideoId: ANALYSIS })).status).toBe(500);
    expect((await related.PATCH(request("/x", { method: "PATCH", body: { order: [ANALYSIS] } }), ctx)).status).toBe(500);
    expect((await related.DELETE(request(`/x?relatedVideoId=${ANALYSIS}`, { method: "DELETE" }), ctx)).status).toBe(500);
  });
});

describe("/api/admin/videos/library/[id]/documents", () => {
  const ctx = params({ id: ROUND });
  const put = (body: unknown) => documents.PUT(request("/x", { method: "PUT", body }), ctx);

  it("saves, lists, replaces and deletes a document", async () => {
    const saved = await (await put({ kind: "summary", title: "Recap", body: "Aff won on T.", model: "m1", author: 3 })).json();
    expect(saved).toMatchObject({ ok: true, document: { kind: "summary", title: "Recap", body: "Aff won on T." } });

    await put({ kind: "summary", body: "Neg won." });
    const [row] = await db.select().from(videoDocuments).where(eq(videoDocuments.videoId, ROUND));
    expect(row.body).toBe("Neg won.");

    const listed = await (await documents.GET(request("/x"), ctx)).json();
    expect(listed.documents).toHaveLength(1);

    expect(await (await documents.DELETE(request("/x?kind=summary", { method: "DELETE" }), ctx)).json()).toEqual({
      ok: true,
      kind: "summary",
    });
    expect((await documents.DELETE(request("/x?kind=summary", { method: "DELETE" }), ctx)).status).toBe(404);
  });

  it("validates the kind and length", async () => {
    expect((await put("{")).status).toBe(400);
    expect((await put({ kind: "poem", body: "x" })).status).toBe(400);
    expect((await put({ kind: "transcript", body: "x".repeat(400_001) })).status).toBe(413);
    expect((await documents.DELETE(request("/x?kind=poem", { method: "DELETE" }), ctx)).status).toBe(400);
  });

  it("is staff-only", async () => {
    access.email = null;
    expect((await documents.GET(request("/x"), ctx)).status).toBe(403);
    expect((await put({ kind: "summary" })).status).toBe(403);
    expect((await documents.DELETE(request("/x?kind=summary", { method: "DELETE" }), ctx)).status).toBe(403);
  });

  it("answers 500 when a write fails, and lists nothing when reads fail", async () => {
    access.db = broken;
    // A missing table means "no documents yet", not an error.
    expect(await (await documents.GET(request("/x"), ctx)).json()).toEqual({ documents: [] });
    expect((await put({ kind: "summary", body: "x" })).status).toBe(500);
    expect((await documents.DELETE(request("/x?kind=summary", { method: "DELETE" }), ctx)).status).toBe(500);
  });
});
