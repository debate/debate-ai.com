/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RoundQueuePanel } from "../src/components/RoundQueuePanel";
import { VideoQueueEditDialog, type QueueVideo } from "../src/components/VideoQueueEditDialog";
import {
  allByText,
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
} from "./helpers/dom";

const observers: Array<{ callback: IntersectionObserverCallback; disconnect: () => void }> = [];

beforeAll(() => {
  installDomShims();
});
beforeEach(() => {
  observers.length = 0;
  globalThis.IntersectionObserver = class {
    private callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      observers.push({ callback, disconnect: () => {} });
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const queued = (id: string, over: Partial<QueueVideo> = {}): QueueVideo => ({
  id,
  title: `Title ${id}`,
  publishedAt: "2026-03-01",
  channel: "Chan",
  views: 1500,
  description: "desc",
  style: 1,
  category: null,
  tournament: null,
  roundLevel: null,
  aff: null,
  neg: null,
  winner: null,
  judgeDecision: null,
  ...over,
});

const LIST = "/api/admin/youtube/videos";

/** Scrolls the sentinel into view the way the browser would. */
function intersect() {
  act(() => observers.at(-1)!.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
}

describe("RoundQueuePanel list", () => {
  it("loads the queue and labels each row by style, lecture category and tournament", async () => {
    mockFetch([
      {
        method: "GET",
        match: LIST,
        respond: {
          videos: [
            queued("a", { style: 2, tournament: "Harvard" }),
            queued("b", { style: null, category: "Theory" }),
            queued("c", { style: null }),
            queued("d", { style: 99 }),
          ],
          nextCursor: null,
        },
      },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    expect(bodyText()).toContain("Title a");
    expect(bodyText()).toContain("PF");
    expect(bodyText()).toContain("Harvard");
    expect(bodyText()).toContain("Lecture — Theory");
    expect(bodyText()).toContain("Lecture");
    expect(bodyText()).toContain("Unknown");
    expect(document.querySelector<HTMLAnchorElement>("a[href='https://www.youtube.com/watch?v=a']")).not.toBeNull();
  });

  it("explains an empty queue", async () => {
    mockFetch([{ method: "GET", match: LIST, respond: { videos: [] } }]);
    mount(<RoundQueuePanel />);
    await flush();
    expect(bodyText()).toContain("No videos to review");
    expect(button("Publish all").disabled).toBe(true);
  });

  it("logs a failed load and shows an empty queue", async () => {
    mockFetch([{ method: "GET", match: LIST, respond: {}, status: 500 }]);
    mount(<RoundQueuePanel />);
    await flush();
    expect(console.error).toHaveBeenCalled();
    expect(bodyText()).toContain("No videos to review");
  });

  it("filters by style", async () => {
    const { calls } = mockFetch([{ method: "GET", match: LIST, respond: { videos: [queued("a")] } }]);
    mount(<RoundQueuePanel />);
    await flush();
    selectOption(document.querySelector("[role=combobox]")!, "College");
    await flush();
    expect(calls.map((c) => c.url)).toEqual([`${LIST}?`, `${LIST}?style=4`]);
  });

  it("loads the next page when the end of the list scrolls into view", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: "cursor=c1", respond: { videos: [queued("b")], nextCursor: null } },
      { method: "GET", match: LIST, respond: { videos: [queued("a")], nextCursor: "c1" } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    intersect();
    await flush();
    expect(calls.map((c) => c.url)).toContain(`${LIST}?cursor=c1`);
    expect(bodyText()).toContain("Title a");
    expect(bodyText()).toContain("Title b");
    const before = calls.length;
    intersect();
    await flush();
    expect(calls).toHaveLength(before);
  });

  it("keeps the first page when the next one fails", async () => {
    mockFetch([
      { method: "GET", match: "cursor=c1", respond: {}, status: 500 },
      { method: "GET", match: LIST, respond: { videos: [queued("a")], nextCursor: "c1" } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    intersect();
    await flush();
    expect(bodyText()).toContain("Title a");
    expect(console.error).toHaveBeenCalled();
  });
});

describe("RoundQueuePanel row actions", () => {
  const rowButton = (label: string, index = 0) => allByText(label, "button").filter((b) => b.textContent === label)[index]!;

  it("publishes a row and removes it from the queue", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: `${LIST}/a`, respond: { ok: true } },
      { method: "GET", match: LIST, respond: { videos: [queued("a"), queued("b")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(rowButton("Publish"));
    expect(calls.some((c) => c.method === "POST" && c.url === `${LIST}/a`)).toBe(true);
    expect(bodyText()).not.toContain("Title a");
    expect(bodyText()).toContain("Title b");
  });

  it("shows a publish failure on its row and keeps the row", async () => {
    mockFetch([
      { method: "POST", match: `${LIST}/a`, respond: { error: "already published" }, status: 409 },
      { method: "GET", match: LIST, respond: { videos: [queued("a")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(rowButton("Publish"));
    expect(bodyText()).toContain("already published");
    expect(bodyText()).toContain("Title a");
  });

  it("deletes a row, and reports a failed delete", async () => {
    mockFetch([
      { method: "DELETE", match: `${LIST}/a`, respond: { ok: true } },
      { method: "DELETE", match: `${LIST}/b`, respond: {}, status: 500 },
      { method: "GET", match: LIST, respond: { videos: [queued("a"), queued("b")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(rowButton("Delete", 0));
    expect(bodyText()).not.toContain("Title a");
    await clickAsync(rowButton("Delete", 0));
    expect(bodyText()).toContain("Delete failed");
    expect(bodyText()).toContain("Title b");
  });

  it("auto-detects one row and updates its badge and the notice", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: `${LIST}/detect`, respond: { results: [{ id: "a", style: 3, category: null }] } },
      { method: "GET", match: LIST, respond: { videos: [queued("a")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(rowButton("Auto-detect"));
    expect(calls.find((c) => c.url === `${LIST}/detect`)!.body).toEqual({ ids: ["a"] });
    expect(bodyText()).toContain('Detected "Title a" as LD.');
  });

  it("describes a detected lecture, and falls back to the batch's error", async () => {
    mockFetch([
      { method: "POST", match: `${LIST}/detect`, respond: { results: [{ id: "a", style: null, category: null }] }, once: true },
      { method: "POST", match: `${LIST}/detect`, respond: { results: [], errors: [{ id: "a", error: "model unavailable" }] } },
      { method: "GET", match: LIST, respond: { videos: [queued("a")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(rowButton("Auto-detect"));
    expect(bodyText()).toContain('Detected "Title a" as lecture — uncategorized.');
    await clickAsync(rowButton("Auto-detect"));
    expect(bodyText()).toContain("model unavailable");
  });

  it("shows a detect request failure on the row", async () => {
    mockFetch([
      { method: "POST", match: `${LIST}/detect`, respond: {}, status: 500 },
      { method: "GET", match: LIST, respond: { videos: [queued("a")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(rowButton("Auto-detect"));
    expect(bodyText()).toContain("Detection failed");
  });
});

describe("RoundQueuePanel bulk actions", () => {
  it("publishes everything in the filtered queue and reports skips", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: `${LIST}/publish-all`, respond: { published: 8, skipped: 2 } },
      { method: "GET", match: LIST, respond: { videos: [queued("a")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(button("Publish all"));
    expect(calls.find((c) => c.method === "POST")!.url).toBe(`${LIST}/publish-all?`);
    expect(bodyText()).toContain("Published 8; skipped 2 already in the library (kept the existing versions).");
    expect(calls.filter((c) => c.method === "GET")).toHaveLength(2);
  });

  it("reports a plain publish count, and a failed publish-all", async () => {
    mockFetch([
      { method: "POST", match: `${LIST}/publish-all`, respond: { published: 3 }, once: true },
      { method: "POST", match: `${LIST}/publish-all`, respond: { error: "D1 busy" }, status: 500 },
      { method: "GET", match: LIST, respond: { videos: [queued("a")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(button("Publish all"));
    expect(bodyText()).toContain("Published 3.");
    await clickAsync(button("Publish all"));
    expect(bodyText()).toContain("D1 busy");
    expect(bodyText()).not.toContain("Published 3.");
  });

  it("deduplicates and says how many copies went", async () => {
    mockFetch([
      { method: "POST", match: `${LIST}/dedupe`, respond: { removed: 1 }, once: true },
      { method: "POST", match: `${LIST}/dedupe`, respond: { removed: 0 }, once: true },
      { method: "POST", match: `${LIST}/dedupe`, respond: { error: "nope" }, status: 500 },
      { method: "GET", match: LIST, respond: { videos: [queued("a")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(button("Deduplicate"));
    expect(bodyText()).toContain("Removed 1 duplicate queued video (matched by YouTube ID or title); kept the older copies.");
    await clickAsync(button("Deduplicate"));
    expect(bodyText()).toContain("No duplicates");
    await clickAsync(button("Deduplicate"));
    expect(bodyText()).toContain("nope");
  });

  it("auto-detects the loaded queue five at a time and totals the outcome", async () => {
    const videos = Array.from({ length: 7 }, (_, i) => queued(`v${i}`));
    const { calls } = mockFetch([
      {
        method: "POST",
        match: `${LIST}/detect`,
        respond: ({ body }: { body: unknown }) => {
          const ids = (body as { ids: string[] }).ids;
          return ids.length === 5
            ? { results: ids.map((id) => ({ id, style: 2, category: null })) }
            : { results: [{ id: ids[0], style: 4, category: null }], errors: [{ id: ids[1], error: "bad title" }] };
        },
      },
      { method: "GET", match: LIST, respond: { videos } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(button("Auto-detect all"));
    const batches = calls.filter((c) => c.url === `${LIST}/detect`).map((c) => (c.body as { ids: string[] }).ids.length);
    expect(batches).toEqual([5, 2]);
    expect(bodyText()).toContain("Auto-detected 6 videos; 1 failed (see the rows).");
    expect(bodyText()).toContain("bad title");
  });

  it("reports how far detection got before a batch failed", async () => {
    const videos = Array.from({ length: 6 }, (_, i) => queued(`v${i}`));
    mockFetch([
      {
        method: "POST",
        match: `${LIST}/detect`,
        respond: ({ body }: { body: unknown }) => ({ results: (body as { ids: string[] }).ids.map((id) => ({ id, style: 1, category: null })) }),
        once: true,
      },
      { method: "POST", match: `${LIST}/detect`, respond: { error: "rate limited" }, status: 429 },
      { method: "GET", match: LIST, respond: { videos } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(button("Auto-detect all"));
    expect(bodyText()).toContain("rate limited (5 detected before it stopped)");
  });
});

describe("RoundQueuePanel editing", () => {
  it("opens the editor for a row, saves, and shows the edited title", async () => {
    const { calls } = mockFetch([
      { method: "PATCH", match: `${LIST}/a`, respond: { ok: true } },
      { method: "GET", match: LIST, respond: { videos: [queued("a")] } },
    ]);
    mount(<RoundQueuePanel />);
    await flush();
    await clickAsync(button("Edit"));
    expect(bodyText()).toContain("Edit queued video");
    change(document.getElementById("queue-video-title")!, "Fixed title");
    await clickAsync(button("Save changes"));
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({ title: "Fixed title", style: 1 });
    expect(bodyText()).not.toContain("Edit queued video");
    expect(bodyText()).toContain("Fixed title");
  });
});

describe("VideoQueueEditDialog", () => {
  it("renders nothing while no video is being edited", () => {
    mount(<VideoQueueEditDialog video={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(bodyText()).not.toContain("Edit queued video");
  });

  it("fills the form from the video, trims on save, and nulls blank fields", async () => {
    const onSaved = vi.fn();
    const { calls } = mockFetch([{ method: "PATCH", match: "/api/admin/youtube/videos/x1", respond: { ok: true } }]);
    const video = queued("x1", { style: null, category: "Theory", tournament: "TOC", winner: true, judgeDecision: "3-0", aff: "A", neg: "B" });
    mount(<VideoQueueEditDialog video={video} onClose={vi.fn()} onSaved={onSaved} />);
    expect((document.getElementById("queue-video-title") as HTMLInputElement).value).toBe("Title x1");
    expect((document.getElementById("queue-video-judgeDecision") as HTMLInputElement).value).toBe("3-0");
    expect(bodyText()).toContain("x1 — fix the metadata before publishing.");

    change(document.getElementById("queue-video-title")!, "  Padded  ");
    change(document.getElementById("queue-video-tournament")!, "   ");
    change(document.getElementById("queue-video-description")!, "  new text ");
    selectOption(document.getElementById("queue-video-style")!, "PF");
    selectOption(document.getElementById("queue-video-winner")!, "Neg won");
    selectOption(document.getElementById("queue-video-category")!, "None");
    await clickAsync(button("Save changes"));

    expect(calls[0]!.body).toEqual({
      title: "Padded",
      channel: "Chan",
      publishedAt: "2026-03-01",
      description: "new text",
      style: 2,
      category: null,
      tournament: null,
      roundLevel: null,
      aff: "A",
      neg: "B",
      winner: false,
      judgeDecision: "3-0",
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "x1", title: "Padded", style: 2, winner: false }));
  });

  it("keeps a legacy lecture category selectable and sends the lecture style as null", async () => {
    const { calls } = mockFetch([{ method: "PATCH", match: "/x2", respond: {} }]);
    mount(<VideoQueueEditDialog video={queued("x2", { style: null, category: "Legacy Label" })} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(allByText("Legacy Label", "[role=combobox]").length).toBeGreaterThan(0);
    await clickAsync(button("Save changes"));
    expect(calls[0]!.body).toMatchObject({ style: null, category: "Legacy Label", winner: null });
  });

  it("shows the server's error and does not report a save", async () => {
    const onSaved = vi.fn();
    mockFetch([{ method: "PATCH", match: "/x3", respond: { details: "row locked" }, status: 423 }]);
    mount(<VideoQueueEditDialog video={queued("x3")} onClose={vi.fn()} onSaved={onSaved} />);
    await clickAsync(button("Save changes"));
    expect(bodyText()).toContain("row locked");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("falls back to a generic error", async () => {
    mockFetch([{ method: "PATCH", match: "/x4", respond: {}, status: 500 }]);
    mount(<VideoQueueEditDialog video={queued("x4")} onClose={vi.fn()} onSaved={vi.fn()} />);
    await clickAsync(button("Save changes"));
    expect(bodyText()).toContain("Save failed");
  });

  it("cancels without saving", async () => {
    const onClose = vi.fn();
    const { calls } = mockFetch([]);
    mount(<VideoQueueEditDialog video={queued("x5")} onClose={onClose} onSaved={vi.fn()} />);
    await clickAsync(button("Cancel"));
    expect(onClose).toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("resets the form when a different video is opened", () => {
    const view = mount(<VideoQueueEditDialog video={queued("a", { title: "First" })} onClose={vi.fn()} onSaved={vi.fn()} />);
    change(document.getElementById("queue-video-title")!, "Edited");
    view.rerender(<VideoQueueEditDialog video={queued("b", { title: "Second" })} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect((document.getElementById("queue-video-title") as HTMLInputElement).value).toBe("Second");
  });
});
