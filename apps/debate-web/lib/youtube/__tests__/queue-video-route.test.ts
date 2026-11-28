/**
 * @fileoverview `/api/admin/youtube/videos/[id]` — the per-row actions on the
 * YouTube resync queue — against a real SQLite database and the real staff
 * check: publish moves a queued video into the public library and out of the
 * queue, delete drops it and excludes it from future scans, and edit writes
 * only the fields the dialog sent.
 */

import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
let email: string | null = null;
const env: Record<string, string | undefined> = {};

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => undefined }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (email ? { user: { id: email, email, name: email }, session: {} } : null),
}));

const route = await import("@/app/api/admin/youtube/videos/[id]/route");

const ID = "aaaaaaaaaaa";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown) =>
  new NextRequest("https://debate-ai.com/api/admin/youtube/videos/x", {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

async function queue(id = ID, extra: Partial<typeof schema.youtubeRoundVideos.$inferInsert> = {}) {
  await db.insert(schema.youtubeRoundVideos).values({
    id,
    title: "2026 Harvard Quarters",
    publishedAt: "2026-02-14",
    channel: "Debate Rounds",
    views: 10,
    description: "A round",
    style: 1,
    aff: "Harker AB",
    neg: "Lex CD",
    ...extra,
  });
}

const queued = () => db.select().from(schema.youtubeRoundVideos);
const published = () => db.select().from(schema.videos);

beforeEach(async () => {
  db = await freshSchemaDb();
  email = "editor@example.com";
  env.ADMIN_EMAILS = "editor@example.com";
});

describe("content editors only", () => {
  it.each(["POST", "DELETE", "PATCH"] as const)("%s answers 403 to everyone else and changes nothing", async (method) => {
    await queue();
    const handler = route[method];
    email = null;
    expect((await handler(req(method, {}), ctx(ID))).status).toBe(403);
    email = "someone@example.com";
    expect((await handler(req(method, {}), ctx(ID))).status).toBe(403);
    expect(await queued()).toHaveLength(1);
    expect(await published()).toEqual([]);
  });
});

describe("POST (publish)", () => {
  it("publishes a queued round into the library and removes it from the queue", async () => {
    await queue(ID, { style: 2, tournament: "Harvard 2026" });
    const res = await route.POST(req("POST"), ctx(ID));
    expect(await res.json()).toEqual({ ok: true, id: ID });

    expect(await queued()).toEqual([]);
    const [video] = await published();
    expect(video).toMatchObject({ videoId: ID, source: "round", title: "2026 Harvard Quarters", style: 2, affTeam: "Harker AB", negTeam: "Lex CD", viewCount: 10 });
    expect(video.searchText).toBe("2026 harvard quarters debate rounds a round");
  });

  it("publishes a styleless video as a lecture", async () => {
    await queue(ID, { style: null, title: "Intro lecture" });
    await route.POST(req("POST"), ctx(ID));
    expect((await published())[0]).toMatchObject({ source: "lecture", style: null });
  });

  it("404s for a video that is not in the queue", async () => {
    expect((await route.POST(req("POST"), ctx(ID))).status).toBe(404);
    expect(await published()).toEqual([]);
  });
});

describe("DELETE", () => {
  it("drops the video from the queue and excludes it from future scans, recording who", async () => {
    await queue();
    await queue("bbbbbbbbbbb");
    const res = await route.DELETE(req("DELETE"), ctx(ID));
    expect(await res.json()).toEqual({ ok: true, id: ID });
    expect((await queued()).map((row) => row.id)).toEqual(["bbbbbbbbbbb"]);
    expect(await db.select().from(schema.youtubeVideoExclusions)).toMatchObject([{ videoId: ID, deletedBy: "editor@example.com" }]);
    expect(await published()).toEqual([]);
  });
});

describe("PATCH", () => {
  it("writes only the fields the dialog sent", async () => {
    await queue(ID, { tournament: "Harvard" });
    const res = await route.PATCH(req("PATCH", { title: "  Renamed  ", neg: "Emory EF", winner: "true", tournament: "" }), ctx(ID));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, id: ID });
    expect(body.video).toMatchObject({ title: "Renamed", neg: "Emory EF", winner: true, tournament: null, aff: "Harker AB", channel: "Debate Rounds", style: 1 });

    const [row] = await db.select().from(schema.youtubeRoundVideos).where(eq(schema.youtubeRoundVideos.id, ID));
    expect(row.title).toBe("Renamed");
  });

  it("404s for an unknown video, and 400s for a body that is not an object", async () => {
    expect((await route.PATCH(req("PATCH", { title: "x" }), ctx("zzzzzzzzzzz"))).status).toBe(404);
    await queue();
    for (const body of ["[]", "null", "5"]) {
      const res = await route.PATCH(req("PATCH", body), ctx(ID));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Expected a JSON object" });
    }
    expect((await queued())[0].title).toBe("2026 Harvard Quarters");
  });
});
