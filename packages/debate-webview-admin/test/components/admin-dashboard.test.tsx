/** @vitest-environment jsdom */
/**
 * @fileoverview The admin dashboard shell: section navigation mirrored into
 * the URL hash, the moderator view, the round queue (publish, delete,
 * publish-all, dedupe, style filter, paging), the YouTube maintenance cards,
 * the debate-card URL tools and the URL-detection tables. The section panels
 * from other files are stubbed — they have tests of their own.
 */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { stub } = vi.hoisted(() => ({
  stub: (name: string) => () => <div data-testid={name}>{name}</div>,
}));
vi.mock("@debate-ai/videos-admin", () => ({
  TranscriptScraperPanel: stub("TranscriptScraperPanel"),
  VideoLibraryTable: stub("VideoLibraryTable"),
  VideoReportsPanel: stub("VideoReportsPanel"),
  YoutubeChannelsPanel: stub("YoutubeChannelsPanel"),
}));
vi.mock("../../src/components/users/UsersTable", () => ({ UsersTable: stub("UsersTable") }));
vi.mock("../../src/components/users/ModeratorsPanel", () => ({ ModeratorsPanel: stub("ModeratorsPanel") }));
vi.mock("../../src/components/data/CaselistSyncPanel", () => ({ CaselistSyncPanel: stub("CaselistSyncPanel") }));
vi.mock("../../src/components/data/DbBackupPanel", () => ({ DbBackupPanel: stub("DbBackupPanel") }));
vi.mock("../../src/components/data/DebateCardParquetUpload", () => ({ DebateCardParquetUpload: stub("DebateCardParquetUpload") }));
vi.mock("../../src/components/data/JudgeParadigmSyncPanel", () => ({ JudgeParadigmSyncPanel: stub("JudgeParadigmSyncPanel") }));
vi.mock("../../src/components/topic-starters/TopicStarterUpload", () => ({ TopicStarterUpload: stub("TopicStarterUpload") }));

import { AdminDashboard } from "../../src/components/AdminDashboard";
import { bodyText, button, byText, change, cleanup, click, flush, installDomShims, mockFetch, mount, selectOption, type Route } from "../helpers/dom";

const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
beforeAll(() => {
  installDomShims();
  globalThis.IntersectionObserver = class {
    constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
      observers.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  observers.length = 0;
  window.history.replaceState(null, "", "/admin");
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  error.mockRestore();
});

const video = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Round ${id}`,
  publishedAt: "2026-01-01",
  channel: "Debate TV",
  views: 1200,
  style: 2,
  tournament: "TOC",
  ...overrides,
});

const statusRoutes: Route[] = [
  { method: "GET", match: "/api/admin/youtube/resync", respond: { runs: [{ id: 1, status: "error", triggeredBy: "cron", channelsSynced: 0, videosUpserted: 0, error: "quota exceeded" }] } },
  { method: "GET", match: "/api/admin/videos/view-counts", respond: { publishedVideos: 10000, queuedVideos: 5000 } },
  { method: "GET", match: "/api/admin/videos/durations", respond: { videos: 10000, withDuration: 4000, withoutDuration: 6000, publishedSeconds: 7200, queuedSeconds: 60, totalSeconds: 7260 } },
  { method: "GET", match: "/api/admin/videos/seed", respond: { rows: 0, servingFrom: "json", lastSeededAt: null } },
];

async function render(routes: Route[], props: { isAdmin?: boolean } = {}) {
  const mock = mockFetch([...routes, ...statusRoutes, { method: "GET", match: "/api/admin/youtube/videos", respond: { videos: [], nextCursor: null } }]);
  mount(<AdminDashboard {...props} />);
  await flush();
  return mock;
}

const nav = (name: string) => byText(name, "nav button");
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

describe("AdminDashboard navigation", () => {
  it("opens on Users for admins and mirrors the section into the hash", async () => {
    await render([]);
    expect(bodyText()).toContain("Admin");
    expect(document.querySelector('[data-testid="UsersTable"]')).not.toBeNull();
    expect(window.location.hash).toBe("#users");
    click(nav("Video library"));
    expect(window.location.hash).toBe("#library");
    expect(document.querySelector('[data-testid="VideoReportsPanel"]')).not.toBeNull();
    click(nav("Imports"));
    expect(document.querySelector('[data-testid="CaselistSyncPanel"]')).not.toBeNull();
    click(nav("Backups"));
    expect(document.querySelector('[data-testid="DbBackupPanel"]')).not.toBeNull();
  });

  it("follows the hash on load and on change", async () => {
    window.history.replaceState(null, "", "/admin#cards");
    await render([]);
    expect(bodyText()).toContain("Extract debate card source URLs");
    act(() => {
      window.location.hash = "backups";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(document.querySelector('[data-testid="DbBackupPanel"]')).not.toBeNull();
  });

  it("shows moderators only the content sections and skips admin-only fetches", async () => {
    const { calls } = await render([], { isAdmin: false });
    expect(bodyText()).toContain("Moderation");
    expect(document.querySelector('[data-testid="VideoLibraryTable"]')).not.toBeNull();
    expect([...document.querySelectorAll("nav button")].map((b) => b.textContent)).toEqual(["Video library", "Round queue"]);
    expect(calls.some((c) => c.url.includes("/resync"))).toBe(false);
  });

  it("switches section from the narrow-screen dropdown", async () => {
    await render([]);
    selectOption(document.querySelector("[role=combobox]")!, "Round queue");
    expect(window.location.hash).toBe("#queue");
  });
});

describe("Round queue", () => {
  it("lists queued rounds and publishes or deletes one", async () => {
    window.history.replaceState(null, "", "/admin#queue");
    const { calls } = await render([
      { method: "POST", match: "/api/admin/youtube/videos/a", respond: { ok: true } },
      { method: "DELETE", match: "/api/admin/youtube/videos/b", respond: { error: "Locked" }, status: 409 },
      { method: "GET", match: "/api/admin/youtube/videos", respond: { videos: [video("a"), video("b", { style: 9, tournament: null })], nextCursor: null } },
    ]);
    expect(bodyText()).toContain("Round a");
    expect(bodyText()).toContain("PF");
    expect(bodyText()).toContain("Unknown");
    const rowOf = (title: string) => byText(title, "p").closest(".rounded-lg")!;
    click(button("Publish", rowOf("Round a")));
    await flush();
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/videos/a"))).toBe(true);
    expect(bodyText()).not.toContain("Round a");
    click(button("Delete", rowOf("Round b")));
    await flush();
    expect(bodyText()).toContain("Locked");
  });

  it("reports a failed publish and a successful delete", async () => {
    window.history.replaceState(null, "", "/admin#queue");
    await render([
      { method: "POST", match: "/api/admin/youtube/videos/a", respond: {}, status: 500 },
      { method: "DELETE", match: "/api/admin/youtube/videos/a", respond: { ok: true } },
      { method: "GET", match: "/api/admin/youtube/videos", respond: { videos: [video("a")], nextCursor: null } },
    ]);
    click(button("Publish"));
    await flush();
    expect(bodyText()).toContain("Publish failed");
    click(button("Delete"));
    await flush();
    expect(bodyText()).toContain("No videos to review");
  });

  it("publishes all, dedupes and filters by style", async () => {
    window.history.replaceState(null, "", "/admin#queue");
    const { calls } = await render([
      { method: "POST", match: "/publish-all", respond: { published: 3, skipped: 1 }, once: true },
      { method: "POST", match: "/publish-all", respond: { published: 2 } },
      { method: "POST", match: "/dedupe", respond: { removed: 1 }, once: true },
      { method: "POST", match: "/dedupe", respond: { removed: 0 }, once: true },
      { method: "POST", match: "/dedupe", respond: { error: "Dedupe broke" }, status: 500 },
      { method: "GET", match: "/api/admin/youtube/videos", respond: { videos: [video("a")], nextCursor: null } },
    ]);
    click(button("Publish all"));
    await flush();
    expect(bodyText()).toContain("Published 3; skipped 1 already in the library");
    click(button("Deduplicate"));
    await flush();
    expect(bodyText()).toContain("Removed 1 duplicate queued video");
    click(button("Deduplicate"));
    await flush();
    expect(bodyText()).toContain("No duplicates");
    click(button("Deduplicate"));
    await flush();
    expect(bodyText()).toContain("Dedupe broke");

    selectOption(document.querySelectorAll("[role=combobox]")[1], "LD");
    await flush();
    expect(calls.some((c) => c.url.includes("/api/admin/youtube/videos?style=3"))).toBe(true);
    click(button("Publish all"));
    await flush();
    expect(calls.some((c) => c.url.includes("/publish-all?style=3"))).toBe(true);
    expect(bodyText()).toContain("Published 2.");
  });

  it("reports a failed publish-all", async () => {
    window.history.replaceState(null, "", "/admin#queue");
    await render([
      { method: "POST", match: "/publish-all", respond: {}, status: 500 },
      { method: "GET", match: "/api/admin/youtube/videos", respond: { videos: [video("a")], nextCursor: null } },
    ]);
    click(button("Publish all"));
    await flush();
    expect(bodyText()).toContain("Publish all failed");
  });

  it("loads the next page when the sentinel scrolls into view", async () => {
    window.history.replaceState(null, "", "/admin#queue");
    const { calls } = await render([
      { method: "GET", match: "cursor=c2", respond: { videos: [video("z")], nextCursor: null } },
      { method: "GET", match: "/api/admin/youtube/videos", respond: { videos: [video("a")], nextCursor: "c2" } },
    ]);
    act(() => observers.at(-1)!([{ isIntersecting: true }]));
    await flush();
    expect(calls.some((c) => c.url.includes("cursor=c2"))).toBe(true);
    expect(bodyText()).toContain("Round z");
  });

  it("keeps the list when a page fails to load", async () => {
    window.history.replaceState(null, "", "/admin#queue");
    await render([
      { method: "GET", match: "cursor=c2", respond: {}, status: 500 },
      { method: "GET", match: "/api/admin/youtube/videos", respond: { videos: [video("a")], nextCursor: "c2" } },
    ]);
    act(() => observers.at(-1)!([{ isIntersecting: true }]));
    await flush();
    expect(bodyText()).toContain("Round a");
    expect(error).toHaveBeenCalledWith("Failed to load more videos:", expect.any(Error));
  });
});

describe("YouTube sync", () => {
  beforeEach(() => window.history.replaceState(null, "", "/admin#youtube"));

  it("shows the last scheduled run's failure and the status lines", async () => {
    await render([]);
    expect(bodyText()).toContain("Last run (scheduled): failed");
    expect(bodyText()).toContain("quota exceeded");
    expect(bodyText()).toContain("Up to 15k videos to check");
    expect(bodyText()).toContain("4.0k of 10k videos have a duration");
    expect(bodyText()).toContain("Not seeded yet");
  });

  it("resyncs rounds from a cutoff date", async () => {
    const { calls } = await render([
      { method: "POST", match: "/api/admin/youtube/resync", respond: { runId: 2, channelsSynced: 4, videosUpserted: 30 }, once: true },
      { method: "POST", match: "/api/admin/youtube/resync", respond: { error: "x", details: "API key missing" }, status: 500 },
    ]);
    change(document.querySelector("#resync-cutoff")!, "2026-02-01");
    click(button("Resync videos"));
    await flush();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ publishedAfter: "2026-02-01" });
    expect(bodyText()).toContain("Last run: success — 30 rounds from 4 channels");
    click(button("Resync videos"));
    await flush();
    expect(bodyText()).toContain("API key missing");
  });

  it.each([
    [{ updated: 0, videosChecked: 15000, missing: 0 }, "All 15k view counts were already current."],
    [
      { updated: 3000, videosChecked: 15000, missing: 2, availability: { available: 10, private: 1, notEmbeddable: 2, removed: 1 } },
      "Updated 3.0k of 15k view counts, 2 unavailable on YouTube. — availability: 10 available, 1 private, 2 not embeddable, 1 removed.",
    ],
    [{ updated: 1500, videosChecked: 1500, missing: 0, availability: { available: 0, private: 0, notEmbeddable: 0, removed: 0 } }, "Updated 1.5k of 1.5k view counts."],
  ])("summarises a view-count resync", async (result, summary) => {
    await render([{ method: "POST", match: "/view-counts", respond: result }]);
    click(button("Resync view counts"));
    await flush();
    expect(bodyText()).toContain(summary);
  });

  it("reports a failed view-count resync", async () => {
    await render([{ method: "POST", match: "/view-counts", respond: { error: "Quota" }, status: 429 }]);
    click(button("Resync view counts"));
    await flush();
    expect(bodyText()).toContain("Quota");
  });

  it("pages through durations until the walk is done", async () => {
    const page = (nextCursor: string | null, missing: number) => ({
      checked: 5000,
      stored: 4800,
      missing,
      nextCursor,
      status: { videos: 10000, withDuration: 10000, withoutDuration: 0, publishedSeconds: 3600 * 1500, queuedSeconds: 0, totalSeconds: 3600 * 1500 },
    });
    const { calls } = await render([
      { method: "POST", match: "/durations", respond: page("c1", 2000), once: true },
      { method: "POST", match: "/durations", respond: page(null, 0), once: true },
      { method: "POST", match: "/durations", respond: { error: "Durations down" }, status: 500 },
    ]);
    click(button("Refetch all"));
    await flush();
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts.map((c) => c.body)).toEqual([{ after: null, refresh: true }, { after: "c1", refresh: true }]);
    expect(bodyText()).toContain("Stored 9.6k of 10k checked, 2.0k unavailable on YouTube.");
    expect(bodyText()).toContain("10k of 10k videos have a duration · 1.5kh 0m total");
    click(button("Fetch missing durations"));
    await flush();
    expect(bodyText()).toContain("Durations down");
  });

  it("seeds videos and recomputes stacks", async () => {
    await render([
      { method: "POST", match: "/api/admin/videos/seed", respond: { rows: 1200, statements: 1, durationMs: 2500 }, once: true },
      { method: "POST", match: "/api/admin/videos/seed", respond: { error: "Seed broke" }, status: 500 },
      { method: "POST", match: "/recompute-stacks", respond: { rows: 50, updated: 0 }, once: true },
      { method: "POST", match: "/recompute-stacks", respond: { error: "Stacks broke" }, status: 500 },
    ]);
    click(button("Seed videos"));
    await flush();
    expect(bodyText()).toContain("Seeded 1,200 videos in 2.5s (1 statement).");
    click(button("Seed videos"));
    await flush();
    expect(bodyText()).toContain("Seed broke");
    click(button("Recompute stacks"));
    await flush();
    expect(bodyText()).toContain("No changes — checked 50 videos.");
    click(button("Recompute stacks"));
    await flush();
    expect(bodyText()).toContain("Stacks broke");
  });
});

describe("Debate card tools", () => {
  beforeEach(() => window.history.replaceState(null, "", "/admin#cards"));

  it("extracts source URLs page by page and shows samples", async () => {
    const { calls } = await render([
      { method: "POST", match: "/extract-urls", respond: { processed: 10000, withUrl: 6000, updated: 1000, nextAfterId: 100, done: false, demoUrls: ["https://a.example"] }, once: true },
      { method: "POST", match: "/extract-urls", respond: { processed: 2000, withUrl: 500, updated: 100, nextAfterId: 120, done: true, demoUrls: ["https://b.example"] }, once: true },
      { method: "POST", match: "/extract-urls", respond: { error: "Parser crashed" }, status: 500 },
    ]);
    click(button("Extract URLs"));
    await flush();
    expect(calls.filter((c) => c.url.includes("extract-urls")).map((c) => (c.body as { afterId: number }).afterId)).toEqual([0, 100]);
    expect(bodyText()).toContain("Parsed 12k cards — 6.5k with a URL, 1.1k updated (done)");
    expect(document.querySelector('a[href="https://b.example"]')).not.toBeNull();
    click(button("Extract URLs"));
    await flush();
    expect(bodyText()).toContain("Parser crashed");
  });

  it("validates URLs and reports the totals", async () => {
    await render([
      { method: "POST", match: "/validate-urls", respond: { checked: 10000, valid: 7000, invalid: 2000, errors: 1000, nextAfterId: 10, done: true }, once: true },
      { method: "POST", match: "/validate-urls", respond: { error: "x", details: "HEAD blocked" }, status: 500 },
    ]);
    click(button("Validate URLs"));
    await wait(150);
    await flush();
    expect(bodyText()).toContain("Checked 10k cards with URLs: 7.0k valid, 2.0k invalid, 1.0k errors.");
    click(button("Validate URLs"));
    await flush();
    expect(bodyText()).toContain("HEAD blocked");
  });

  it.each([
    [0, "No expired rows to purge."],
    [1, "Purged 1 row older than the retention window."],
    [4, "Purged 4 rows older than the retention window."],
  ])("purges the reuse-check log (%i rows)", async (purgedCount, message) => {
    await render([{ method: "POST", match: "/purge", respond: { purgedCount } }]);
    click(button("Purge old entries now"));
    await flush();
    expect(bodyText()).toContain(message);
  });

  it("reports a failed purge", async () => {
    await render([{ method: "POST", match: "/purge", respond: {}, status: 500 }]);
    click(button("Purge old entries now"));
    await flush();
    expect(bodyText()).toContain("Purge failed");
  });
});

describe("URL detection", () => {
  beforeEach(() => window.history.replaceState(null, "", "/admin#url-detection"));

  const row = (id: number, overrides: Record<string, unknown> = {}) => ({
    id,
    userId: `u${id}`,
    url: `https://site${id}.example`,
    normalizedUrl: "",
    title: null,
    favicon: null,
    visitCount: 3,
    lastVisitedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    userName: null,
    userEmail: id === 1 ? "a@example.com" : null,
    ...overrides,
  });

  it("loads stats and URLs, searches and pages", async () => {
    const { calls } = await render([
      {
        method: "GET",
        match: "/api/admin/url-detection/stats",
        respond: { totalUrls: 120, uniqueUsers: 8, totalVisits: 900, topUrls: [{ url: "https://top.example", title: "Top", visitCount: 40000, lastVisitedAt: 1_700_000_000_000 }], periodDays: 30 },
      },
      { method: "GET", match: "offset=50", respond: { urls: [row(3)], total: 51 } },
      { method: "GET", match: "/api/admin/url-detection?", respond: { urls: [row(1), row(2, { title: "Two", userName: "Bo" })], total: 51 } },
    ]);
    expect(bodyText()).toContain("Unique URLs");
    expect(bodyText()).toContain("Most Visited URLs");
    expect(bodyText()).toContain("40k visits");
    expect(bodyText()).toContain("a@example.com");
    expect(bodyText()).toContain("Bo");
    expect(bodyText()).toContain("Two");

    change(document.querySelector('input[placeholder="Search URL or title…"]')!, "site");
    change(document.querySelector('input[placeholder="Filter by user ID…"]')!, "u1");
    // A changed filter reloads on its own; Search runs it again on demand.
    await flush();
    click(button("Search"));
    await flush();
    expect(calls.some((c) => c.url.includes("search=site") && c.url.includes("userId=u1"))).toBe(true);

    click(button(/Load more/));
    await flush();
    expect(bodyText()).toContain("site3");

    selectOption(document.querySelectorAll("[role=combobox]")[1], "Last 7 days");
    await flush();
    expect(calls.some((c) => c.url.includes("stats?sinceDays=7"))).toBe(true);
    click(button("Refresh stats"));
    await flush();
  });

  it("shows empty and failed states", async () => {
    await render([
      { method: "GET", match: "/api/admin/url-detection/stats", respond: {}, status: 500 },
      { method: "GET", match: "/api/admin/url-detection?", respond: {}, status: 503 },
    ]);
    expect(bodyText()).toContain("Request failed: 503");
    expect(bodyText()).toContain("No URLs found.");
    expect(error).toHaveBeenCalledWith("Failed to load URL detection stats:", expect.any(Error));
  });
});
