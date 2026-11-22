/**
 * @fileoverview The admin routes behind the round-video queue, the YouTube
 * channel list and unavailable-video cleanup, run against a real in-memory
 * database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  staffRoles,
  user,
  videos,
  youtubeChannels,
  youtubeRoundVideos,
  youtubeVideoExclusions,
} from "@/lib/database/schema";
import { askModel } from "@/lib/videos/video-autofill";
import { ADMIN, MODERATOR, access } from "./helpers/access";
import { freshDb, params, request, type DB } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/database/context")>()),
  ...(await import("./helpers/access")).contextMock,
}));
vi.mock("@/lib/videos/video-autofill", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/videos/video-autofill")>();
  return {
    ...actual,
    // askModel resolves to parsed fields, so mock it with a parsed model reply.
    askModel: vi.fn().mockResolvedValue(actual.parseAutofillReply('{"style": "lecture", "category": "Topic Lectures"}')),
    autofillKeys: vi.fn().mockReturnValue([]),
  };
});

const queue = await import("../src/api/admin/youtube/videos");
const queued = await import("../src/api/admin/youtube/videos/[id]");
const dedupe = await import("../src/api/admin/youtube/videos/dedupe");
const publish = await import("../src/api/admin/youtube/videos/publish");
const publishAll = await import("../src/api/admin/youtube/videos/publish-all");
const channels = await import("../src/api/admin/youtube/channels");
const availability = await import("../src/api/admin/videos/availability");
const detect = await import("../src/api/admin/youtube/videos/detect");

let db: DB;

function round(id: string, style = 1, extra: Partial<typeof youtubeRoundVideos.$inferInsert> = {}) {
  return {
    id,
    title: `Round ${id}`,
    publishedAt: "2026-03-01",
    channel: "Debate Channel",
    views: 10,
    description: "Aff v Neg",
    style,
    ...extra,
  };
}

beforeEach(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("CARD_IMPORT_TOKEN", "");
  db = await freshDb();
  access.db = db;
  access.email = ADMIN;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("round video queue", () => {
  it("lists queued rounds, filtered by style", async () => {
    await db.insert(youtubeRoundVideos).values([round("aaaaaaaaaaa", 1), round("bbbbbbbbbbb", 2)]);
    const body = await (await queue.GET(request("/api/admin/youtube/videos?style=2&limit=5"))).json();
    expect(JSON.stringify(body)).toContain("bbbbbbbbbbb");
    expect(JSON.stringify(body)).not.toContain("aaaaaaaaaaa");
  });

  it("publishes one queued round and clears it from the queue", async () => {
    await db.insert(youtubeRoundVideos).values(round("aaaaaaaaaaa"));
    const res = await queued.POST(request("/x", { method: "POST" }), params({ id: "aaaaaaaaaaa" }));
    expect(await res.json()).toEqual({ ok: true, id: "aaaaaaaaaaa" });
    expect((await db.select().from(videos)).map((row) => row.videoId)).toEqual(["aaaaaaaaaaa"]);
    expect(await db.select().from(youtubeRoundVideos)).toEqual([]);

    expect((await queued.POST(request("/x", { method: "POST" }), params({ id: "missing0000" }))).status).toBe(404);
  });

  it("drops a queued round and remembers it was deleted", async () => {
    await db.insert(youtubeRoundVideos).values(round("aaaaaaaaaaa"));
    await queued.DELETE(request("/x", { method: "DELETE" }), params({ id: "aaaaaaaaaaa" }));
    expect(await db.select().from(youtubeRoundVideos)).toEqual([]);
    // Remembered, so the next channel scan skips it instead of re-queueing it.
    const exclusions = await db.select().from(youtubeVideoExclusions);
    expect(exclusions.map((row) => [row.videoId, row.deletedBy])).toEqual([["aaaaaaaaaaa", ADMIN]]);
  });

  it("publishes every queued round of a style", async () => {
    await db.insert(youtubeRoundVideos).values([round("aaaaaaaaaaa", 1), round("bbbbbbbbbbb", 2)]);
    const body = await (await publishAll.POST(request("/x?style=1", { method: "POST" }))).json();
    expect(body).toMatchObject({ ok: true, published: 1, skipped: 0 });
    expect((await db.select().from(youtubeRoundVideos)).map((row) => row.id)).toEqual(["bbbbbbbbbbb"]);

    expect(await (await publishAll.POST(request("/x?style=1", { method: "POST" }))).json()).toEqual({
      ok: true,
      published: 0,
      skipped: 0,
    });
  });

  it("copies the whole queue into the grid without overwriting published rows", async () => {
    await db.insert(videos).values({ videoId: "aaaaaaaaaaa", source: "round", title: "Kept title" });
    await db.insert(youtubeRoundVideos).values([round("aaaaaaaaaaa"), round("bbbbbbbbbbb", 2, { winner: true })]);
    const body = await (await publish.POST()).json();
    expect(body.published).toBe(1);
    const rows = await db.select().from(videos);
    expect(rows.find((row) => row.videoId === "aaaaaaaaaaa")?.title).toBe("Kept title");
    expect(rows.find((row) => row.videoId === "bbbbbbbbbbb")).toMatchObject({ source: "round", affWin: true, style: 2 });
  });

  it("removes queued rounds that are already published", async () => {
    await db.insert(videos).values({ videoId: "aaaaaaaaaaa", source: "round", title: "Published" });
    await db.insert(youtubeRoundVideos).values([round("aaaaaaaaaaa"), round("bbbbbbbbbbb")]);
    const body = await (await dedupe.POST(request("/x?style=1", { method: "POST" }))).json();
    expect(body.ok).toBe(true);
    expect(typeof body.removed).toBe("number");
  });

  it("is staff-only, and moderators may work the queue", async () => {
    access.email = "viewer@example.com";
    expect((await queue.GET(request("/x"))).status).toBe(403);
    expect((await queued.POST(request("/x"), params({ id: "a" }))).status).toBe(403);
    expect((await queued.DELETE(request("/x"), params({ id: "a" }))).status).toBe(403);
    expect((await dedupe.POST(request("/x"))).status).toBe(403);
    expect((await publish.POST()).status).toBe(403);
    expect((await publishAll.POST(request("/x"))).status).toBe(403);

    await db.insert(staffRoles).values({ email: MODERATOR, role: "moderator", createdAt: new Date() });
    access.email = MODERATOR;
    expect((await queue.GET(request("/x"))).status).toBe(200);
  });
});

describe("queue video metadata edits", () => {
  it("updates a queued video's editable fields", async () => {
    await db.insert(youtubeRoundVideos).values(round("aaaaaaaaaaa", 1));
    const res = await queued.PATCH(request("/api/admin/youtube/videos/aaaaaaaaaaa", {
      method: "PATCH",
      body: { title: "Corrected title", style: "none", category: "Topic Lectures", affTeam: "Westside", judgeDecision: "3-2" },
    }), params({ id: "aaaaaaaaaaa" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.video).toMatchObject({
      id: "aaaaaaaaaaa",
      title: "Corrected title",
      style: null,
      category: "Topic Lectures",
      aff: "Westside",
      judgeDecision: "3-2",
    });
    const rows = await db.select().from(youtubeRoundVideos);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Corrected title",
      style: null,
      category: "Topic Lectures",
      aff: "Westside",
      judgeDecision: "3-2",
    });
  });

  it("leaves fields the request does not send untouched", async () => {
    await db.insert(youtubeRoundVideos).values(round("aaaaaaaaaaa", 1, { title: "Keep me" }));
    const res = await queued.PATCH(request("/api/admin/youtube/videos/aaaaaaaaaaa", {
      method: "PATCH",
      body: { channel: "New channel" },
    }), params({ id: "aaaaaaaaaaa" }));
    expect(res.status).toBe(200);
    const rows = await db.select().from(youtubeRoundVideos);
    expect(rows[0]).toMatchObject({ title: "Keep me", channel: "New channel" });
  });

  it("returns 404 for a video not in the queue", async () => {
    const res = await queued.PATCH(request("/api/admin/youtube/videos/missing", {
      method: "PATCH",
      body: { title: "x" },
    }), params({ id: "missing" }));
    expect(res.status).toBe(404);
  });

  it("is staff-only", async () => {
    access.email = "viewer@example.com";
    expect((await queued.PATCH(request("/x", { method: "PATCH", body: {} }), params({ id: "a" }))).status).toBe(403);
    await db.insert(staffRoles).values({ email: MODERATOR, role: "moderator", createdAt: new Date() });
    access.email = MODERATOR;
    await db.insert(youtubeRoundVideos).values(round("a", 1));
    expect((await queued.PATCH(request("/x", { method: "PATCH", body: { title: "x" } }), params({ id: "a" }))).status).toBe(200);
  });
});

describe("/api/admin/youtube/videos/detect", () => {
  it("detects each queued video and writes the style and category back", async () => {
    await db.insert(youtubeRoundVideos).values([
      round("aaaaaaaaaaa", 1, { title: "2026 TOC Finals: A vs B", description: "Aff v Neg" }),
      round("bbbbbbbbbbb", undefined, { style: null, category: "Demo Debates", title: "Demo round", description: "A demo" }),
    ]);
    const body = await (await detect.POST(request("/api/admin/youtube/videos/detect", {
      method: "POST",
      body: { ids: ["aaaaaaaaaaa", "bbbbbbbbbbb", "missing0000000"] },
    }))).json();
    expect(body.ok).toBe(true);
    expect(body.results).toHaveLength(2);
    expect(body.results.find((row: { id: string }) => row.id === "aaaaaaaaaaa")).toMatchObject({ style: null, category: "Topic Lectures" });
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toMatchObject({ id: "missing0000000", error: "Video not in the queue" });
    const rows = await db.select().from(youtubeRoundVideos);
    expect(rows.find((row) => row.id === "aaaaaaaaaaa")).toMatchObject({ style: null, category: "Topic Lectures" });
    expect(rows.find((row) => row.id === "bbbbbbbbbbb")).toMatchObject({ style: null, category: "Topic Lectures" });
  });

  it("reports a per-video error without failing the whole batch", async () => {
    vi.mocked(askModel).mockRejectedValueOnce(new Error("upstream failure"));
    await db.insert(youtubeRoundVideos).values(round("aaaaaaaaaaa", 1));
    const body = await (await detect.POST(request("/api/admin/youtube/videos/detect", {
      method: "POST",
      body: { ids: ["aaaaaaaaaaa"] },
    }))).json();
    expect(body.ok).toBe(true);
    expect(body.results).toHaveLength(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toMatchObject({ id: "aaaaaaaaaaa", error: "upstream failure" });
  });

  it("is staff-only", async () => {
    access.email = "viewer@example.com";
    expect((await detect.POST(request("/api/admin/youtube/videos/detect", {
      method: "POST",
      body: { ids: ["a"] },
    }))).status).toBe(403);
  });
});

describe("/api/admin/youtube/channels", () => {
  const post = (body: unknown) => channels.POST(request("/x", { method: "POST", body }));

  it("adds, lists, edits and deletes a channel", async () => {
    const added = await post({ name: "@DebateChannel" });
    expect(added.status).toBe(201);
    const { channel } = await added.json();
    expect(channel).toMatchObject({ addedBy: ADMIN, enabled: true });

    const listed = await (await channels.GET()).json();
    expect(JSON.stringify(listed)).toContain(channel.name);

    const edited = await channels.PATCH(request(`/x?id=${channel.id}`, { method: "PATCH", body: { enabled: false } }));
    expect((await edited.json()).channel.enabled).toBe(false);

    const deleted = await channels.DELETE(request(`/x?id=${channel.id}`, { method: "DELETE" }));
    expect((await deleted.json()).deleted).toBeTruthy();
    expect(await db.select().from(youtubeChannels)).toEqual([]);
  });

  it("re-enables a paused channel instead of adding it twice", async () => {
    const { channel } = await (await post({ name: "@DebateChannel" })).json();
    await channels.PATCH(request(`/x?id=${channel.id}`, { method: "PATCH", body: { enabled: false } }));
    const again = await (await post({ name: "  @DebateChannel " })).json();
    expect(again.channel).toMatchObject({ id: channel.id, enabled: true });
    expect(await db.select().from(youtubeChannels)).toHaveLength(1);
  });

  it("refuses a blank name or a rename onto another channel", async () => {
    expect((await post({ name: "   " })).status).toBe(409);
    await post({ name: "@One" });
    const { channel } = await (await post({ name: "@Two" })).json();
    expect((await channels.PATCH(request(`/x?id=${channel.id}`, { method: "PATCH", body: { name: "@One" } }))).status).toBe(409);
  });

  it("validates ids and bodies", async () => {
    expect((await post("{")).status).toBe(400);
    expect((await channels.PATCH(request("/x?id=0", { method: "PATCH", body: {} }))).status).toBe(400);
    expect((await channels.PATCH(request("/x?id=1", { method: "PATCH", body: "{" }))).status).toBe(400);
    expect((await channels.DELETE(request("/x?id=abc", { method: "DELETE" }))).status).toBe(400);
  });

  it("is admin-only", async () => {
    access.email = MODERATOR;
    expect((await channels.GET()).status).toBe(403);
    expect((await post({ name: "x" })).status).toBe(403);
    expect((await channels.PATCH(request("/x?id=1", { method: "PATCH", body: {} }))).status).toBe(403);
    expect((await channels.DELETE(request("/x?id=1", { method: "DELETE" }))).status).toBe(403);
  });
});

describe("/api/admin/videos/availability", () => {
  async function seed() {
    await db.insert(videos).values([
      { videoId: "gone0000000", source: "round", title: "Gone", availability: "removed", availabilityCheckedAt: new Date() },
      { videoId: "hidden00000", source: "round", title: "Hidden", availability: "private", availabilityCheckedAt: new Date() },
      { videoId: "fine0000000", source: "round", title: "Fine" },
    ]);
  }

  it("lists unavailable videos with counts", async () => {
    await seed();
    const body = await (await availability.GET(request("/x?limit=9999"))).json();
    expect(body.videos.map((row: { videoId: string }) => row.videoId).sort()).toEqual(["gone0000000", "hidden00000"]);
    expect(body.counts).toMatchObject({ removed: 1, private: 1, not_embeddable: 0 });
  });

  it("marks a video available again", async () => {
    await seed();
    const res = await availability.POST(request("/x", { method: "POST", body: { videoId: "hidden00000" } }));
    expect(await res.json()).toEqual({ ok: true, videoId: "hidden00000" });
    const body = await (await availability.GET(request("/x"))).json();
    expect(body.counts.private).toBe(0);
  });

  it("removes videos in the given states and excludes them from the resync", async () => {
    await seed();
    const res = await availability.DELETE(request("/x", { method: "DELETE", body: { states: ["removed"] } }));
    expect(await res.json()).toEqual({ ok: true, removed: 1, videoIds: ["gone0000000"] });
    expect((await db.select().from(videos)).map((row) => row.videoId).sort()).toEqual(["fine0000000", "hidden00000"]);
    expect((await db.select().from(youtubeVideoExclusions)).map((row) => row.videoId)).toEqual(["gone0000000"]);
  });

  it("validates its bodies", async () => {
    expect((await availability.POST(request("/x", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await availability.POST(request("/x", { method: "POST", body: { videoId: "x" } }))).status).toBe(400);
    expect((await availability.DELETE(request("/x", { method: "DELETE", body: "{" }))).status).toBe(400);
    expect((await availability.DELETE(request("/x", { method: "DELETE", body: { states: ["fine"] } }))).status).toBe(400);
  });

  it("is admin-only", async () => {
    access.email = MODERATOR;
    expect((await availability.GET(request("/x"))).status).toBe(403);
    expect((await availability.POST(request("/x", { method: "POST", body: {} }))).status).toBe(403);
    expect((await availability.DELETE(request("/x", { method: "DELETE", body: {} }))).status).toBe(403);
  });

  it("answers 500 when the database fails", async () => {
    access.db = {
      select: () => {
        throw new Error("D1 down");
      },
      update: () => {
        throw new Error("D1 down");
      },
    };
    expect((await availability.GET(request("/x"))).status).toBe(500);
    expect((await availability.POST(request("/x", { method: "POST", body: { videoId: "fine0000000" } }))).status).toBe(500);
    expect((await availability.DELETE(request("/x", { method: "DELETE", body: { states: ["removed"] } }))).status).toBe(500);
  });
});
