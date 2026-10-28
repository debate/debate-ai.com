/**
 * @fileoverview The video admin routes that start a long job — video
 * stacks, view counts, durations, the JSON seed, the YouTube resync and AI
 * autofill. The jobs themselves have
 * their own tests in the web app; these check what each route adds on top:
 * who may run it, how it reads its input, and how a failure comes back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { videos, youtubeRoundVideos, youtubeSyncRuns } from "@/lib/database/schema";
import { ADMIN, MODERATOR, access } from "./helpers/access";
import { freshDb, request, type DB } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./helpers/access")).contextMock,
}));

const jobs = vi.hoisted(() => ({
  recomputeVideoStacks: vi.fn(),
  resyncVideoViewCounts: vi.fn(),
  backfillVideoDurations: vi.fn(),
  getVideoDurationStatus: vi.fn(),
  seedVideosIntoDb: vi.fn(),
  resyncYouTubeRounds: vi.fn(),
  autofillVideo: vi.fn(),
}));
vi.mock("@/lib/videos/recompute-video-stacks", () => ({ recomputeVideoStacks: jobs.recomputeVideoStacks }));
vi.mock("@/lib/videos/resync-view-counts", () => ({ resyncVideoViewCounts: jobs.resyncVideoViewCounts }));
vi.mock("@/lib/videos/backfill-video-durations", () => ({
  backfillVideoDurations: jobs.backfillVideoDurations,
  getVideoDurationStatus: jobs.getVideoDurationStatus,
}));
vi.mock("@/lib/videos/seed-videos-to-db", () => ({ seedVideosIntoDb: jobs.seedVideosIntoDb }));
vi.mock("@/lib/youtube/resync-rounds", () => ({ resyncYouTubeRounds: jobs.resyncYouTubeRounds }));
vi.mock("@/lib/videos/video-autofill", () => ({ autofillVideo: jobs.autofillVideo }));

const stacks = await import("../src/api/admin/videos/recompute-stacks");
const viewCounts = await import("../src/api/admin/videos/view-counts");
const durations = await import("../src/api/admin/videos/durations");
const seed = await import("../src/api/admin/videos/seed");
const resync = await import("../src/api/admin/youtube/resync");
const autofill = await import("../src/api/admin/videos/library/autofill");

let db: DB;

/** An error the way D1 reports one: the SQL in the message, the reason in `cause`. */
const d1Error = () => Object.assign(new Error("Failed query: insert into videos"), { cause: new Error("too many SQL variables") });

beforeEach(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("CARD_IMPORT_TOKEN", "");
  db = await freshDb();
  access.db = db;
  access.email = ADMIN;
  for (const job of Object.values(jobs)) job.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("admin-only jobs refuse everyone else", () => {
  it.each([
    ["recompute stacks", () => stacks.POST()],
    ["view count resync", () => viewCounts.POST()],
    ["view count status", () => viewCounts.GET()],
    ["duration backfill", () => durations.POST(request("/x", { method: "POST", body: {} }))],
    ["duration status", () => durations.GET()],
    ["seed", () => seed.POST()],
    ["seed status", () => seed.GET()],
    ["resync", () => resync.POST(request("/x", { method: "POST", body: {} }))],
    ["resync runs", () => resync.GET()],
  ])("%s", async (_label, call) => {
    access.email = MODERATOR;
    expect((await call()).status).toBe(403);
    expect(Object.values(jobs).every((job) => job.mock.calls.length === 0)).toBe(true);
  });
});

describe("video stacks", () => {
  it("returns the job's result", async () => {
    jobs.recomputeVideoStacks.mockResolvedValue({ stacks: 4, members: 9 });
    expect(await (await stacks.POST()).json()).toEqual({ ok: true, stacks: 4, members: 9 });
  });

  it("reports D1's underlying cause", async () => {
    jobs.recomputeVideoStacks.mockRejectedValue(d1Error());
    const res = await stacks.POST();
    expect(res.status).toBe(500);
    expect((await res.json()).details).toBe("too many SQL variables");
  });
});

describe("view counts", () => {
  it("runs the resync", async () => {
    jobs.resyncVideoViewCounts.mockResolvedValue({ updated: 12 });
    expect(await (await viewCounts.POST()).json()).toEqual({ ok: true, updated: 12 });
  });

  it("reports a failed resync", async () => {
    jobs.resyncVideoViewCounts.mockRejectedValue(new Error("quota exceeded"));
    const res = await viewCounts.POST();
    expect(res.status).toBe(500);
    expect((await res.json()).details).toContain("quota exceeded");
  });

  it("counts published and queued videos", async () => {
    await db.insert(videos).values({ videoId: "aaaaaaaaaaa", source: "round", title: "A" });
    await db.insert(youtubeRoundVideos).values([
      { id: "b", title: "B", publishedAt: "2026-01-01", channel: "c", style: 1 },
      { id: "c", title: "C", publishedAt: "2026-01-01", channel: "c", style: 1 },
    ]);
    expect(await (await viewCounts.GET()).json()).toEqual({ publishedVideos: 1, queuedVideos: 2 });
  });

  it("reads zeros when the tables are missing", async () => {
    access.db = { select: () => ({ from: () => Promise.reject(new Error("no such table")) }) };
    expect(await (await viewCounts.GET()).json()).toEqual({ publishedVideos: 0, queuedVideos: 0 });
  });
});

describe("durations", () => {
  it("passes only well-typed options to the backfill", async () => {
    jobs.backfillVideoDurations.mockResolvedValue({ filled: 3 });
    await durations.POST(request("/x", { method: "POST", body: { after: "abc", limit: 50, refresh: true } }));
    expect(jobs.backfillVideoDurations).toHaveBeenCalledWith(db, { after: "abc", limit: 50, refresh: true });

    await durations.POST(request("/x", { method: "POST", body: { after: 7, limit: "50", refresh: "yes" } }));
    expect(jobs.backfillVideoDurations).toHaveBeenLastCalledWith(db, { after: null, limit: undefined, refresh: false });
  });

  it("treats a missing body as no options", async () => {
    jobs.backfillVideoDurations.mockResolvedValue({ filled: 0 });
    const res = await durations.POST(request("/x", { method: "POST", body: "not json" }));
    expect(await res.json()).toEqual({ ok: true, filled: 0 });
  });

  it("reports status, and failures of either call", async () => {
    jobs.getVideoDurationStatus.mockResolvedValue({ missing: 5 });
    expect(await (await durations.GET()).json()).toEqual({ missing: 5 });

    jobs.getVideoDurationStatus.mockRejectedValue(new Error("boom"));
    expect((await durations.GET()).status).toBe(500);
    jobs.backfillVideoDurations.mockRejectedValue(new Error("boom"));
    expect((await durations.POST(request("/x", { method: "POST", body: {} }))).status).toBe(500);
  });
});

describe("video seed", () => {
  it("seeds and reports the result", async () => {
    jobs.seedVideosIntoDb.mockResolvedValue({ inserted: 100 });
    expect(await (await seed.POST()).json()).toEqual({ ok: true, inserted: 100 });
  });

  it("reports D1's cause and the failing query", async () => {
    jobs.seedVideosIntoDb.mockRejectedValue(d1Error());
    const body = await (await seed.POST()).json();
    expect(body).toMatchObject({ details: "too many SQL variables", query: "Failed query: insert into videos" });
  });

  it("reports a plain error's message", async () => {
    jobs.seedVideosIntoDb.mockRejectedValue(new Error("asset missing"));
    const body = await (await seed.POST()).json();
    expect(body.details).toBe("asset missing");
    expect(body).not.toHaveProperty("query");
  });

  it("says where videos are served from", async () => {
    expect(await (await seed.GET()).json()).toEqual({ rows: 0, lastSeededAt: null, servingFrom: "json" });
    await db.insert(videos).values({ videoId: "aaaaaaaaaaa", source: "round", title: "A" });
    expect(await (await seed.GET()).json()).toMatchObject({ rows: 1, servingFrom: "sql" });
  });

  it("falls back to JSON when the table can't be read", async () => {
    access.db = { select: () => ({ from: () => Promise.reject(new Error("no such table")) }) };
    expect(await (await seed.GET()).json()).toEqual({ rows: 0, lastSeededAt: null, servingFrom: "json" });
  });
});

describe("YouTube resync", () => {
  it("passes a valid publishedAfter date through", async () => {
    jobs.resyncYouTubeRounds.mockResolvedValue({ added: 2 });
    const res = await resync.POST(request("/x", { method: "POST", body: { publishedAfter: "2026-01-01" } }));
    expect(await res.json()).toEqual({ added: 2 });
    expect(jobs.resyncYouTubeRounds).toHaveBeenCalledWith(ADMIN, "2026-01-01", "all");
  });

  it("resyncs everything without a body", async () => {
    jobs.resyncYouTubeRounds.mockResolvedValue({ added: 0 });
    await resync.POST(request("/x", { method: "POST" }));
    expect(jobs.resyncYouTubeRounds).toHaveBeenCalledWith(ADMIN, undefined, "all");
  });

  it("rejects an invalid date", async () => {
    expect((await resync.POST(request("/x", { method: "POST", body: { publishedAfter: "someday" } }))).status).toBe(400);
  });

  it("reports a failed resync", async () => {
    jobs.resyncYouTubeRounds.mockRejectedValue(new Error("API key missing"));
    const res = await resync.POST(request("/x", { method: "POST", body: {} }));
    expect(res.status).toBe(500);
    expect((await res.json()).details).toContain("API key missing");
  });

  it("lists recent runs, newest first", async () => {
    await db.insert(youtubeSyncRuns).values([
      { startedAt: new Date("2026-01-01"), status: "succeeded" },
      { startedAt: new Date("2026-02-01"), status: "failed" },
    ] as never);
    const { runs } = await (await resync.GET()).json();
    expect(runs.map((run: { status: string }) => run.status)).toEqual(["failed", "succeeded"]);
  });
});

describe("autofill", () => {
  const post = (body: unknown) => autofill.POST(request("/x", { method: "POST", body }));

  it("autofills a video, passing only string hints", async () => {
    jobs.autofillVideo.mockResolvedValue({ fields: { tournament: "TOC" } });
    const res = await post({ videoId: "aaaaaaaaaaa", title: "TOC Finals", channel: 3 });
    expect(await res.json()).toEqual({ fields: { tournament: "TOC" } });
    expect(jobs.autofillVideo).toHaveBeenCalledWith({
      videoId: "aaaaaaaaaaa",
      title: "TOC Finals",
      channel: null,
      description: null,
    });
  });

  it("validates the body", async () => {
    expect((await post("{")).status).toBe(400);
    expect((await post({ videoId: "short" })).status).toBe(400);
  });

  it("answers 502 when the model fails", async () => {
    jobs.autofillVideo.mockRejectedValue(new Error("model timeout"));
    const res = await post({ videoId: "aaaaaaaaaaa" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "model timeout" });
  });

  it("is open to moderators but not viewers", async () => {
    access.email = "viewer@example.com";
    expect((await post({ videoId: "aaaaaaaaaaa" })).status).toBe(403);
  });
});
