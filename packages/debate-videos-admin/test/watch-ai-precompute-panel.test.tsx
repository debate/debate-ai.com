/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  WATCH_AI_CURSOR_STORAGE_KEY,
  WatchAiPrecomputePanel,
  describeWatchAiResult,
  formatWatchAiRunProgress,
} from "../src/components/WatchAiPrecomputePanel";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "./helpers/dom";

beforeAll(() => {
  installDomShims();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const stats = { scope: "goat", rounds: 40, withSummaries: 12, withAlternatives: 10, aiConfigured: true };
const ENDPOINT = "/api/admin/videos/watch-ai";

const doneRound = {
  videoId: "a",
  title: "Round A",
  status: "done",
  speeches: ["1AR", "2NR", "2AR"],
  detected: false,
  summaries: ["1AR", "2NR", "2AR"],
  outcomes: ["1AR", "2NR", "2AR"],
  errors: [],
};

describe("WatchAiPrecomputePanel", () => {
  it("shows the counts and walks every page until done", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: ENDPOINT, respond: stats },
      {
        method: "POST",
        match: ENDPOINT,
        once: true,
        respond: { scanned: 5, processed: 1, skipped: 4, failed: 0, results: [doneRound], nextAfterId: "a", done: false },
      },
      {
        method: "POST",
        match: ENDPOINT,
        respond: { scanned: 3, processed: 0, skipped: 3, failed: 0, results: [], nextAfterId: "c", done: true },
      },
    ]);
    mount(<WatchAiPrecomputePanel />);
    await flush();
    expect(bodyText()).toContain("40 rounds · 12 with summaries · 10 with alternatives");

    await clickAsync(button("Generate for greatest of all-time rounds"));
    await flush();
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0].body).toMatchObject({ scope: "goat", afterId: null });
    expect(posts[1].body).toMatchObject({ afterId: "a" });
    expect(bodyText()).toContain("Checked 8 · generated 1 · already done 7 — done.");
    expect(bodyText()).toContain("Round A (1AR, 2NR, 2AR) — Wrote summaries for 1AR, 2NR, 2AR; alternatives for 1AR, 2NR, 2AR.");
    // A finished run leaves nothing to resume.
    expect(window.localStorage.getItem(WATCH_AI_CURSOR_STORAGE_KEY)).toBe("{}");
  });

  it("resumes from where a stopped run left off", async () => {
    window.localStorage.setItem(WATCH_AI_CURSOR_STORAGE_KEY, JSON.stringify({ goat: "xyz" }));
    const { calls } = mockFetch([
      { method: "GET", match: ENDPOINT, respond: stats },
      { method: "POST", match: ENDPOINT, respond: { scanned: 1, processed: 0, skipped: 1, failed: 0, results: [], nextAfterId: "z", done: true } },
    ]);
    mount(<WatchAiPrecomputePanel />);
    await flush();
    expect(bodyText()).toContain("Paused at xyz.");
    await clickAsync(button("Resume"));
    await flush();
    expect(calls.find((call) => call.method === "POST")!.body).toMatchObject({ afterId: "xyz" });
  });

  it("starts over without the saved cursor", async () => {
    window.localStorage.setItem(WATCH_AI_CURSOR_STORAGE_KEY, JSON.stringify({ goat: "xyz" }));
    mockFetch([{ method: "GET", match: ENDPOINT, respond: stats }]);
    mount(<WatchAiPrecomputePanel />);
    await flush();
    await clickAsync(button("Start over"));
    await flush();
    expect(button("Generate for greatest of all-time rounds")).toBeTruthy();
  });

  it("warns when no shared AI key is configured", async () => {
    mockFetch([{ method: "GET", match: ENDPOINT, respond: { ...stats, aiConfigured: false } }]);
    mount(<WatchAiPrecomputePanel />);
    await flush();
    expect(bodyText()).toContain("No shared AI key is configured");
    expect(button("Generate for greatest of all-time rounds").disabled).toBe(true);
  });
});

describe("formatWatchAiRunProgress", () => {
  it("says how a run ended", () => {
    const base = { checked: 3, generated: 1, skipped: 1, failed: 1, finished: false, stopped: false };
    expect(formatWatchAiRunProgress(base)).toBe("Checked 3 · generated 1 · already done 1 · failed 1…");
    expect(formatWatchAiRunProgress({ ...base, stopped: true })).toContain("stopped. Resume picks up from here.");
  });
});

describe("describeWatchAiResult", () => {
  it("lists partial failures", () => {
    expect(
      describeWatchAiResult({ ...doneRound, status: "done", summaries: [], outcomes: ["2AR"], errors: ["1AR alternatives: rate limited"] } as never),
    ).toBe("Wrote alternatives for 2AR. 1 step(s) failed: 1AR alternatives: rate limited");
    expect(describeWatchAiResult({ ...doneRound, status: "failed", reason: "No captions." } as never)).toBe("No captions.");
  });
});
