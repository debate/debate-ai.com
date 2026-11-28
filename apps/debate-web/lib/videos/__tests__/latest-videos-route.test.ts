/**
 * @fileoverview `/api/homepage/latest-videos` against a real SQLite database:
 * the homepage strip shows the newest *available* videos, newest first, with a
 * clamped page size, a thumbnail and watch-page link per video, and a
 * human "N days ago" label; a database fault yields an empty strip, not an
 * error page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => db,
  getCloudflareContext: () => undefined,
}));
vi.mock("@debate-ai/videos", async (importActual) => ({
  ...(await importActual<typeof import("@debate-ai/videos")>()),
  loadVideoTeamRanks: async () => ({}),
}));

const route = await import("@/app/api/homepage/latest-videos/route");

const NOW = Date.UTC(2026, 10, 28, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

async function addVideo(videoId: string, agoMs: number, extra: Partial<typeof schema.videos.$inferInsert> = {}) {
  const published = new Date(NOW - agoMs);
  await db.insert(schema.videos).values({
    videoId,
    source: "lecture",
    title: `Lecture ${videoId}`,
    channel: "Debate Channel",
    publishedAt: published.toISOString(),
    publishedMs: published.getTime(),
    ...extra,
  });
}

const latest = async (query = "") => {
  const res = await route.GET(new Request(`https://debate-ai.com/api/homepage/latest-videos${query}`) as never);
  return res.json() as Promise<Array<{ id: string; title: string; channel: string; thumbnail: string; uploaded: string; watchUrl: string; duration: string }>>;
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db = await freshSchemaDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/homepage/latest-videos", () => {
  it("lists newest first, skipping videos that are no longer available", async () => {
    await addVideo("aaaaaaaaaaa", 3 * DAY);
    await addVideo("bbbbbbbbbbb", HOUR);
    await addVideo("ccccccccccc", 2 * HOUR, { availability: "missing" });

    const items = await latest();
    expect(items.map((item) => item.id)).toEqual(["bbbbbbbbbbb", "aaaaaaaaaaa"]);
    expect(items[0]).toMatchObject({
      title: "Lecture bbbbbbbbbbb",
      channel: "Debate Channel",
      thumbnail: "https://i.ytimg.com/vi/bbbbbbbbbbb/maxresdefault.jpg",
      duration: "",
    });
    expect(items[0].watchUrl).toContain("bbbbbbbbbbb");
  });

  it("prefers the stored computed title over the one it would build", async () => {
    await addVideo("aaaaaaaaaaa", HOUR, { computedTitle: "2026 Harvard Quarters: A vs B" });
    expect((await latest())[0].title).toBe("2026 Harvard Quarters: A vs B");
  });

  it.each([
    [30_000, "just now"],
    [MINUTE, "1 minute ago"],
    [5 * MINUTE, "5 minutes ago"],
    [HOUR, "1 hour ago"],
    [23 * HOUR, "23 hours ago"],
    [DAY, "1 day ago"],
    [6 * DAY, "6 days ago"],
    [7 * DAY, "1 week ago"],
    [27 * DAY, "3 weeks ago"],
    [60 * DAY, "2 months ago"],
    [400 * DAY, "1 year ago"],
    [800 * DAY, "2 years ago"],
  ])("labels an upload %i ms old as %j", async (age, label) => {
    await addVideo("aaaaaaaaaaa", age);
    expect((await latest())[0].uploaded).toBe(label);
  });

  it("returns ten by default, honours `limit` up to fifty, and ignores a junk limit", async () => {
    for (let n = 0; n < 55; n++) await addVideo(`video${String(n).padStart(6, "0")}`, n * MINUTE);
    expect(await latest()).toHaveLength(10);
    expect(await latest("?limit=3")).toHaveLength(3);
    expect(await latest("?limit=500")).toHaveLength(50);
    expect(await latest("?limit=0")).toHaveLength(10);
    expect(await latest("?limit=abc")).toHaveLength(10);
  });

  it("answers an empty strip when the database fails", async () => {
    await db.$client.execute("DROP TABLE videos");
    const res = await route.GET(new Request("https://debate-ai.com/api/homepage/latest-videos") as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
