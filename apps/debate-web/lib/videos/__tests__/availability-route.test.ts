/**
 * @fileoverview `/api/admin/videos/availability` against a real SQLite
 * database and the real admin check: only admins see or act on takedown flags,
 * a flag can be cleared by hand, and removing flagged videos honours exactly
 * the states named while recording who removed them.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
let broken = false;
let email: string | null = null;
const env: Record<string, string | undefined> = {};

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => {
    if (broken) throw new Error("d1 down");
    return db;
  },
  getCloudflareContext: () => undefined,
}));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (email ? { user: { id: email, email, name: email }, session: {} } : null),
}));

const route = await import("@/app/api/admin/videos/availability/route");

const req = (method: string, url: string, body?: unknown) =>
  new NextRequest(`https://debate-ai.com${url}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

async function addVideo(videoId: string, availability: string, checked = availability !== "available") {
  await db.insert(schema.videos).values({
    videoId,
    source: "lecture",
    title: videoId,
    availability,
    missingChecks: 2,
    availabilityCheckedAt: checked ? new Date() : null,
  });
}

beforeEach(async () => {
  db = await freshSchemaDb();
  broken = false;
  email = "boss@example.com";
  env.ADMIN_EMAILS = "boss@example.com";
  vi.spyOn(console, "error").mockImplementation(() => {});
  await addVideo("aaaaaaaaaaa", "available");
  await addVideo("bbbbbbbbbbb", "removed");
  await addVideo("ccccccccccc", "private");
  await addVideo("ddddddddddd", "not_embeddable");
});

describe("admin only", () => {
  it.each([
    ["GET", "/api/admin/videos/availability", undefined],
    ["POST", "/api/admin/videos/availability", { videoId: "bbbbbbbbbbb" }],
    ["DELETE", "/api/admin/videos/availability", { states: ["removed"] }],
  ])("%s answers 403 to anyone who is not an admin", async (method, url, body) => {
    const handler = route[method as "GET" | "POST" | "DELETE"];
    email = null;
    expect((await handler(req(method, url, body))).status).toBe(403);
    email = "someone@example.com";
    expect((await handler(req(method, url, body))).status).toBe(403);
    expect(await db.select().from(schema.videos)).toHaveLength(4);
  });
});

describe("GET", () => {
  it("lists flagged videos with a count per state, and leaves available ones out", async () => {
    const body = await (await route.GET(req("GET", "/api/admin/videos/availability"))).json();
    expect(body.videos.map((v: { videoId: string }) => v.videoId).sort()).toEqual(["bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"]);
    expect(body.counts).toEqual({ removed: 1, private: 1, not_embeddable: 1 });
  });

  it("clamps the limit", async () => {
    const one = await (await route.GET(req("GET", "/api/admin/videos/availability?limit=1"))).json();
    expect(one.videos).toHaveLength(1);
    const junk = await (await route.GET(req("GET", "/api/admin/videos/availability?limit=-5"))).json();
    expect(junk.videos).toHaveLength(1);
  });

  it("answers 500 on a database fault", async () => {
    broken = true;
    const res = await route.GET(req("GET", "/api/admin/videos/availability"));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Failed to load unavailable videos" });
  });
});

describe("POST", () => {
  it("clears a flag and the missed-check streak", async () => {
    const res = await route.POST(req("POST", "/api/admin/videos/availability", { videoId: " bbbbbbbbbbb " }));
    expect(await res.json()).toEqual({ ok: true, videoId: "bbbbbbbbbbb" });
    const [row] = (await db.select().from(schema.videos)).filter((v) => v.videoId === "bbbbbbbbbbb");
    expect(row).toMatchObject({ availability: "available", missingChecks: 0 });
  });

  it("rejects a bad body or video id, and answers 500 on a database fault", async () => {
    expect((await route.POST(req("POST", "/api/admin/videos/availability", "{nope"))).status).toBe(400);
    expect((await route.POST(req("POST", "/api/admin/videos/availability", {}))).status).toBe(400);
    expect((await route.POST(req("POST", "/api/admin/videos/availability", { videoId: "too short" }))).status).toBe(400);
    broken = true;
    expect((await route.POST(req("POST", "/api/admin/videos/availability", { videoId: "bbbbbbbbbbb" }))).status).toBe(500);
  });
});

describe("DELETE", () => {
  it("removes only the states named, excludes them from future syncs, and records the admin", async () => {
    const res = await route.DELETE(req("DELETE", "/api/admin/videos/availability", { states: ["removed", "not_embeddable", "bogus"] }));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, removed: 2 });
    expect(body.videoIds.sort()).toEqual(["bbbbbbbbbbb", "ddddddddddd"]);

    expect((await db.select().from(schema.videos)).map((v) => v.videoId).sort()).toEqual(["aaaaaaaaaaa", "ccccccccccc"]);
    const exclusions = await db.select().from(schema.youtubeVideoExclusions);
    expect(exclusions.map((row) => row.videoId).sort()).toEqual(["bbbbbbbbbbb", "ddddddddddd"]);
    expect(exclusions.every((row) => row.deletedBy === "boss@example.com")).toBe(true);
  });

  it("leaves alone a flagged video no resync has checked", async () => {
    await addVideo("eeeeeeeeeee", "removed", false);
    const body = await (await route.DELETE(req("DELETE", "/api/admin/videos/availability", { states: ["removed"] }))).json();
    expect(body.videoIds).toEqual(["bbbbbbbbbbb"]);
    expect((await db.select().from(schema.videos)).map((v) => v.videoId)).toContain("eeeeeeeeeee");
  });

  it("requires at least one known state and valid JSON", async () => {
    expect((await route.DELETE(req("DELETE", "/api/admin/videos/availability", "{nope"))).status).toBe(400);
    for (const states of [undefined, [], ["bogus"], "removed"]) {
      const res = await route.DELETE(req("DELETE", "/api/admin/videos/availability", { states }));
      expect(res.status).toBe(400);
    }
    expect(await db.select().from(schema.videos)).toHaveLength(4);
  });

  it("answers 500 on a database fault", async () => {
    broken = true;
    expect((await route.DELETE(req("DELETE", "/api/admin/videos/availability", { states: ["removed"] }))).status).toBe(500);
  });
});
