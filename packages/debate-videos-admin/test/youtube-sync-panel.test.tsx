/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Each of these cards has its own suite; here they only mark where the sync
// panel mounts them.
vi.mock("../src/components/YoutubeChannelsPanel", () => ({ YoutubeChannelsPanel: () => <div>channels-card</div> }));
vi.mock("../src/components/TranscriptScraperPanel", () => ({ TranscriptScraperPanel: () => <div>transcripts-card</div> }));
vi.mock("../src/components/ReclassifyVideosPanel", () => ({ ReclassifyVideosPanel: () => <div>reclassify-card</div> }));
vi.mock("../src/components/TeamLongNamesPanel", () => ({ TeamLongNamesPanel: () => <div>team-names-card</div> }));
vi.mock("../src/components/TournamentYearsPanel", () => ({ TournamentYearsPanel: () => <div>years-card</div> }));
vi.mock("../src/components/ComputedTitlesPanel", () => ({ ComputedTitlesPanel: () => <div>titles-card</div> }));
vi.mock("../src/components/CollegeResultsPanel", () => ({ CollegeResultsPanel: () => <div>college-card</div> }));
vi.mock("../src/components/TabroomResultsPanel", () => ({ TabroomResultsPanel: () => <div>tabroom-card</div> }));

import { YoutubeSyncPanel } from "../src/components/YoutubeSyncPanel";
import { bodyText, button, change, cleanup, clickAsync, flush, installDomShims, jsonResponse, mockFetch, mount } from "./helpers/dom";

beforeAll(() => {
  installDomShims();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const RESYNC = "/api/admin/youtube/resync";
const VIEWS = "/api/admin/videos/view-counts";
const DURATIONS = "/api/admin/videos/durations";
const SEED = "/api/admin/videos/seed";
const STACKS = "/api/admin/videos/recompute-stacks";

const durationStatus = {
  videos: 100,
  withDuration: 90,
  withoutDuration: 10,
  publishedSeconds: 3600 * 5 + 60 * 7,
  queuedSeconds: 3600,
  totalSeconds: 3600 * 6 + 60 * 7,
};

describe("YoutubeSyncPanel access", () => {
  it("gives moderators only the channel resync and the channel list, without loading admin status", async () => {
    const { calls } = mockFetch([{ method: "GET", match: RESYNC, respond: { runs: [] } }]);
    mount(<YoutubeSyncPanel isAdmin={false} />);
    await flush();
    expect(bodyText()).toContain("Resync YouTube rounds");
    expect(bodyText()).toContain("channels-card");
    expect(bodyText()).not.toContain("transcripts-card");
    expect(bodyText()).not.toContain("Seed videos");
    expect(calls.map((c) => c.url)).toEqual([RESYNC]);
  });

  it("shows every maintenance card to admins", async () => {
    mockFetch([]);
    mount(<YoutubeSyncPanel />);
    await flush();
    for (const text of [
      "channels-card",
      "transcripts-card",
      "Resync video view counts",
      "Fetch video durations",
      "Seed videos",
      "Recompute video stacks",
      "reclassify-card",
      "team-names-card",
      "years-card",
      "titles-card",
      "college-card",
      "tabroom-card",
    ]) {
      expect(bodyText()).toContain(text);
    }
  });
});

describe("round resync", () => {
  it("shows the last run, marking a scheduled one", async () => {
    mockFetch([
      {
        method: "GET",
        match: RESYNC,
        respond: {
          runs: [{ id: 3, status: "success", triggeredBy: "cron", channelsSynced: 12, videosUpserted: 7, roundsUpserted: 5, lecturesUpserted: 2, error: null }],
        },
      },
    ]);
    mount(<YoutubeSyncPanel isAdmin={false} />);
    await flush();
    expect(bodyText()).toContain("Last run (scheduled): success — 7 new videos (5 rounds, 2 lectures) from 12 channels");
  });

  it("shows a failed run's error without its counts", async () => {
    mockFetch([
      {
        method: "GET",
        match: RESYNC,
        respond: { runs: [{ id: 4, status: "error", channelsSynced: 0, videosUpserted: 0, error: "quota exceeded" }] },
      },
    ]);
    mount(<YoutubeSyncPanel isAdmin={false} />);
    await flush();
    expect(bodyText()).toContain("Last run: failed");
    expect(bodyText()).toContain("quota exceeded");
    expect(bodyText()).not.toContain("new videos");
  });

  it("posts the cutoff date and reports the finished run", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: RESYNC, respond: { runs: [] } },
      {
        method: "POST",
        match: RESYNC,
        respond: { runId: 9, channelsSynced: 4, videosUpserted: 3, roundsUpserted: 2, lecturesUpserted: 1 },
      },
    ]);
    mount(<YoutubeSyncPanel isAdmin={false} />);
    await flush();
    change(document.getElementById("resync-cutoff")!, "2025-01-01");
    await clickAsync(button("Resync videos"));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ publishedAfter: "2025-01-01" });
    expect(bodyText()).toContain("Last run: success — 3 new videos (2 rounds, 1 lectures) from 4 channels");
  });

  it("omits an empty cutoff and shows a failed resync", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: RESYNC, respond: { runs: [] } },
      { method: "POST", match: RESYNC, respond: { details: "YouTube API down" }, status: 502 },
    ]);
    mount(<YoutubeSyncPanel isAdmin={false} />);
    await flush();
    await clickAsync(button("Resync videos"));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({});
    expect(bodyText()).toContain("YouTube API down");
    expect(button("Resync videos").disabled).toBe(false);
  });
});

describe("view counts", () => {
  it("sizes the run before it starts", async () => {
    mockFetch([{ method: "GET", match: VIEWS, respond: { publishedVideos: 1200, queuedVideos: 34 } }]);
    mount(<YoutubeSyncPanel />);
    await flush();
    expect(bodyText()).toContain("Up to 1,234 videos to check");
  });

  it("summarizes updates, unavailable videos and availability, then reloads the count", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: VIEWS, respond: { publishedVideos: 10, queuedVideos: 0 } },
      {
        method: "POST",
        match: VIEWS,
        respond: {
          videosChecked: 2000,
          updated: 1500,
          missing: 3,
          availability: { available: 1990, private: 4, notEmbeddable: 2, removed: 1 },
        },
      },
    ]);
    mount(<YoutubeSyncPanel />);
    await flush();
    await clickAsync(button("Resync view counts"));
    expect(bodyText()).toContain(
      "Updated 1,500 of 2,000 view counts, 3 unavailable on YouTube. — availability: 1990 available, 4 private, 2 not embeddable, 1 removed.",
    );
    expect(calls.filter((c) => c.method === "GET" && c.url === VIEWS)).toHaveLength(2);
  });

  it("says when every count was already current", async () => {
    mockFetch([
      { method: "POST", match: VIEWS, respond: { videosChecked: 1200, updated: 0, missing: 0, availability: { available: 0, private: 0, notEmbeddable: 0, removed: 0 } } },
    ]);
    mount(<YoutubeSyncPanel />);
    await flush();
    await clickAsync(button("Resync view counts"));
    expect(bodyText()).toContain("All 1,200 view counts were already current.");
    expect(bodyText()).not.toContain("availability:");
  });

  it("shows a failed resync", async () => {
    mockFetch([{ method: "POST", match: VIEWS, respond: { error: "nope" }, status: 500 }]);
    mount(<YoutubeSyncPanel />);
    await flush();
    await clickAsync(button("Resync view counts"));
    expect(bodyText()).toContain("nope");
  });
});

describe("durations", () => {
  it("shows the stored totals in hours and minutes", async () => {
    mockFetch([{ method: "GET", match: DURATIONS, respond: durationStatus }]);
    mount(<YoutubeSyncPanel />);
    await flush();
    expect(bodyText()).toContain("90 of 100 videos have a duration · 6h 7m total (5h 7m published, 1h 0m queued)");
  });

  it("pages until the cursor runs out, totalling each page and refreshing the status", async () => {
    const pages = [
      { checked: 50, stored: 40, missing: 10, nextCursor: "v50", status: durationStatus },
      { checked: 20, stored: 20, missing: 0, nextCursor: null, status: { ...durationStatus, withDuration: 100 } },
    ];
    const { calls } = mockFetch([
      { method: "GET", match: DURATIONS, respond: durationStatus },
      { method: "POST", match: DURATIONS, respond: () => pages.shift() },
    ]);
    mount(<YoutubeSyncPanel />);
    await flush();
    await clickAsync(button("Fetch missing durations"));
    expect(calls.filter((c) => c.method === "POST").map((c) => c.body)).toEqual([
      { after: null, refresh: false },
      { after: "v50", refresh: false },
    ]);
    expect(bodyText()).toContain("Stored 60 of 70 checked, 10 unavailable on YouTube.");
    expect(bodyText()).toContain("100 of 100 videos have a duration");
  });

  it("Refetch all asks for a refresh", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: DURATIONS, respond: { checked: 1, stored: 1, missing: 0, nextCursor: null, status: durationStatus } },
    ]);
    mount(<YoutubeSyncPanel />);
    await flush();
    await clickAsync(button("Refetch all"));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ after: null, refresh: true });
  });

  it("shows a failing page and keeps the button usable", async () => {
    mockFetch([{ method: "POST", match: DURATIONS, respond: { details: "quota" }, status: 403 }]);
    mount(<YoutubeSyncPanel />);
    await flush();
    await clickAsync(button("Fetch missing durations"));
    expect(bodyText()).toContain("quota");
    expect(button("Fetch missing durations").disabled).toBe(false);
  });
});

describe("seed and stacks", () => {
  it("seeds the library and reloads the status", async () => {
    const status = { rows: 4, lastSeededAt: "2026-01-02T00:00:00Z", servingFrom: "sql" };
    const result = { rows: 10, statements: 2, durationMs: 1500 };
    const { calls } = mockFetch([
      { method: "GET", match: SEED, respond: status },
      { method: "POST", match: SEED, respond: result },
    ]);
    mount(<YoutubeSyncPanel />);
    await flush();
    expect(bodyText()).toContain("4 videos seeded (serving from SQL) — last touched 2026-01-02.");
    await clickAsync(button("Seed videos"));
    expect(calls.filter((c) => c.url === SEED).map((c) => c.method)).toEqual(["GET", "POST", "GET"]);
    expect(bodyText()).toContain("Seeded 10 videos in 1.5s (2 statements).");
    expect(bodyText()).not.toContain("videos seeded (serving from SQL)");
  });

  it("shows a failed seed", async () => {
    mockFetch([{ method: "POST", match: SEED, respond: { error: "seed broke" }, status: 500 }]);
    mount(<YoutubeSyncPanel />);
    await flush();
    await clickAsync(button("Seed videos"));
    expect(bodyText()).toContain("seed broke");
  });

  it("recomputes stacks and formats the result", async () => {
    const result = { rows: 9, updated: 4 };
    mockFetch([{ method: "POST", match: STACKS, respond: result }]);
    mount(<YoutubeSyncPanel />);
    await flush();
    await clickAsync(button("Recompute stacks"));
    expect(bodyText()).toContain("Updated 4 of 9 videos.");
  });

  it("shows a failed recompute", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === STACKS && init?.method === "POST" ? jsonResponse({ details: "locked" }, 500) : jsonResponse({}, 404),
    ) as unknown as typeof fetch;
    mount(<YoutubeSyncPanel />);
    await flush();
    await clickAsync(button("Recompute stacks"));
    expect(bodyText()).toContain("locked");
  });

  it("survives status endpoints that fail outright", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    mount(<YoutubeSyncPanel />);
    await flush();
    expect(bodyText()).toContain("Seed videos");
    expect(bodyText()).not.toContain("videos to check");
  });
});
