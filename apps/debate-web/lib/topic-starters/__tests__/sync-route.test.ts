/**
 * @fileoverview The admin sync endpoint: it starts a job, schedules the
 * background conversion, and reports a job's progress. The sync library is
 * stubbed; what's under test is the route's authorization and response shape.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => ({
  start: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  process: vi.fn(),
}));

vi.mock("@/lib/auth/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/admin")>()),
  getAdminAccess: async () => ({ isAdmin: true, email: "admin@example.com" }),
}));
vi.mock("@/lib/topic-starters/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/topic-starters/sync")>();
  return {
    ...actual,
    startTopicStarterSync: sync.start,
    getTopicStarterImport: sync.get,
    listTopicStarterImports: sync.list,
    processTopicStarterImport: sync.process,
  };
});

const { GET, POST } = await import("@/app/api/admin/topic-starters/sync/route");

const job = {
  id: "tsi_1",
  caselistSlug: "hspolicy26",
  caselistLabel: "HS Policy 2026-27",
  archiveFileName: "hspolicy26-all-2026-11-10.zip",
  archiveUrl: "https://files.example/hspolicy26-all-2026-11-10.zip",
  r2Key: "topic-starters/imports/hspolicy26/hspolicy26-all-2026-11-10.zip",
  topicCode: "vcx27",
  year: 2027,
  published: true,
  status: "queued",
  found: 0,
  imported: 0,
  failed: 0,
  failures: "[]",
  error: null,
  requestedBy: "admin@example.com",
  createdAt: new Date("2026-11-12T00:00:00.000Z"),
  startedAt: null,
  finishedAt: null,
};

function post(body: unknown) {
  return new NextRequest("http://localhost/api/admin/topic-starters/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sync.start.mockReset();
  sync.get.mockReset();
  sync.list.mockReset();
  sync.process.mockReset();
  sync.process.mockResolvedValue(job);
});

describe("POST /api/admin/topic-starters/sync", () => {
  it("starts a job and schedules its background conversion", async () => {
    sync.start.mockResolvedValue(job);
    const res = await POST(post({ caselist: "hspolicy26", topicCode: "vcx27", published: false }));
    expect(res.status).toBe(202);
    const body = (await res.json()) as { job: Record<string, unknown> };
    expect(body.job).toMatchObject({ id: "tsi_1", caselistSlug: "hspolicy26", status: "queued", failures: [] });
    expect(sync.start).toHaveBeenCalledWith(expect.objectContaining({ caselist: "hspolicy26", topicCode: "vcx27", published: false }));
    expect(sync.process).toHaveBeenCalledWith("tsi_1");
  });

  it("answers the sync library's own status and code", async () => {
    const { TopicStarterSyncError } = await import("@/lib/topic-starters/sync");
    sync.start.mockRejectedValue(new TopicStarterSyncError("openCaselist is not configured.", 503, "caselist-not-configured"));
    const res = await POST(post({ caselist: "hspolicy26" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "openCaselist is not configured.", code: "caselist-not-configured" });
    expect(sync.process).not.toHaveBeenCalled();
  });

  it("refuses a body with no caselist", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "no-caselist" });
  });
});

describe("GET /api/admin/topic-starters/sync", () => {
  it("reports one job with its failures parsed", async () => {
    sync.get.mockResolvedValue({ ...job, status: "partial", failures: JSON.stringify([{ path: "a.docx", code: "unknown", reason: "bad" }]) });
    const res = await GET(new NextRequest("http://localhost/api/admin/topic-starters/sync?jobId=tsi_1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { job: { failures: unknown[] } };
    expect(body.job.failures).toEqual([{ path: "a.docx", code: "unknown", reason: "bad" }]);
  });

  it("lists the newest jobs when no id is given", async () => {
    sync.list.mockResolvedValue([job]);
    const res = await GET(new NextRequest("http://localhost/api/admin/topic-starters/sync"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { jobs: unknown[] }).jobs).toHaveLength(1);
  });
});