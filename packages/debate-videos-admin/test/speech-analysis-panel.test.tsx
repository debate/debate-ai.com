/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SpeechAnalysisPanel } from "../src/components/SpeechAnalysisPanel";
import {
  bodyText,
  button,
  change,
  cleanup,
  clickAsync,
  flush,
  installDomShims,
  mockFetch,
  mount,
} from "./helpers/dom";

beforeAll(() => {
  installDomShims();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const stats = { scope: "goat", totalVideos: 40, withTranscript: 30, analyzed: 10, aiConfigured: true };

describe("SpeechAnalysisPanel", () => {
  it("shows the Greatest of All-Time counts and the default prompt", async () => {
    const { calls } = mockFetch([{ method: "GET", match: "/api/admin/videos/speech-analysis", respond: stats }]);
    mount(<SpeechAnalysisPanel />);
    await flush();
    expect(calls[0].url).toContain("scope=goat");
    expect(bodyText()).toContain("40 videos · 30 with cached transcripts · 10 analyzed · 30 to go");
    expect(bodyText()).toContain("Order: Most viewed first.");
    const prompt = document.querySelector<HTMLTextAreaElement>("#speech-analysis-prompt")!;
    expect(prompt.value).toContain("alternative");
  });

  it("walks every page until done and sends the edited prompt", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: "/api/admin/videos/speech-analysis", respond: stats },
      {
        method: "POST",
        match: "/api/admin/videos/speech-analysis",
        once: true,
        respond: { processed: 1, saved: 1, results: [{ videoId: "a", title: "Round A", viewCount: 12345, status: "saved" }], nextAfterId: "a", done: false },
      },
      {
        method: "POST",
        match: "/api/admin/videos/speech-analysis",
        respond: { processed: 1, saved: 0, results: [{ videoId: "b", title: "Round B", status: "failed", error: "No captions." }], nextAfterId: "b", done: true },
      },
    ]);
    mount(<SpeechAnalysisPanel />);
    await flush();
    change(document.querySelector("#speech-analysis-prompt")!, "Summarize each speech.");
    await clickAsync(button("Process greatest of all-time videos"));
    await flush();

    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0].body).toMatchObject({ scope: "goat", afterId: null, instructions: "Summarize each speech." });
    expect(posts[1].body).toMatchObject({ afterId: "a" });
    expect(bodyText()).toContain("Done — wrote speech summaries and alternatives for 1 of 2 videos.");
    expect(bodyText()).toContain("1 skipped (no captions or failed)");
  });

  it("previews one video without saving", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: "/api/admin/videos/speech-analysis", respond: stats },
      {
        method: "POST",
        match: "/api/admin/videos/speech-analysis",
        respond: {
          processed: 1,
          saved: 0,
          results: [{ videoId: "m5x5KhnWbx4", title: "Shirley Finals", status: "preview", speeches: 2, summary: "## 1AC (0:00–8:00)\n\n- Plan", analysis: "## 1AC (0:00–8:00)\n\n- Read a CP" }],
          nextAfterId: null,
          done: true,
        },
      },
    ]);
    mount(<SpeechAnalysisPanel />);
    await flush();
    change(document.querySelector("input[placeholder^='One video']")!, "https://www.youtube.com/watch?v=m5x5KhnWbx4");
    await clickAsync(button("Preview"));
    await flush();

    const post = calls.find((call) => call.method === "POST")!;
    expect(post.body).toMatchObject({ videoId: "m5x5KhnWbx4", dryRun: true });
    expect(bodyText()).toContain("Preview of Shirley Finals: 2 speeches found. Nothing was saved.");
    expect(bodyText()).toContain("- Read a CP");
  });

  it("warns when no shared AI key is configured", async () => {
    mockFetch([{ method: "GET", match: "/api/admin/videos/speech-analysis", respond: { ...stats, aiConfigured: false } }]);
    mount(<SpeechAnalysisPanel />);
    await flush();
    expect(bodyText()).toContain("No shared AI key is configured");
    expect(button("Process greatest of all-time videos").disabled).toBe(true);
  });
});
