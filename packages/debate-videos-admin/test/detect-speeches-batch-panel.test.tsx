/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  DETECT_SPEECHES_CURSOR_STORAGE_KEY,
  DetectSpeechesBatchPanel,
  formatDetectRunProgress,
} from "../src/components/DetectSpeechesBatchPanel";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "./helpers/dom";

beforeAll(() => {
  installDomShims();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const ENDPOINT = "/api/admin/videos/detect-speeches";
const stats = { rounds: 900, detected: 120, aiConfigured: true };

describe("formatDetectRunProgress", () => {
  const base = { checked: 12, detected: 4, skipped: 8, failed: 0, finished: false, stopped: false };
  it("reports the totals while running, waiting, stopped and done", () => {
    expect(formatDetectRunProgress(base)).toBe("Checked 12 · detected 4 · already done or no captions 8…");
    expect(formatDetectRunProgress({ ...base, waitingSeconds: 30 })).toContain("rate limited, retrying in 30s");
    expect(formatDetectRunProgress({ ...base, failed: 1, stopped: true })).toContain("failed 1 — stopped.");
    expect(formatDetectRunProgress({ ...base, finished: true })).toMatch(/— done\.$/);
  });
});

describe("DetectSpeechesBatchPanel", () => {
  it("shows the counts, runs from the newest round and clears the cursor when done", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: ENDPOINT, respond: stats },
      {
        method: "POST",
        match: ENDPOINT,
        respond: {
          scanned: 3,
          detected: 1,
          skipped: 2,
          failed: 0,
          results: [
            { videoId: "abcdefghijk", title: "Finals", publishedAt: "2026-11-20T00:00:00Z", status: "detected", speeches: ["1AC", "1NC"] },
          ],
          nextAfterId: "abcdefghijk",
          done: true,
          rateLimited: false,
        },
      },
    ]);
    mount(<DetectSpeechesBatchPanel />);
    await flush();
    expect(bodyText()).toContain("120 of 900 rounds have detected speeches");

    await clickAsync(button("Detect speeches on all rounds"));
    await flush();
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({ afterId: null });
    expect(bodyText()).toContain("Finals (2026-11-20) — Detected 2 speeches: 1AC, 1NC.");
    expect(bodyText()).toContain("— done.");
    expect(window.localStorage.getItem(DETECT_SPEECHES_CURSOR_STORAGE_KEY)).toBeNull();
  });

  it("offers Resume from a saved cursor", async () => {
    window.localStorage.setItem(DETECT_SPEECHES_CURSOR_STORAGE_KEY, "zzz");
    mockFetch([{ method: "GET", match: ENDPOINT, respond: stats }]);
    mount(<DetectSpeechesBatchPanel />);
    await flush();
    expect(button("Resume")).toBeTruthy();
    expect(bodyText()).toContain("Paused after zzz.");
  });
});
