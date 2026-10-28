// @vitest-environment node
/**
 * @fileoverview The admin transcript-scraper route, run against a real
 * in-memory database with the scraper itself stood in for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN, MODERATOR, access } from "./helpers/access";
import { freshDb, request, type DB } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./helpers/access")).contextMock,
}));

const stubs = vi.hoisted(() => ({
  getTranscriptScraperStats: vi.fn(),
  scrapeTranscriptsPage: vi.fn(),
  sharedProviderKey: vi.fn(),
}));
vi.mock("@/lib/videos/transcript-scraper", () => ({
  getTranscriptScraperStats: stubs.getTranscriptScraperStats,
  scrapeTranscriptsPage: stubs.scrapeTranscriptsPage,
  sharedProviderKey: stubs.sharedProviderKey,
}));

const transcripts = await import("../src/api/admin/videos/transcripts");

let db: DB;

beforeEach(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("CARD_IMPORT_TOKEN", "");
  db = await freshDb();
  access.db = db;
  access.email = ADMIN;
  for (const stub of Object.values(stubs)) if (typeof stub === "function") stub.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/api/admin/videos/transcripts", () => {
  it("reports scraper stats", async () => {
    stubs.getTranscriptScraperStats.mockResolvedValue({ withTranscript: 3, total: 10 });
    expect(await (await transcripts.GET(request("/x"))).json()).toEqual({ withTranscript: 3, total: 10 });
  });

  it("scrapes a clamped page, with a provider key only when summaries are wanted", async () => {
    stubs.scrapeTranscriptsPage.mockResolvedValue({ scraped: 2 });
    stubs.sharedProviderKey.mockReturnValue({ provider: "x", key: "k" });

    await transcripts.POST(request("/x", { method: "POST", body: { afterId: "abc", limit: 500, generateSummaries: true } }));
    expect(stubs.scrapeTranscriptsPage).toHaveBeenCalledWith(db, "abc", 100, true, { provider: "x", key: "k" });

    await transcripts.POST(request("/x", { method: "POST", body: "nope" }));
    expect(stubs.scrapeTranscriptsPage).toHaveBeenLastCalledWith(db, null, 20, false, null);
  });

  it("reports failures", async () => {
    stubs.getTranscriptScraperStats.mockRejectedValue(new Error("boom"));
    stubs.scrapeTranscriptsPage.mockRejectedValue(new Error("boom"));
    expect((await transcripts.GET(request("/x"))).status).toBe(500);
    expect((await transcripts.POST(request("/x", { method: "POST", body: {} }))).status).toBe(500);
  });

  it("is admin-only, even for moderators", async () => {
    access.email = MODERATOR;
    expect((await transcripts.GET(request("/x"))).status).toBe(403);
    expect((await transcripts.POST(request("/x", { method: "POST" }))).status).toBe(403);
  });
});
