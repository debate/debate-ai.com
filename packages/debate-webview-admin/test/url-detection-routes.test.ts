/**
 * @fileoverview The admin routes behind the browsing-URL log and the
 * reuse-check log purge, run against a real in-memory database. The video
 * queue routes are tested in `@debate-ai/videos-admin`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectedUrls, user } from "@/lib/database/schema";
import { ADMIN, MODERATOR, access } from "./helpers/access";
import { freshDb, request, type DB } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./helpers/access")).contextMock,
}));

const urlDetection = await import("../src/api/admin/url-detection/index");
const urlStats = await import("../src/api/admin/url-detection/stats");
const purge = await import("../src/api/admin/evidence-reuse-check-log/purge");

let db: DB;

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

describe("/api/admin/url-detection", () => {
  const recent = new Date();
  const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    await db.insert(user).values([
      { id: "u1", name: "Ann", email: "ann@example.com", createdAt: recent, updatedAt: recent },
      { id: "u2", name: "Ben", email: "ben@example.com", createdAt: recent, updatedAt: recent },
    ]);
    await db.insert(detectedUrls).values([
      { userId: "u1", url: "https://news.test/a", normalizedUrl: "news.test/a", title: "Climate", visitCount: 5, lastVisitedAt: recent },
      { userId: "u2", url: "https://blog.test/b", normalizedUrl: "blog.test/b", title: "Trade", visitCount: 2, lastVisitedAt: recent },
      { userId: "u1", url: "https://old.test/c", normalizedUrl: "old.test/c", title: "Old", visitCount: 9, lastVisitedAt: old },
    ]);
  });

  it("pages the log with the visitor attached", async () => {
    const body = await (await urlDetection.GET(request("/x?limit=2&offset=0"))).json();
    expect(body).toMatchObject({ total: 3, limit: 2, offset: 0 });
    expect(body.urls).toHaveLength(2);
    expect(body.urls[0]).toHaveProperty("userEmail");
  });

  it("filters by search, user and age", async () => {
    const bySearch = await (await urlDetection.GET(request("/x?search=Climate"))).json();
    expect(bySearch.urls.map((row: { title: string }) => row.title)).toEqual(["Climate"]);
    const byUser = await (await urlDetection.GET(request("/x?userId=u2"))).json();
    expect(byUser.total).toBe(1);
    const bySince = await (await urlDetection.GET(request("/x?sinceDays=30"))).json();
    expect(bySince.total).toBe(2);
  });

  it("summarizes the recent period", async () => {
    const body = await (await urlStats.GET(request("/x"))).json();
    expect(body).toMatchObject({ totalUrls: 2, uniqueUsers: 2, totalVisits: 7, periodDays: 30 });
    expect(body.topUrls.map((row: { title: string }) => row.title)).toEqual(["Climate", "Trade"]);
    expect((await (await urlStats.GET(request("/x?sinceDays=365"))).json()).totalUrls).toBe(3);
  });

  it("accepts the card-import token instead of a session", async () => {
    vi.stubEnv("CARD_IMPORT_TOKEN", "secret-token");
    access.email = null;
    const req = request("/x");
    req.headers.set("authorization", "Bearer secret-token");
    expect((await urlStats.GET(req)).status).toBe(200);
  });

  it("is admin-only otherwise", async () => {
    access.email = MODERATOR;
    expect((await urlDetection.GET(request("/x"))).status).toBe(403);
    expect((await urlStats.GET(request("/x"))).status).toBe(403);
  });
});

describe("/api/admin/evidence-reuse-check-log/purge", () => {
  it("purges for an admin", async () => {
    const res = await purge.POST();
    expect(res.status).toBe(200);
  });

  it("is admin-only", async () => {
    access.email = null;
    expect((await purge.POST()).status).toBe(403);
  });

  it("answers 500 when the purge fails", async () => {
    access.db = {
      select: () => {
        throw new Error("D1 down");
      },
    };
    const res = await purge.POST();
    expect(res.status).toBe(500);
    expect((await res.json()).details).toBe("D1 down");
  });
});
