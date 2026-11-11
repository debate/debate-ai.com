/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { IncompleteVideosPanel, formatAutofillRunProgress } from "../src/components/IncompleteVideosPanel";
import { fillMissingPatch, missingFields } from "../src/lib/incomplete-videos";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "./helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const COMPLETE_ROUND = {
  style: 1,
  tournament: "TOC",
  roundLevel: "Finals",
  affTeam: "Iowa EW",
  negTeam: "Emory GY",
  affWin: true,
  arg1ac: "Nuclear power",
  arg2nr: "Cap K",
};

describe("missingFields", () => {
  it("lists a round's blank fields and treats whitespace as blank", () => {
    expect(missingFields(COMPLETE_ROUND)).toEqual([]);
    expect(missingFields({ ...COMPLETE_ROUND, affTeam: "  ", affWin: null, arg2nr: null })).toEqual([
      "affTeam",
      "affWin",
      "arg2nr",
    ]);
  });

  it("asks a lecture only for its category", () => {
    expect(missingFields({ style: null, category: null, tournament: null })).toEqual(["category"]);
    expect(missingFields({ style: null, category: "Theory" })).toEqual([]);
  });
});

describe("fillMissingPatch", () => {
  it("fills only blanks and never overwrites or changes the style", () => {
    const patch = fillMissingPatch(
      { ...COMPLETE_ROUND, negTeam: null, affWin: null, judgeDecision: null },
      {
        tournament: "Harvard",
        negTeam: " Emory GY ",
        affWin: false,
        judgeDecision: "2-1",
        arg1ac: "",
      },
    );
    expect(patch).toEqual({ negTeam: "Emory GY", affWin: false, judgeDecision: "2-1" });
  });

  it("fills a lecture's category with its slug", () => {
    expect(fillMissingPatch({ style: null, category: null }, { category: "Theory & K", tournament: "TOC" })).toEqual({
      category: "Theory & K",
      categoryKey: "theory___k",
    });
  });

  it("returns nothing when the suggestion adds nothing", () => {
    expect(fillMissingPatch({ ...COMPLETE_ROUND, arg1ac: null }, { arg1ac: null })).toEqual({});
  });
});

describe("formatAutofillRunProgress", () => {
  it("reads as a running total and says how the run ended", () => {
    const base = { checked: 3, filled: 2, unchanged: 1, failed: 0, finished: false, stopped: false };
    expect(formatAutofillRunProgress(base)).toBe("Checked 3 · filled 2 · nothing to add 1…");
    expect(formatAutofillRunProgress({ ...base, failed: 1, finished: true })).toBe(
      "Checked 3 · filled 2 · nothing to add 1 · failed 1 — done.",
    );
    expect(formatAutofillRunProgress({ ...base, stopped: true })).toBe("Checked 3 · filled 2 · nothing to add 1 — stopped.");
  });
});

function video(videoId: string, overrides: Record<string, unknown> = {}) {
  return {
    videoId,
    source: "round",
    title: `Round ${videoId}`,
    publishedAt: "2024-05-01",
    channel: "Debate Channel",
    viewCount: 1,
    description: "",
    category: null,
    categoryKey: null,
    judgeDecision: null,
    isTopPick: false,
    speechDocsUrl: null,
    seasonYear: 2024,
    ...COMPLETE_ROUND,
    ...overrides,
  };
}

describe("IncompleteVideosPanel", () => {
  it("lists incomplete videos with what each is missing", async () => {
    const { calls } = mockFetch([
      {
        method: "GET",
        match: "/api/admin/videos/library?",
        respond: { videos: [video("AAAAAAAAAAA", { affTeam: null, arg2nr: null })], page: 1, pageCount: 1, total: 1 },
      },
    ]);
    mount(<IncompleteVideosPanel />);
    await flush();
    expect(calls[0].url).toBe("/api/admin/videos/library?incomplete=1&page=1&limit=25&sort=published&dir=desc");
    const text = bodyText();
    expect(text).toContain("Round AAAAAAAAAAA");
    expect(text).toContain("Aff team");
    expect(text).toContain("Neg args");
    expect(text).toContain("Autofill all (1)");
  });

  it("autofills every incomplete video by id, saving only the filled blanks", async () => {
    const first = video("AAAAAAAAAAA", { affTeam: null });
    const second = video("BBBBBBBBBBB", { arg2nr: null });
    const { calls } = mockFetch([
      {
        method: "GET",
        match: "sort=id",
        respond: (call: { url: string }) =>
          call.url.includes("after=")
            ? { videos: [], page: 1, pageCount: 1, total: 0 }
            : { videos: [first, second], page: 1, pageCount: 1, total: 2 },
      },
      {
        method: "GET",
        match: "/api/admin/videos/library?",
        respond: { videos: [first, second], page: 1, pageCount: 1, total: 2 },
      },
      {
        method: "POST",
        match: "/api/admin/videos/library/autofill",
        respond: (call: { body: { videoId: string } }) =>
          call.body.videoId === first.videoId
            ? { fields: { affTeam: "Iowa EW", tournament: "Other" } }
            : { fields: {} },
      },
      {
        method: "PATCH",
        match: "/api/admin/videos/library/",
        respond: (call: { body: Record<string, unknown> }) => ({ ok: true, video: { ...first, ...call.body } }),
      },
    ]);
    mount(<IncompleteVideosPanel />);
    await flush();
    await clickAsync(button("Autofill all (2)"));
    await vi.waitFor(() => expect(bodyText()).toContain("Checked 2 · filled 1 · nothing to add 1 — done."));

    const patches = calls.filter((call) => call.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0].url).toBe("/api/admin/videos/library/AAAAAAAAAAA");
    expect(patches[0].body).toEqual({ affTeam: "Iowa EW" });
    const batches = calls.filter((call) => call.url.includes("sort=id"));
    expect(batches[0].url).toContain("incomplete=1");
  });

  it("stops after repeated auto-fill failures", async () => {
    const rows = ["A", "B", "C", "D", "E", "F"].map((letter) => video(letter.repeat(11), { affTeam: null }));
    mockFetch([
      { method: "GET", match: "/api/admin/videos/library?", respond: { videos: rows, page: 1, pageCount: 1, total: 6 } },
      { method: "POST", match: "/autofill", respond: { error: "No AI key" }, status: 502 },
    ]);
    mount(<IncompleteVideosPanel />);
    await flush();
    await clickAsync(button("Autofill all (6)"));
    await vi.waitFor(() => expect(bodyText()).toContain("Stopped after 5 failures in a row. Last error: No AI key"));
  });
});
