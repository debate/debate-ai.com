/**
 * @fileoverview A video's side-panel content — its long-form documents and the
 * videos an editor has linked to it — through `lib/videos/video-content` and
 * the two admin routes that write it, against a real SQLite database with the
 * real staff-access check: only staff may touch either, bodies are bounded,
 * word counts are derived server-side, and a link can't point at its own video.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db | null;
let email: string | null = null;
const env: Record<string, string | undefined> = {};
const feed = vi.hoisted(() => ({ ids: [] as string[][], videos: [] as string[] }));

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => {
    if (!db) throw new Error("no database");
    return db;
  },
  getCloudflareContext: () => undefined,
}));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (email ? { user: { id: email, email, name: email }, session: {} } : null),
}));
vi.mock("@/lib/videos/video-repository", () => ({
  getVideoPage: async ({ ids }: { ids: string[] }) => {
    feed.ids.push(ids);
    return { videos: feed.videos.filter((id) => ids.includes(id)).map((id) => [id, `Title ${id}`]) };
  },
}));

const content = await import("@/lib/videos/video-content");
const documents = await import("@/app/api/admin/videos/library/[id]/documents/route");
const related = await import("@/app/api/admin/videos/library/[id]/related/route");

const WATCHED = "aaaaaaaaaaa";
const ROUND = "bbbbbbbbbbb";
const OTHER = "ccccccccccc";

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`https://debate-ai.com${url}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  db = await freshSchemaDb();
  email = "boss@example.com";
  env.ADMIN_EMAILS = "boss@example.com";
  feed.ids = [];
  feed.videos = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("video documents", () => {
  it("counts words without the markdown heading markers, and updates a document in place", async () => {
    const first = await content.saveVideoDocument(db, WATCHED, "transcript", { body: "## 1AC\nOne two three", title: " Transcript " }, "boss@example.com");
    expect(first).toMatchObject({ videoId: WATCHED, kind: "transcript", title: "Transcript", author: "editor", wordCount: 4 });

    const second = await content.saveVideoDocument(db, WATCHED, "transcript", { body: "Just two", author: "ai", model: "gpt" }, null);
    expect(second).toMatchObject({ title: null, author: "ai", model: "gpt", wordCount: 2 });
    expect(await db!.select().from(schema.videoDocuments)).toHaveLength(1);
  });

  it("reads back only the documents of a recognised kind, and nothing when there is no database or table", async () => {
    await content.saveVideoDocument(db, WATCHED, "summary", { body: "S" }, null);
    await db!.insert(schema.videoDocuments).values({ videoId: WATCHED, kind: "mystery", body: "?", author: "x", wordCount: 1 });
    expect((await content.getVideoDocuments(WATCHED)).map((doc) => doc.kind)).toEqual(["summary"]);
    expect(await content.getVideoDocuments(OTHER)).toEqual([]);

    await db!.$client.execute("DROP TABLE video_documents");
    expect(await content.getVideoDocuments(WATCHED)).toEqual([]);
    db = null;
    expect(await content.getVideoDocuments(WATCHED)).toEqual([]);
    expect(await content.getLinkedVideos(WATCHED)).toEqual([]);
  });

  it("reports whether a delete removed anything", async () => {
    await content.saveVideoDocument(db, WATCHED, "analysis", { body: "A" }, null);
    expect(await content.deleteVideoDocument(db, WATCHED, "analysis")).toBe(true);
    expect(await content.deleteVideoDocument(db, WATCHED, "analysis")).toBe(false);
  });
});

describe("video relations", () => {
  it("appends links in order, refuses a self-link, and updates the note of a repeated link", async () => {
    await content.addVideoRelation(db, WATCHED, ROUND, "analysis", null, "boss@example.com");
    const second = await content.addVideoRelation(db, WATCHED, OTHER, "related", "see also", null);
    expect(second).toMatchObject({ relatedVideoId: OTHER, position: 1, note: "see also" });
    await expect(content.addVideoRelation(db, WATCHED, WATCHED, "analysis", null, null)).rejects.toThrow("itself");

    const again = await content.addVideoRelation(db, WATCHED, OTHER, "related", "edited", null);
    expect(again?.note).toBe("edited");
    expect(await content.listVideoRelations(db, WATCHED)).toHaveLength(2);
  });

  it("reorders only the links that exist, and removes one link at a time", async () => {
    for (const id of [ROUND, OTHER]) await content.addVideoRelation(db, WATCHED, id, "analysis", null, null);
    await content.reorderVideoRelations(db, WATCHED, [OTHER, "zzzzzzzzzzz", ROUND]);
    expect((await content.listVideoRelations(db, WATCHED)).map((row: { relatedVideoId: string }) => row.relatedVideoId)).toEqual([OTHER, ROUND]);
    await content.reorderVideoRelations(db, WATCHED, []);

    expect(await content.removeVideoRelation(db, WATCHED, ROUND, "related")).toBe(false);
    expect(await content.removeVideoRelation(db, WATCHED, ROUND, "analysis")).toBe(true);
    expect(await content.listVideoRelations(db, WATCHED)).toHaveLength(1);
  });

  it("serves linked videos in the editor's order and drops links whose target left the library", async () => {
    for (const id of [ROUND, OTHER, "ddddddddddd"]) await content.addVideoRelation(db, WATCHED, id, "analysis", id === OTHER ? "why" : null, null);
    await content.reorderVideoRelations(db, WATCHED, [OTHER, "ddddddddddd", ROUND]);
    feed.videos = [ROUND, OTHER];

    const links = await content.getLinkedVideos(WATCHED);
    expect(links.map((link) => [link.video[0], link.relation, link.note])).toEqual([
      [OTHER, "analysis", "why"],
      [ROUND, "analysis", null],
    ]);
    expect(feed.ids[0].sort()).toEqual([ROUND, OTHER, "ddddddddddd"].sort());
    expect(await content.getLinkedVideos(OTHER)).toEqual([]);

    const panel = await content.getVideoSidePanelContent(WATCHED);
    expect(panel.links).toHaveLength(2);
    expect(panel.documents).toEqual([]);
  });
});

describe("/api/admin/videos/library/[id]/documents", () => {
  it("is staff-only", async () => {
    for (const who of [null, "someone@example.com"]) {
      email = who;
      expect((await documents.GET(req("/d", "GET"), ctx(WATCHED))).status).toBe(403);
      expect((await documents.PUT(req("/d", "PUT", { kind: "summary" }), ctx(WATCHED))).status).toBe(403);
      expect((await documents.DELETE(req("/d?kind=summary", "DELETE"), ctx(WATCHED))).status).toBe(403);
    }
  });

  it("validates the kind and bounds the body", async () => {
    expect((await documents.PUT(req("/d", "PUT", "{nope"), ctx(WATCHED))).status).toBe(400);
    expect((await documents.PUT(req("/d", "PUT", { kind: "essay", body: "x" }), ctx(WATCHED))).status).toBe(400);
    const tooLong = await documents.PUT(req("/d", "PUT", { kind: "summary", body: "x".repeat(400_001) }), ctx(WATCHED));
    expect(tooLong.status).toBe(413);
    expect((await tooLong.json()).error).toContain("400001 of 400000");
    expect((await documents.DELETE(req("/d?kind=essay", "DELETE"), ctx(WATCHED))).status).toBe(400);
    expect(await db!.select().from(schema.videoDocuments)).toEqual([]);
  });

  it("saves, lists and deletes a document, ignoring fields of the wrong type", async () => {
    const saved = await documents.PUT(
      req("/d", "PUT", { kind: "analysis", body: "## Overview\nA B C", title: 5, author: "ai", model: null }),
      ctx(WATCHED),
    );
    expect((await saved.json()).document).toMatchObject({ kind: "analysis", title: null, author: "ai", wordCount: 4 });
    const [row] = await db!.select().from(schema.videoDocuments);
    expect(row.updatedBy).toBe("boss@example.com");

    const listed = await (await documents.GET(req("/d", "GET"), ctx(WATCHED))).json();
    expect(listed.documents).toHaveLength(1);

    expect(await (await documents.DELETE(req("/d?kind=analysis", "DELETE"), ctx(WATCHED))).json()).toEqual({ ok: true, kind: "analysis" });
    expect((await documents.DELETE(req("/d?kind=analysis", "DELETE"), ctx(WATCHED))).status).toBe(404);
  });

  it("answers 500 with the database's reason when a write fails", async () => {
    await db!.$client.execute("DROP TABLE video_documents");
    const res = await documents.PUT(req("/d", "PUT", { kind: "summary", body: "x" }), ctx(WATCHED));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Failed to save document" });
    expect((await documents.DELETE(req("/d?kind=summary", "DELETE"), ctx(WATCHED))).status).toBe(500);
  });
});

describe("/api/admin/videos/library/[id]/related", () => {
  it("is staff-only", async () => {
    email = "someone@example.com";
    expect((await related.GET(req("/r", "GET"), ctx(WATCHED))).status).toBe(403);
    expect((await related.POST(req("/r", "POST", { relatedVideoId: ROUND }), ctx(WATCHED))).status).toBe(403);
    expect((await related.PATCH(req("/r", "PATCH", { order: [] }), ctx(WATCHED))).status).toBe(403);
    expect((await related.DELETE(req(`/r?relatedVideoId=${ROUND}`, "DELETE"), ctx(WATCHED))).status).toBe(403);
  });

  it("validates the link before writing it", async () => {
    expect((await related.POST(req("/r", "POST", "{nope"), ctx(WATCHED))).status).toBe(400);
    expect((await related.POST(req("/r", "POST", { relatedVideoId: "short" }), ctx(WATCHED))).status).toBe(400);
    const self = await related.POST(req("/r", "POST", { relatedVideoId: WATCHED }), ctx(WATCHED));
    expect(self.status).toBe(400);
    expect((await self.json()).error).toBe("A video cannot be linked to itself");
    expect(await db!.select().from(schema.videoRelations)).toEqual([]);
  });

  it("links, lists, reorders and unlinks, defaulting an unknown relation to analysis", async () => {
    const linked = await related.POST(
      req("/r", "POST", { relatedVideoId: ` ${ROUND} `, relation: "bogus", note: "  the round  " }),
      ctx(WATCHED),
    );
    expect((await linked.json()).relation).toMatchObject({ relatedVideoId: ROUND, relation: "analysis", note: "the round", createdBy: "boss@example.com" });
    await related.POST(req("/r", "POST", { relatedVideoId: OTHER, relation: "rematch", note: "   " }), ctx(WATCHED));

    const reordered = await related.PATCH(req("/r", "PATCH", { order: [OTHER, 7, ROUND] }), ctx(WATCHED));
    expect((await reordered.json()).relations.map((row: { relatedVideoId: string }) => row.relatedVideoId)).toEqual([OTHER, ROUND]);
    expect((await related.PATCH(req("/r", "PATCH", { order: "nope" }), ctx(WATCHED))).status).toBe(400);
    expect((await related.PATCH(req("/r", "PATCH", "{nope"), ctx(WATCHED))).status).toBe(400);

    expect((await (await related.GET(req("/r", "GET"), ctx(WATCHED))).json()).relations).toHaveLength(2);

    expect((await related.DELETE(req("/r?relatedVideoId=bad", "DELETE"), ctx(WATCHED))).status).toBe(400);
    expect((await related.DELETE(req(`/r?relatedVideoId=${ROUND}&relation=rematch`, "DELETE"), ctx(WATCHED))).status).toBe(404);
    const removed = await related.DELETE(req(`/r?relatedVideoId=${ROUND}`, "DELETE"), ctx(WATCHED));
    expect(await removed.json()).toEqual({ ok: true, relatedVideoId: ROUND, relation: "analysis" });
    expect(await db!.select().from(schema.videoRelations)).toHaveLength(1);
  });

  it("answers 500 with the database's reason when a query fails", async () => {
    await db!.$client.execute("DROP TABLE video_relations");
    expect((await related.GET(req("/r", "GET"), ctx(WATCHED))).status).toBe(500);
    expect((await related.POST(req("/r", "POST", { relatedVideoId: ROUND }), ctx(WATCHED))).status).toBe(500);
    expect((await related.PATCH(req("/r", "PATCH", { order: [ROUND] }), ctx(WATCHED))).status).toBe(500);
    expect((await related.DELETE(req(`/r?relatedVideoId=${ROUND}`, "DELETE"), ctx(WATCHED))).status).toBe(500);
  });
});
