/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
const dialog = vi.hoisted(() => ({ props: null as null | Record<string, any> }));

vi.mock("next/navigation", () => ({ useRouter: () => nav }));
vi.mock("../src/components/VideoEditDialog", () => ({
  VideoEditDialog: (props: Record<string, any>) => {
    dialog.props = props;
    return props.video ? <div data-testid="edit-dialog">{`editing ${props.video.id} as ${props.mode}`}</div> : null;
  },
}));

import { ReclassifyVideosPanel } from "../src/components/ReclassifyVideosPanel";
import { TranscriptScraperPanel } from "../src/components/TranscriptScraperPanel";
import { VideoStaffControls } from "../src/components/VideoStaffControls";
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
  selectOption,
  toggle,
} from "./helpers/dom";
import { act } from "react";

beforeAll(() => {
  installDomShims();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  nav.refresh.mockClear();
  nav.replace.mockClear();
  dialog.props = null;
  window.history.replaceState(null, "", "/");
});

describe("ReclassifyVideosPanel", () => {
  const URL = "/api/admin/videos/reclassify";

  it("pages through the library until there is no cursor and totals every page", async () => {
    const pages = [
      { updated: [1, 2], failed: [1], queueUpdated: 1, nextCursor: "c1" },
      { updated: [3], failed: [], queueUpdated: 2, nextCursor: null },
    ];
    const { calls } = mockFetch([{ method: "POST", match: URL, respond: () => pages.shift() }]);
    mount(<ReclassifyVideosPanel />);
    await clickAsync(button("Reclassify"));
    expect(calls.map((c) => c.body)).toEqual([
      { match: "Dartmouth RR", style: 4, parseRoundInfo: true, after: null },
      { match: "Dartmouth RR", style: 4, parseRoundInfo: true, after: "c1" },
    ]);
    expect(bodyText()).toContain("3 videos updated, 1 AI parses failed, 3 queued rounds restyled.");
  });

  it("sends the edited phrase, style and AI toggle", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: URL, respond: { updated: [], failed: [], queueUpdated: 0, nextCursor: null } },
    ]);
    mount(<ReclassifyVideosPanel />);
    change(document.getElementById("reclassify-match")!, "Wake Forest");
    change(document.getElementById("reclassify-style")!, "2");
    toggle(document.querySelector<HTMLInputElement>("input[type=checkbox]")!);
    await clickAsync(button("Reclassify"));
    expect(calls[0]!.body).toEqual({ match: "Wake Forest", style: 2, parseRoundInfo: false, after: null });
    expect(bodyText()).toContain("0 videos updated.");
  });

  it("disables the button while the phrase is under three characters", () => {
    mount(<ReclassifyVideosPanel />);
    change(document.getElementById("reclassify-match")!, "ab ");
    expect(button("Reclassify").disabled).toBe(true);
  });

  it("shows the server's message when a page fails", async () => {
    mockFetch([{ method: "POST", match: URL, respond: { details: "AI quota" }, status: 500 }]);
    mount(<ReclassifyVideosPanel />);
    await clickAsync(button("Reclassify"));
    expect(bodyText()).toContain("AI quota");
  });

  it("falls back to a generic message", async () => {
    mockFetch([{ method: "POST", match: URL, respond: {}, status: 500 }]);
    mount(<ReclassifyVideosPanel />);
    await clickAsync(button("Reclassify"));
    expect(bodyText()).toContain("Reclassify failed");
  });
});

describe("TranscriptScraperPanel", () => {
  const URL = "/api/admin/videos/transcripts";
  const stats = { totalVideos: 1200, withTranscript: 900, withoutTranscript: 300, withSummary: 40 };

  it("loads and shows the transcript stats", async () => {
    mockFetch([{ method: "GET", match: URL, respond: stats }]);
    mount(<TranscriptScraperPanel />);
    await flush();
    expect(bodyText()).toContain("900 of 1,200 videos have transcripts · 40 have AI summaries");
    expect(button("Scrape all transcripts").disabled).toBe(false);
  });

  it("disables scraping when every video already has a transcript", async () => {
    mockFetch([{ method: "GET", match: URL, respond: { ...stats, withoutTranscript: 0 } }]);
    mount(<TranscriptScraperPanel />);
    await flush();
    expect(button("Scrape all transcripts").disabled).toBe(true);
  });

  it("shows a load failure", async () => {
    mockFetch([{ method: "GET", match: URL, respond: { error: "no db" }, status: 500 }]);
    mount(<TranscriptScraperPanel />);
    await flush();
    expect(bodyText()).toContain("no db");
  });

  it("scrapes page by page, collects skipped videos and reloads the stats", async () => {
    const pages = [
      { processed: 25, scraped: 20, summarized: 0, errors: [{ videoId: "vid1", error: "no captions" }], nextAfterId: "vid25", done: false },
      { processed: 10, scraped: 9, summarized: 0, errors: [{ videoId: "vid2", error: "failed" }], nextAfterId: null, done: true },
    ];
    const { calls } = mockFetch([
      { method: "GET", match: URL, respond: stats },
      { method: "POST", match: URL, respond: () => pages.shift() },
    ]);
    mount(<TranscriptScraperPanel />);
    await flush();
    await clickAsync(button("Scrape all transcripts"));
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts.map((c) => c.body)).toEqual([
      { afterId: null, generateSummaries: false },
      { afterId: "vid25", generateSummaries: false },
    ]);
    expect(bodyText()).toContain("Done — scraped 29 transcripts.");
    expect(bodyText()).toContain("2 skipped (no captions or failed)");
    expect(bodyText()).toContain("vid1 — no captions");
    expect(calls.filter((c) => c.method === "GET")).toHaveLength(2);
  });

  it("asks for AI summaries when chosen and reports how many were written", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: URL, respond: stats },
      {
        method: "POST",
        match: URL,
        respond: { processed: 5, scraped: 5, summarized: 4, errors: [], nextAfterId: "x", done: true },
      },
    ]);
    mount(<TranscriptScraperPanel />);
    await flush();
    selectOption(document.querySelector("[role=combobox]")!, "Transcripts + AI summaries");
    await clickAsync(button("Scrape all transcripts"));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ afterId: null, generateSummaries: true });
    expect(bodyText()).toContain("Done — scraped 5 transcripts and wrote 4 AI summaries.");
  });

  it("surfaces a failing page", async () => {
    mockFetch([
      { method: "GET", match: URL, respond: stats },
      { method: "POST", match: URL, respond: { details: "quota" }, status: 429 },
    ]);
    mount(<TranscriptScraperPanel />);
    await flush();
    await clickAsync(button("Scrape all transcripts"));
    expect(bodyText()).toContain("quota");
    expect(bodyText()).not.toContain("Done —");
  });
});

describe("VideoStaffControls", () => {
  const video = { id: "abc" };
  const routes = (canEditContent: boolean) => [
    { method: "GET", match: "/api/admin/me", respond: { canEditContent } },
    { method: "GET", match: "/api/admin/videos/library/abc", respond: { video } },
  ];

  it("offers suggest mode to non-staff and loads the row before opening", async () => {
    const { calls } = mockFetch(routes(false));
    mount(<VideoStaffControls videoId="abc" />);
    await flush();
    await clickAsync(document.querySelector("button[aria-label='Suggest an edit to this video']")!);
    expect(calls.map((c) => c.url)).toContain("/api/admin/videos/library/abc");
    expect(bodyText()).toContain("editing abc as suggest");
  });

  it("opens the full editor for staff", async () => {
    mockFetch(routes(true));
    mount(<VideoStaffControls videoId="abc" />);
    await flush();
    await clickAsync(document.querySelector("button[aria-label='Edit this video']")!);
    expect(bodyText()).toContain("editing abc as staff");
  });

  it("stays in suggest mode when the role lookup fails", async () => {
    mockFetch([{ method: "GET", match: "/api/admin/me", respond: {}, status: 401 }]);
    mount(<VideoStaffControls videoId="abc" />);
    await flush();
    expect(document.querySelector("button[aria-label='Suggest an edit to this video']")).not.toBeNull();
  });

  it("shows an error and does not open the dialog when the video cannot be loaded", async () => {
    mockFetch([
      { method: "GET", match: "/api/admin/me", respond: { canEditContent: true } },
      { method: "GET", match: "/api/admin/videos/library/", respond: { details: "gone" }, status: 404 },
    ]);
    mount(<VideoStaffControls videoId="abc" />);
    await flush();
    await clickAsync(document.querySelector("button[aria-label='Edit this video']")!);
    expect(bodyText()).toContain("gone");
    expect(document.querySelector("[data-testid=edit-dialog]")).toBeNull();
  });

  async function openDialog() {
    mockFetch(routes(true));
    mount(<VideoStaffControls videoId="abc" />);
    await flush();
    await clickAsync(document.querySelector("button[aria-label='Edit this video']")!);
  }

  it("shows the moderator's notice after a suggestion is filed and closes the dialog", async () => {
    await openDialog();
    act(() => dialog.props!.onSubmitted("Thanks, a moderator will review it."));
    expect(bodyText()).toContain("Thanks, a moderator will review it.");
    expect(document.querySelector("[data-testid=edit-dialog]")).toBeNull();
  });

  it("refreshes the page after content is saved and sends a deleted video back to the library", async () => {
    await openDialog();
    act(() => dialog.props!.onContentSaved());
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    act(() => dialog.props!.onDeleted());
    expect(nav.replace).toHaveBeenCalledWith("/videos");
    expect(document.querySelector("[data-testid=edit-dialog]")).toBeNull();
  });

  it("closes without navigating", async () => {
    await openDialog();
    act(() => dialog.props!.onClose());
    expect(document.querySelector("[data-testid=edit-dialog]")).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("follows a moved watch page to its new address, keeping the open speech, query and hash", async () => {
    window.history.replaceState(null, "", "/videos/old-round/2ar?view=flow#top");
    await openDialog();
    act(() => dialog.props!.onSaved({}, { previousHref: "/videos/old-round", href: "/videos/new-round" }));
    expect(nav.replace).toHaveBeenCalledWith("/videos/new-round/2ar?view=flow#top");
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("re-renders in place when the address did not change", async () => {
    window.history.replaceState(null, "", "/videos/same");
    await openDialog();
    act(() => dialog.props!.onSaved({}, { previousHref: "/videos/same", href: "/videos/same" }));
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
    act(() => dialog.props!.onSaved({}));
    expect(nav.refresh).toHaveBeenCalledTimes(2);
  });
});
