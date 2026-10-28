/**
 * @fileoverview The admin maintenance routes that start a long job — the card
 * search index and the reuse index. The video jobs (stacks, view counts,
 * durations, seed, YouTube resync, autofill) are tested in
 * `@debate-ai/videos-admin`. The jobs themselves have
 * their own tests in the web app; these check what each route adds on top:
 * who may run it, how it reads its input, and how a failure comes back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debateCards } from "@/lib/database/schema";
import { ADMIN, MODERATOR, access } from "./helpers/access";
import { freshDb, request, type DB } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./helpers/access")).contextMock,
}));

const jobs = vi.hoisted(() => ({
  cardFtsStatus: vi.fn(),
  backfillCardFts: vi.fn(),
  rebuildCardFts: vi.fn(),
  optimizeCardFts: vi.fn(),
  resetCardFtsMemo: vi.fn(),
  ensureCardSortIndexes: vi.fn(),
}));
vi.mock("@/lib/search/card-fts", () => ({
  cardFtsStatus: jobs.cardFtsStatus,
  backfillCardFts: jobs.backfillCardFts,
  rebuildCardFts: jobs.rebuildCardFts,
  optimizeCardFts: jobs.optimizeCardFts,
  resetCardFtsMemo: jobs.resetCardFtsMemo,
}));
vi.mock("@/lib/search/card-search-indexes", () => ({ ensureCardSortIndexes: jobs.ensureCardSortIndexes }));

const searchIndex = await import("../src/api/admin/search-index");
const reuseIndex = await import("../src/api/admin/debate-cards/reuse-index");

let db: DB;

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
    ["search index status", () => searchIndex.GET(request("/x"))],
    ["search index action", () => searchIndex.POST(request("/x", { method: "POST", body: { action: "optimize" } }))],
    ["reuse index", () => reuseIndex.POST(request("/x", { method: "POST", body: {} }))],
  ])("%s", async (_label, call) => {
    access.email = MODERATOR;
    expect((await call()).status).toBe(403);
    expect(Object.values(jobs).every((job) => job.mock.calls.length === 0)).toBe(true);
  });
});

describe("card search index", () => {
  const post = (body: unknown) => searchIndex.POST(request("/x", { method: "POST", body }));

  it("reports status", async () => {
    jobs.cardFtsStatus.mockResolvedValue({ indexed: 10, total: 12 });
    expect(await (await searchIndex.GET(request("/x"))).json()).toEqual({ indexed: 10, total: 12 });
  });

  it("backfills, rebuilds and optimizes", async () => {
    jobs.backfillCardFts.mockResolvedValue({ indexed: 12 });
    jobs.cardFtsStatus.mockResolvedValue({ indexed: 12, total: 12 });

    expect(await (await post({ action: "backfill" })).json()).toEqual({ indexed: 12 });
    expect(await (await post({ action: "rebuild" })).json()).toEqual({ indexed: 12, total: 12 });
    expect(await (await post({ action: "optimize" })).json()).toEqual({ indexed: 12, total: 12 });

    expect(jobs.ensureCardSortIndexes).toHaveBeenCalledTimes(3);
    expect(jobs.rebuildCardFts).toHaveBeenCalledTimes(1);
    expect(jobs.optimizeCardFts).toHaveBeenCalledTimes(1);
    // Backfill and rebuild change what's indexed; optimize doesn't.
    expect(jobs.resetCardFtsMemo).toHaveBeenCalledTimes(2);
  });

  it("rejects an unknown action or a non-JSON body", async () => {
    expect((await post({ action: "drop" })).status).toBe(400);
    expect((await post("{")).status).toBe(400);
  });

  it("reports a failed job", async () => {
    jobs.rebuildCardFts.mockRejectedValue(new Error("fts5 missing"));
    const res = await post({ action: "rebuild" });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("fts5 missing");
  });

  it("accepts the card-import token", async () => {
    vi.stubEnv("CARD_IMPORT_TOKEN", "tok");
    access.email = null;
    jobs.cardFtsStatus.mockResolvedValue({});
    const req = request("/x");
    req.headers.set("authorization", "Bearer tok");
    expect((await searchIndex.GET(req)).status).toBe(200);
  });
});

describe("card reuse index", () => {
  const post = (body?: unknown) => reuseIndex.POST(request("/x", { method: "POST", body }));

  async function seedCards(count: number) {
    for (let index = 0; index < count; index++) {
      await db.insert(debateCards).values({
        tag: `Tag ${index}`,
        cite: `Smith ${index}`,
        fullcite: `Smith ${index}, Journal`,
        fulltext: "text",
      } as never);
    }
  }

  it("indexes cards a page at a time", async () => {
    await seedCards(3);
    const first = await (await post({ limit: 2 })).json();
    expect(first).toMatchObject({ processed: 2, done: false });
    const second = await (await post({ afterId: first.nextAfterId, limit: 2 })).json();
    expect(second).toMatchObject({ processed: 1, done: true });
  });

  it("is done at once on an empty table, even without a body", async () => {
    expect(await (await post()).json()).toEqual({ processed: 0, indexed: 0, nextAfterId: 0, done: true });
  });
});
