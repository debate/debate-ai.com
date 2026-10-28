/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { VideoContentDialog } from "../src/components/VideoContentDialog";
import { VideoEditDialog, emptyLibraryVideo, type LibraryVideo } from "../src/components/VideoEditDialog";
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
  selectOption,
  toggle,
} from "./helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const VIDEO_ID = "dQw4w9WgXcQ";

function libraryVideo(overrides: Partial<LibraryVideo> = {}): LibraryVideo {
  return {
    ...emptyLibraryVideo(),
    videoId: VIDEO_ID,
    source: "round",
    title: "TOC Finals",
    channel: "Debate Channel",
    publishedAt: "2024-05-01",
    viewCount: 1500,
    description: "A round",
    style: 1,
    category: "Theory & Skills",
    tournament: "TOC",
    affWin: true,
    isTopPick: false,
    ...overrides,
  };
}

const input = (id: string) => document.getElementById(id) as HTMLInputElement;

describe("emptyLibraryVideo", () => {
  it("is a blank lecture row", () => {
    expect(emptyLibraryVideo()).toMatchObject({ videoId: "", source: "lecture", style: null, viewCount: 0, isTopPick: false });
  });
});

describe("VideoEditDialog", () => {
  it("renders nothing when no video is given", () => {
    mount(<VideoEditDialog video={null} onClose={() => {}} onSaved={() => {}} />);
    expect(bodyText()).not.toContain("Edit video");
  });

  it("prefills the form and PATCHes the coerced edit", async () => {
    const onSaved = vi.fn();
    const saved = libraryVideo({ title: "Renamed" });
    const { calls } = mockFetch([{ method: "PATCH", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { video: saved } }]);
    mount(<VideoEditDialog video={libraryVideo()} onClose={() => {}} onSaved={onSaved} />);

    expect(bodyText()).toContain(`${VIDEO_ID} — changes apply to the public library immediately.`);
    expect(input("video-title").value).toBe("TOC Finals");
    expect(input("video-viewCount").value).toBe("1500");

    change(input("video-title"), "  Renamed  ");
    selectOption(document.getElementById("video-category")!, "Counterplans & Theory");
    change(input("video-viewCount"), "abc");
    change(input("video-tournament"), "   ");
    change(document.getElementById("video-description")!, "New description");
    toggle(document.querySelector<HTMLInputElement>("input[type=checkbox]")!);

    await clickAsync(button("Save changes"));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body).toMatchObject({
      title: "Renamed",
      category: "Counterplans & Theory",
      categoryKey: "counterplans___theory",
      viewCount: 0,
      tournament: null,
      style: 1,
      affWin: true,
      description: "New description",
      isTopPick: true,
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("edits and saves each side's arguments", async () => {
    const { calls } = mockFetch([{ method: "PATCH", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { video: libraryVideo() } }]);
    mount(<VideoEditDialog video={libraryVideo({ arg1ac: "Old aff" })} onClose={() => {}} onSaved={() => {}} />);

    expect(input("video-arg1ac").value).toBe("Old aff");
    change(document.getElementById("video-arg1ac")!, "  Space plan; Asteroid advantage ");
    change(document.getElementById("video-arg2nr")!, "Cap K, Politics DA");

    await clickAsync(button("Save changes"));
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({
      arg1ac: "Space plan; Asteroid advantage",
      arg2nr: "Cap K, Politics DA",
    });
  });

  it("shows the save error and calls onClose from Cancel", async () => {
    const onClose = vi.fn();
    mockFetch([{ method: "PATCH", match: "/api/admin/videos/library/", respond: { details: "DB locked" }, status: 500 }]);
    mount(<VideoEditDialog video={libraryVideo({ style: null, affWin: false })} onClose={onClose} onSaved={() => {}} />);
    await clickAsync(button("Save changes"));
    expect(bodyText()).toContain("DB locked");
    click(button("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("auto-fills empty fields without blanking filled ones", async () => {
    const { calls } = mockFetch([
      {
        method: "POST",
        match: "/api/admin/videos/library/autofill",
        respond: {
          fields: {
            title: "",
            channel: "AI Channel",
            viewCount: 42,
            style: null,
            affWin: false,
            tournament: "NSDA",
            arg1ac: "Space plan; Asteroid advantage",
            arg2nr: null,
          },
          fromYouTube: true,
          fromAi: true,
          warnings: ["Model unsure about teams."],
        },
      },
    ]);
    mount(<VideoEditDialog video={libraryVideo({ arg2nr: "Cap K" })} onClose={() => {}} onSaved={() => {}} />);
    await clickAsync(button("✨ Auto-fill with AI"));

    expect(calls[0].body).toEqual({ videoId: VIDEO_ID, title: "TOC Finals", channel: "Debate Channel", description: "A round" });
    expect(input("video-title").value).toBe("TOC Finals");
    expect(input("video-channel").value).toBe("AI Channel");
    expect(input("video-viewCount").value).toBe("42");
    expect(input("video-tournament").value).toBe("NSDA");
    expect(input("video-arg1ac").value).toBe("Space plan; Asteroid advantage");
    expect(input("video-arg2nr").value).toBe("Cap K");
    expect(bodyText()).toContain("Filled from YouTube and AI — check the fields before saving. Model unsure about teams.");
  });

  it("reports an auto-fill failure", async () => {
    mockFetch([{ method: "POST", match: "/autofill", respond: { error: "No API key" }, status: 503 }]);
    mount(<VideoEditDialog video={libraryVideo()} onClose={() => {}} onSaved={() => {}} />);
    await clickAsync(button("✨ Auto-fill with AI"));
    expect(bodyText()).toContain("No API key");
  });

  it("adds a new video from a pasted link with a POST", async () => {
    const onSaved = vi.fn();
    const { calls } = mockFetch([{ method: "POST", match: /\/api\/admin\/videos\/library$/, respond: { video: libraryVideo() } }]);
    mount(<VideoEditDialog video={emptyLibraryVideo()} isNew onClose={() => {}} onSaved={onSaved} />);
    expect(bodyText()).toContain("Paste a YouTube link");
    expect(button("Add video").disabled).toBe(true);

    change(input("video-link"), "not a link!!");
    expect(bodyText()).toContain("That doesn't look like a YouTube link or video id.");

    change(input("video-link"), `https://www.youtube.com/watch?v=${VIDEO_ID}`);
    change(input("video-title"), "Brand new");
    await clickAsync(button("Add video"));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({ videoId: VIDEO_ID, title: "Brand new", style: null, affWin: null, category: null, categoryKey: null });
    expect(onSaved).toHaveBeenCalled();
  });
});

const contentVideo = { videoId: VIDEO_ID, title: "TOC Finals", channel: "Debate Channel", tournament: "TOC" };

function contentRoutes(extra: Parameters<typeof mockFetch>[0] = []) {
  return mockFetch([
    ...extra,
    {
      method: "GET",
      match: `/api/admin/videos/library/${VIDEO_ID}/documents`,
      respond: {
        documents: [
          { videoId: VIDEO_ID, kind: "transcript", title: "", body: "## 1AC — Aff (0:00)\n\nHello world speech.", author: "editor", model: "", wordCount: 120 },
        ],
      },
    },
    {
      method: "GET",
      match: `/api/admin/videos/library/${VIDEO_ID}/related`,
      respond: {
        relations: [
          { videoId: VIDEO_ID, relatedVideoId: "AAAAAAAAAAA", relation: "analysis", note: "Breakdown", position: 0 },
          { videoId: VIDEO_ID, relatedVideoId: "BBBBBBBBBBB", relation: "rematch", note: null, position: 1 },
        ],
      },
    },
  ]);
}

describe("VideoContentDialog", () => {
  it("loads documents and relations and shows the transcript editor", async () => {
    contentRoutes();
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    const text = bodyText();
    expect(text).toContain("TOC Finals — dQw4w9WgXcQ");
    expect(text).toContain("The full transcript of every speech in this round.");
    expect(text).toContain("1 speeches");
    expect(text).toContain("1AC — Aff");
    expect((document.getElementById("document-body") as HTMLTextAreaElement).value).toContain("Hello world");
    // Word-count badge (in k, like every count) on the Speeches tab and link count on Related videos.
    expect(button(/Speeches/).textContent).toContain("0.1k");
    expect(button(/Related videos/).textContent).toContain("2");
  });

  it("shows a load error from the documents endpoint", async () => {
    mockFetch([
      { match: "/documents", respond: { error: "Documents table missing" }, status: 500 },
      { match: "/related", respond: { relations: [] } },
    ]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    expect(bodyText()).toContain("Documents table missing");
  });

  it("saves the edited document and reports the word count", async () => {
    const onSaved = vi.fn();
    const { calls } = contentRoutes([
      {
        method: "PUT",
        match: "/documents",
        respond: { document: { videoId: VIDEO_ID, kind: "transcript", body: "x", wordCount: 1234, author: "ai" } },
      },
    ]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} onSaved={onSaved} />);
    await flush();
    change(document.getElementById("document-title")!, "Speeches heading");
    change(document.getElementById("document-body")!, "## 1NC — Neg (9:30)\n\nNew words here");
    await clickAsync(button("Save document"));

    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.body).toEqual({ kind: "transcript", title: "Speeches heading", body: "## 1NC — Neg (9:30)\n\nNew words here", author: "editor", model: "" });
    const message = "Saved the speeches (1.2k words).";
    expect(onSaved).toHaveBeenCalledWith(message);
    expect(bodyText()).toContain(message);
    // The returned author "ai" reveals the model field.
    expect(document.getElementById("document-model")).not.toBeNull();
  });

  it("surfaces a save failure", async () => {
    contentRoutes([{ method: "PUT", match: "/documents", respond: { details: "Too long" }, status: 413 }]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    await clickAsync(button("Save document"));
    expect(bodyText()).toContain("Too long");
  });

  it("deletes a document", async () => {
    const onSaved = vi.fn();
    const { calls } = contentRoutes([{ method: "DELETE", match: "/documents?kind=transcript", respond: { ok: true } }]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} onSaved={onSaved} />);
    await flush();
    await clickAsync(button("Delete"));
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
    expect(onSaved).toHaveBeenCalledWith("Document removed.");
    expect((document.getElementById("document-body") as HTMLTextAreaElement).value).toBe("");
  });

  it("imports YouTube captions after confirming the replace", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    contentRoutes([
      {
        match: `/api/transcript?videoId=${VIDEO_ID}`,
        respond: { snippets: [{ text: "First sentence.", start: 0, duration: 2 }, { text: "Second one.", start: 2, duration: 2 }] },
      },
    ]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    await clickAsync(button("Import YouTube captions"));
    expect(confirm).toHaveBeenCalledWith("Replace what's in the box with YouTube's captions?");
    const body = (document.getElementById("document-body") as HTMLTextAreaElement).value;
    expect(body).toMatch(/^## Part 1 \(0:00\)/);
    expect(body).toContain("First sentence.");
    expect(bodyText()).toContain("Imported YouTube's captions.");
  });

  it("keeps the box when the replace is declined and reports missing captions", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { calls } = contentRoutes([{ match: "/api/transcript", respond: { snippets: [], unavailable: "Captions disabled" } }]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    await clickAsync(button("Import YouTube captions"));
    expect(calls.some((c) => c.url.includes("/api/transcript"))).toBe(false);

    confirm.mockReturnValue(true);
    await clickAsync(button("Import YouTube captions"));
    expect(bodyText()).toContain("Captions disabled");
  });

  it("switches tabs to a blank summary document", async () => {
    contentRoutes();
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    click(button("Summary"));
    expect(bodyText()).toContain("An AI-written summary of the round");
    expect((document.getElementById("document-body") as HTMLTextAreaElement).value).toBe("");
    expect(button("Delete").disabled).toBe(true);
    expect(bodyText()).not.toContain("Import YouTube captions");
  });

  it("lists, reorders and unlinks related videos", async () => {
    const { calls } = contentRoutes([
      {
        method: "PATCH",
        match: "/related",
        respond: (call: { body: unknown }) => ({
          relations: (call.body as { order: string[] }).order.map((id, position) => ({
            videoId: VIDEO_ID,
            relatedVideoId: id,
            relation: id.startsWith("A") ? "analysis" : "rematch",
            note: null,
            position,
          })),
        }),
      },
      { method: "DELETE", match: "/related?relatedVideoId=", respond: { ok: true } },
    ]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    click(button(/Related videos/));
    let text = bodyText();
    expect(text).toContain("AAAAAAAAAAA");
    expect(text).toContain("Breakdown");
    expect(text).toContain("Rematch");

    const moveDown = document.querySelectorAll<HTMLButtonElement>("button[aria-label='Move down']");
    await clickAsync(moveDown[0]);
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body).toEqual({ order: ["BBBBBBBBBBB", "AAAAAAAAAAA"] });
    const items = [...document.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(items.findIndex((t) => t.includes("BBBBBBBBBBB"))).toBeLessThan(items.findIndex((t) => t.includes("AAAAAAAAAAA")));

    await clickAsync(button("Unlink"));
    const del = calls.find((c) => c.method === "DELETE")!;
    expect(del.url).toContain("relatedVideoId=BBBBBBBBBBB&relation=rematch");
    text = bodyText();
    expect(text).not.toContain("BBBBBBBBBBB");
  });

  it("rolls a failed reorder back", async () => {
    contentRoutes([{ method: "PATCH", match: "/related", respond: { error: "Reorder refused" }, status: 500 }]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    click(button(/Related videos/));
    await clickAsync(document.querySelectorAll<HTMLButtonElement>("button[aria-label='Move up']")[1]);
    expect(bodyText()).toContain("Reorder refused");
    const items = [...document.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(items.findIndex((t) => t.includes("AAAAAAAAAAA"))).toBeLessThan(items.findIndex((t) => t.includes("BBBBBBBBBBB")));
  });

  it("searches the library and links a result with the note", async () => {
    const { calls } = contentRoutes([
      {
        match: "/api/admin/videos/library?q=",
        respond: {
          videos: [
            { videoId: "CCCCCCCCCCC", title: "Analysis video", channel: "Coach", tournament: "TOC", publishedAt: "2024" },
            { videoId: VIDEO_ID, title: "Self", channel: "x", tournament: null, publishedAt: "2024" },
          ],
        },
      },
      { method: "POST", match: "/related", respond: { ok: true } },
    ]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    click(button(/Related videos/));
    change(document.getElementById("link-note")!, " great breakdown ");
    change(document.getElementById("link-search")!, "an");
    await vi.waitFor(() => expect(bodyText()).toContain("Analysis video"));
    expect(bodyText()).toContain("Coach · TOC");
    // The video itself is filtered out of the candidates.
    expect(bodyText()).not.toContain("Self");

    await clickAsync(button("Link"));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toEqual({ relatedVideoId: "CCCCCCCCCCC", relation: "analysis", note: "great breakdown" });
    expect(bodyText()).toContain("Linked.");
  });

  it("reports a failed link and closes from the footer", async () => {
    const onOpenChange = vi.fn();
    contentRoutes([
      { match: "/api/admin/videos/library?q=", respond: { videos: [{ videoId: "CCCCCCCCCCC", title: "Analysis video", channel: "Coach", tournament: null, publishedAt: "" }] } },
      { method: "POST", match: "/related", respond: { error: "Already linked" }, status: 409 },
    ]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={onOpenChange} />);
    await flush();
    click(button(/Related videos/));
    change(document.getElementById("link-search")!, "analysis");
    await vi.waitFor(() => expect(bodyText()).toContain("Analysis video"));
    await clickAsync(button("Link"));
    expect(bodyText()).toContain("Already linked");

    click(button("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the empty related list", async () => {
    mockFetch([
      { match: "/documents", respond: { documents: [] } },
      { match: "/related", respond: {} },
    ]);
    mount(<VideoContentDialog video={contentVideo} onOpenChange={() => {}} />);
    await flush();
    click(button(/Related videos/));
    expect(bodyText()).toContain("Nothing linked to this video yet.");
  });
});
