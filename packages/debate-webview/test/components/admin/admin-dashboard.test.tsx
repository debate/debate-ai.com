/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminDashboard } from "../../../src/components/admin/AdminDashboard";
import {
  bodyText,
  button,
  change,
  cleanup,
  click,
  clickAsync,
  flush,
  installDomShims,
  mockFetch,
  mount,
  type Route,
} from "../../helpers/dom";

// The real reader fetches the article from qwksearch; the dashboard only has
// to open it on the right URL and close it again.
vi.mock("@debate/research-evidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate/research-evidence")>()),
  SourceArticlePanel: ({ url, onClose }: { url: string; onClose: () => void }) => (
    <div data-testid="reader-panel">
      Reader for {url}
      <button onClick={onClose}>Close reader</button>
    </div>
  ),
}));

let observers: Array<{ callback: IntersectionObserverCallback; observed: Element[] }> = [];

beforeAll(() => {
  installDomShims();
  globalThis.IntersectionObserver = class {
    observed: Element[] = [];
    constructor(public callback: IntersectionObserverCallback) {
      observers.push(this);
    }
    observe(el: Element) {
      this.observed.push(el);
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});
beforeEach(() => {
  observers = [];
  window.history.replaceState(null, "", "/admin");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const nav = () => document.querySelector<HTMLElement>("nav[aria-label='Admin sections']")!;
const openTab = async (name: string) => {
  await clickAsync(button(name, nav()));
};

function queueVideo(id: string, overrides: Record<string, unknown> = {}) {
  return { id, title: `Round ${id}`, publishedAt: "2024-05-01", channel: "Chan", views: 1234, style: 2, tournament: "TOC", ...overrides };
}

/** Status endpoints every admin load hits, plus whatever the test adds first. */
function adminRoutes(extra: Route[] = []) {
  return mockFetch([
    ...extra,
    { method: "GET", match: "/api/admin/youtube/resync", respond: { runs: [{ id: 1, status: "success", triggeredBy: "cron", channelsSynced: 4, videosUpserted: 20, error: null }] } },
    { method: "GET", match: "/api/admin/videos/view-counts", respond: { publishedVideos: 100, queuedVideos: 23 } },
    {
      method: "GET",
      match: "/api/admin/videos/durations",
      respond: { videos: 10, withDuration: 8, withoutDuration: 2, publishedSeconds: 7200, queuedSeconds: 1800, totalSeconds: 9000 },
    },
    { method: "GET", match: "/api/admin/videos/seed", respond: { rows: 0, lastSeededAt: null, servingFrom: "json" } },
    {
      method: "GET",
      match: "/api/admin/youtube/videos?",
      respond: { videos: [queueVideo("aaa"), queueVideo("bbb", { style: 7, tournament: null })], nextCursor: "c2" },
    },
  ]);
}

describe("AdminDashboard", () => {
  it("opens on the Round queue, lists Users last and mirrors the tab into the hash", async () => {
    adminRoutes();
    mount(<AdminDashboard />);
    await flush();
    expect(bodyText()).toContain("Accounts, videos, the debate card library and imports");
    expect(window.location.hash).toBe("#queue");
    expect(button("Round queue", nav()).getAttribute("aria-current")).toBe("page");
    const names = [...nav().querySelectorAll("button")].map((b) => b.textContent);
    expect(names[0]).toBe("Round queue");
    expect(names[names.length - 1]).toBe("Users");

    await openTab("Backups");
    expect(window.location.hash).toBe("#backups");
    expect(bodyText()).toContain("SQL backup");
  });

  it("follows the URL hash, including later hash changes", async () => {
    adminRoutes();
    window.history.replaceState(null, "", "/admin#cards");
    mount(<AdminDashboard />);
    await flush();
    expect(bodyText()).toContain("Extract debate card source URLs");

    window.history.replaceState(null, "", "/admin#imports");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await flush();
    expect(bodyText()).toContain("Topic Starter library");
  });

  it("shows moderators only the content sections", async () => {
    const { calls } = adminRoutes();
    mount(<AdminDashboard isAdmin={false} />);
    await flush();
    expect(bodyText()).toContain("Moderation");
    const names = [...nav().querySelectorAll("button")].map((b) => b.textContent);
    expect(names).toEqual(["Round queue", "Video library", "School claims", "Topic starters"]);
    expect(calls.some((c) => c.url.includes("/resync"))).toBe(false);
    expect(bodyText()).toContain("Queued rounds waiting to be published");

    await openTab("Video library");
    expect(bodyText()).toContain("Reports & takedowns");
  });

  it("renders the round queue and publishes, deletes and pages through it", async () => {
    const { calls } = adminRoutes([
      { method: "POST", match: "/api/admin/youtube/videos/aaa", respond: { ok: true } },
      { method: "DELETE", match: "/api/admin/youtube/videos/bbb", respond: { error: "Delete refused" }, status: 500 },
      { method: "GET", match: "cursor=c2", respond: { videos: [queueVideo("ccc")], nextCursor: null } },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("Round queue");
    let text = bodyText();
    expect(text).toContain("Round aaa");
    expect(text).toContain("PF");
    expect(text).toContain("Unknown");
    expect(text).toContain(`${(1234).toLocaleString()} views`);

    // Scrolling the sentinel into view loads the next page.
    const observer = observers.at(-1)!;
    await act(async () => {
      observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
    });
    await flush();
    expect(calls.some((c) => c.url === "/api/admin/youtube/videos?cursor=c2")).toBe(true);
    expect(bodyText()).toContain("Round ccc");

    const publishButtons = [...document.querySelectorAll("button")].filter((b) => b.textContent === "Publish");
    await clickAsync(publishButtons[0]);
    expect(bodyText()).not.toContain("Round aaa");

    await clickAsync(button("Delete"));
    text = bodyText();
    expect(text).toContain("Delete refused");
    expect(text).toContain("Round bbb");
  });

  it("publishes all and deduplicates the queue", async () => {
    const { calls } = adminRoutes([
      { method: "POST", match: "/publish-all", respond: { published: 5, skipped: 2 }, once: true },
      { method: "POST", match: "/publish-all", respond: { published: 3 }, once: true },
      { method: "POST", match: "/publish-all", respond: { error: "Publish all exploded" }, status: 500 },
      { method: "POST", match: "/dedupe", respond: { removed: 1 }, once: true },
      { method: "POST", match: "/dedupe", respond: { removed: 0 } },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("Round queue");

    await clickAsync(button("Publish all"));
    expect(bodyText()).toContain("Published 5; skipped 2 already in the library (kept the existing versions).");
    await clickAsync(button("Publish all"));
    expect(bodyText()).toContain("Published 3.");
    await clickAsync(button("Deduplicate"));
    expect(bodyText()).toContain("Removed 1 duplicate queued video (matched by YouTube ID or title); kept the older copies.");
    await clickAsync(button("Deduplicate"));
    expect(bodyText()).toContain("No duplicates — no queued video matches the library or another queued video by YouTube ID or title.");
    await clickAsync(button("Publish all"));
    expect(bodyText()).toContain("Publish all exploded");
    expect(calls.filter((c) => c.url.startsWith("/api/admin/youtube/videos/publish-all?"))).toHaveLength(3);
  });

  it("shows the empty queue", async () => {
    mockFetch([{ method: "GET", match: "/api/admin/youtube/videos?", respond: { videos: [] } }]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("Round queue");
    expect(bodyText()).toContain("No videos to review — run a resync to populate this list.");
    expect(button("Publish all").disabled).toBe(true);
  });

  it("shows the YouTube sync status cards", async () => {
    adminRoutes();
    mount(<AdminDashboard />);
    await flush();
    await openTab("YouTube sync");
    const text = bodyText();
    expect(text).toContain("Last run (scheduled): success — 20 rounds from 4 channels");
    expect(text).toContain("Up to 123 videos to check");
    expect(text).toContain("8 of 10 videos have a duration · 2h 30m total (2h 0m published, 0h 30m queued)");
    expect(text).toContain("Subscribed YouTube channels");
  });

  it("resyncs rounds with the cutoff date and surfaces a failure", async () => {
    const { calls } = adminRoutes([
      { method: "POST", match: "/api/admin/youtube/resync", respond: { runId: 7, channelsSynced: 3, videosUpserted: 9 }, once: true },
      { method: "POST", match: "/api/admin/youtube/resync", respond: { details: "Quota exceeded" }, status: 429 },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("YouTube sync");
    change(document.getElementById("resync-cutoff")!, "2024-01-01");
    await clickAsync(button("Resync videos"));
    expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/resync"))!.body).toEqual({ publishedAfter: "2024-01-01" });
    expect(bodyText()).toContain("Last run: success — 9 rounds from 3 channels");
    await clickAsync(button("Resync videos"));
    expect(bodyText()).toContain("Quota exceeded");
  });

  it("shows a failed previous run", async () => {
    adminRoutes([{ method: "GET", match: "/api/admin/youtube/resync", respond: { runs: [{ id: 2, status: "error", channelsSynced: 0, videosUpserted: 0, error: "API key revoked" }] } }]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("YouTube sync");
    expect(bodyText()).toContain("Last run: failed");
    expect(bodyText()).toContain("API key revoked");
  });

  it("resyncs view counts and summarises availability", async () => {
    adminRoutes([
      {
        method: "POST",
        match: "/api/admin/videos/view-counts",
        once: true,
        respond: { updated: 5, videosChecked: 1200, missing: 2, availability: { available: 3, private: 1, notEmbeddable: 1, removed: 2 } },
      },
      { method: "POST", match: "/api/admin/videos/view-counts", once: true, respond: { updated: 0, videosChecked: 10, missing: 0 } },
      { method: "POST", match: "/api/admin/videos/view-counts", respond: { error: "View sync failed" }, status: 500 },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("YouTube sync");
    await clickAsync(button("Resync view counts"));
    expect(bodyText()).toContain(
      `Updated 5 of ${(1200).toLocaleString()} view counts, 2 unavailable on YouTube. — availability: 3 available, 1 private, 1 not embeddable, 2 removed.`,
    );
    await clickAsync(button("Resync view counts"));
    expect(bodyText()).toContain("All 10 view counts were already current.");
    await clickAsync(button("Resync view counts"));
    expect(bodyText()).toContain("View sync failed");
  });

  it("pages through duration fetches until the cursor runs out", async () => {
    const status = { videos: 10, withDuration: 10, withoutDuration: 0, publishedSeconds: 3600, queuedSeconds: 0, totalSeconds: 3600 };
    const { calls } = adminRoutes([
      { method: "POST", match: "/api/admin/videos/durations", once: true, respond: { checked: 5, stored: 4, missing: 1, nextCursor: "v5", status } },
      { method: "POST", match: "/api/admin/videos/durations", once: true, respond: { checked: 5, stored: 5, missing: 0, nextCursor: null, status } },
      { method: "POST", match: "/api/admin/videos/durations", respond: { error: "Quota" }, status: 403 },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("YouTube sync");
    await clickAsync(button("Fetch missing durations"));
    await flush();
    const posts = calls.filter((c) => c.method === "POST" && c.url.endsWith("/durations"));
    expect(posts.map((c) => c.body)).toEqual([
      { after: null, refresh: false },
      { after: "v5", refresh: false },
    ]);
    expect(bodyText()).toContain("Stored 9 of 10 checked, 1 unavailable on YouTube.");
    expect(bodyText()).toContain("10 of 10 videos have a duration · 1h 0m total");

    await clickAsync(button("Refetch all"));
    expect(calls.at(-1)!.body).toEqual({ after: null, refresh: true });
    expect(bodyText()).toContain("Quota");
  });

  it("seeds videos and recomputes stacks", async () => {
    adminRoutes([
      { method: "POST", match: "/api/admin/videos/seed", once: true, respond: { rows: 10, statements: 3, durationMs: 1500 } },
      { method: "POST", match: "/api/admin/videos/seed", respond: { error: "Seed broke" }, status: 500 },
      { method: "POST", match: "/api/admin/videos/recompute-stacks", once: true, respond: { rows: 50, updated: 4 } },
      { method: "POST", match: "/api/admin/videos/recompute-stacks", respond: { details: "Stack broke" }, status: 500 },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("YouTube sync");
    expect(bodyText()).toContain("Not seeded yet — the public feed is serving from the JSON fallback.");
    await clickAsync(button("Seed videos"));
    expect(bodyText()).toContain("Seeded 10 videos in 1.5s (3 statements).");
    await clickAsync(button("Seed videos"));
    expect(bodyText()).toContain("Seed broke");

    await clickAsync(button("Recompute stacks"));
    expect(bodyText()).toContain("Updated 4 of 50 videos.");
    await clickAsync(button("Recompute stacks"));
    expect(bodyText()).toContain("Stack broke");
  });

  it("extracts card URLs across pages and keeps a capped sample", async () => {
    const { calls } = adminRoutes([
      {
        method: "POST",
        match: "/extract-urls",
        once: true,
        respond: { processed: 100, withUrl: 60, updated: 10, nextAfterId: 100, done: false, demoUrls: ["https://a.example/1", "https://a.example/2"] },
      },
      { method: "POST", match: "/extract-urls", once: true, respond: { processed: 20, withUrl: 5, updated: 1, nextAfterId: 120, done: true, demoUrls: ["https://a.example/3"] } },
      { method: "POST", match: "/extract-urls", respond: { error: "Parser crashed" }, status: 500 },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("Debate cards");
    await clickAsync(button("Extract URLs"));
    await flush();
    expect(calls.filter((c) => c.url.endsWith("/extract-urls")).map((c) => c.body)).toEqual([
      { afterId: 0, limit: 100 },
      { afterId: 100, limit: 100 },
    ]);
    const text = bodyText();
    expect(text).toContain("Parsed 120 cards — 65 with a URL, 11 updated (done)");
    expect(text).toContain("Sample URLs found:");
    expect(text).toContain("https://a.example/3");

    await clickAsync(button("Extract URLs"));
    expect(bodyText()).toContain("Parser crashed");
  });

  it("validates card URLs page by page", async () => {
    adminRoutes([
      { method: "POST", match: "/validate-urls", once: true, respond: { checked: 100, valid: 90, invalid: 8, errors: 2, nextAfterId: 100, done: true } },
      { method: "POST", match: "/validate-urls", respond: { details: "HEAD blocked" }, status: 500 },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("Debate cards");
    click(button("Validate URLs"));
    await vi.waitFor(() =>
      expect(bodyText()).toContain("Checked 100 cards with URLs: 90 valid, 8 invalid, 2 errors."),
    );
    expect(bodyText()).toContain("Checked 100 — 90 valid, 8 invalid, 2 errors (done)");

    await clickAsync(button("Validate URLs"));
    expect(bodyText()).toContain("HEAD blocked");
  });

  it("purges the reuse-check log", async () => {
    adminRoutes([
      { method: "POST", match: "/evidence-reuse-check-log/purge", once: true, respond: { purgedCount: 0 } },
      { method: "POST", match: "/evidence-reuse-check-log/purge", once: true, respond: { purgedCount: 1 } },
      { method: "POST", match: "/evidence-reuse-check-log/purge", once: true, respond: { purgedCount: 7 } },
      { method: "POST", match: "/evidence-reuse-check-log/purge", respond: { error: "Purge failed hard" }, status: 500 },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("Debate cards");
    await clickAsync(button("Purge old entries now"));
    expect(bodyText()).toContain("No expired rows to purge.");
    await clickAsync(button("Purge old entries now"));
    expect(bodyText()).toContain("Purged 1 row older than the retention window.");
    await clickAsync(button("Purge old entries now"));
    expect(bodyText()).toContain("Purged 7 rows older than the retention window.");
    await clickAsync(button("Purge old entries now"));
    expect(bodyText()).toContain("Purge failed hard");
  });

  it("loads URL-detection stats and pages through detected URLs", async () => {
    const urls = Array.from({ length: 2 }, (_, i) => ({
      id: i + 1,
      userId: `user-${i}`,
      url: `https://site.example/${i}`,
      normalizedUrl: `site.example/${i}`,
      title: i === 0 ? "First page" : null,
      favicon: null,
      visitCount: 3,
      lastVisitedAt: 1_700_000_000_000,
      createdAt: 1_690_000_000_000,
      userName: i === 0 ? "Ada" : null,
      userEmail: i === 0 ? "ada@example.com" : null,
    }));
    const { calls } = adminRoutes([
      {
        method: "GET",
        match: "/api/admin/url-detection/stats",
        respond: { totalUrls: 1500, uniqueUsers: 12, totalVisits: 9000, periodDays: 30, topUrls: [
          { url: "https://top.example", title: null, visitCount: 77, lastVisitedAt: 1_700_000_000_000, userEmail: "bo@example.com" },
          { url: "https://news.example/2026/story", title: "A story", visitCount: 5, lastVisitedAt: 1_700_000_000_000, userEmail: null },
        ] },
      },
      { method: "GET", match: "offset=50", respond: { urls: urls.slice(1), total: 120 } },
      { method: "GET", match: "/api/admin/url-detection?", respond: { urls, total: 120 } },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("URL Detection");
    let text = bodyText();
    expect(calls.some((c) => c.url === "/api/admin/url-detection/stats?sinceDays=30")).toBe(true);
    expect(calls.some((c) => c.url === "/api/admin/url-detection?limit=50&offset=0&sinceDays=30")).toBe(true);
    expect(text).toContain((1500).toLocaleString());
    expect(text).toContain("Most Visited URLs");
    expect(text).toContain("https://top.example");
    expect(text).toContain("77 visits");
    expect(text).toContain("First page");
    expect(text).toContain("ada@example.com");
    expect(text).toContain("Ada");
    expect(text).toContain("user-1");
    expect(text).toContain("Checked by bo@example.com");

    // Article rows open in reader mode; a bare homepage gets no reader button.
    const readerButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button[title='Open in reader mode']"));
    expect(readerButtons).toHaveLength(3);
    await clickAsync(readerButtons[0]);
    expect(document.querySelector("[data-testid='reader-panel']")?.textContent).toContain("https://news.example/2026/story");
    await clickAsync(button("Close reader"));
    expect(document.querySelector("[data-testid='reader-panel']")).toBeNull();
    expect(text).toContain("Load more (2 of 120)");

    await clickAsync(button(/Load more/));
    expect(calls.some((c) => c.url.includes("offset=50"))).toBe(true);

    change(document.querySelector("input[placeholder='Search URL or title…']")!, "site");
    change(document.querySelector("input[placeholder='Filter by user ID or email…']")!, "user-0");
    await flush();
    await clickAsync(button("Search"));
    expect(calls.some((c) => c.url.includes("search=site") && c.url.includes("userId=user-0"))).toBe(true);

    const before = calls.length;
    await clickAsync(button("Refresh stats"));
    expect(calls.length).toBeGreaterThan(before);
    text = bodyText();
    expect(text).toContain("over the last 30 days");
  });

  it("reports a URL-detection failure and an empty list", async () => {
    adminRoutes([
      { method: "GET", match: "/api/admin/url-detection/stats", respond: {}, status: 500 },
      { method: "GET", match: "/api/admin/url-detection?", respond: {}, status: 503 },
    ]);
    mount(<AdminDashboard />);
    await flush();
    await openTab("URL Detection");
    expect(bodyText()).toContain("Request failed: 503");
    expect(bodyText()).toContain("No URLs found.");
  });
});
