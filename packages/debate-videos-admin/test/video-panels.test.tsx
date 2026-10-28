/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { VideoLibraryTable } from "../src/components/VideoLibraryTable";
import { VideoReportsPanel } from "../src/components/VideoReportsPanel";
import { YoutubeChannelsPanel } from "../src/components/YoutubeChannelsPanel";
import {
  allByText,
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
  submit,
  toggle,
  type Route,
} from "./helpers/dom";

beforeAll(installDomShims);

/** The search box's 300ms debounce resets the page once after mount; let it fire. */
const settleSearchDebounce = () => new Promise((resolve) => setTimeout(resolve, 350)).then(() => flush());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const VIDEO_ID = "dQw4w9WgXcQ";

function row(overrides: Record<string, unknown> = {}) {
  return {
    videoId: VIDEO_ID,
    source: "round",
    title: "TOC Finals",
    publishedAt: "2024-05-01",
    channel: "Debate Channel",
    viewCount: 12345,
    description: "",
    style: 1,
    category: null,
    categoryKey: null,
    tournament: "TOC",
    roundLevel: null,
    affTeam: null,
    negTeam: null,
    affWin: null,
    judgeDecision: null,
    isTopPick: true,
    speechDocsUrl: null,
    seasonYear: 2024,
    transcriptWords: 4321,
    hasCaptions: false,
    ...overrides,
  };
}

function libraryRoutes(extra: Route[] = []) {
  return mockFetch([
    ...extra,
    {
      method: "GET",
      match: "/api/admin/videos/library?",
      respond: {
        videos: [
          row(),
          row({ videoId: "LLLLLLLLLLL", title: "", style: null, category: "Theory", channel: "", publishedAt: "", isTopPick: false, tournament: null, transcriptWords: null, hasCaptions: true }),
          row({ videoId: "UUUUUUUUUUU", title: "Mystery", style: 9, transcriptWords: 0, hasCaptions: false, isTopPick: false }),
        ],
        page: 1,
        limit: 25,
        pageCount: 3,
        total: 51,
      },
    },
  ]);
}

describe("VideoLibraryTable", () => {
  it("loads the library and renders each row's badges", async () => {
    const { calls } = libraryRoutes();
    mount(<VideoLibraryTable />);
    expect(bodyText()).toContain("Loading videos…");
    await flush();
    expect(calls[0].url).toBe("/api/admin/videos/library?page=1&limit=25&sort=published&dir=desc");
    const text = bodyText();
    expect(text).toContain("0.1k matching");
    expect(text).toContain("top pick");
    expect(text).toContain("Policy");
    expect(text).toContain("Lecture");
    expect(text).toContain("Unknown");
    expect(text).toContain("Theory");
    expect(text).toContain("4.3k words");
    expect(text).toContain("captions only");
    expect(text).toContain("Page 1 of 3");
  });

  it("sorts by column headers and pages", async () => {
    const { calls } = libraryRoutes();
    mount(<VideoLibraryTable />);
    await flush();
    await settleSearchDebounce();
    await clickAsync(button("Video"));
    expect(calls.at(-1)!.url).toContain("sort=title&dir=asc");
    await clickAsync(button(/^Video/));
    expect(calls.at(-1)!.url).toContain("sort=title&dir=desc");
    await clickAsync(button("Views"));
    expect(calls.at(-1)!.url).toContain("sort=views&dir=desc");
    await clickAsync(button("Next"));
    expect(calls.at(-1)!.url).toContain("page=2");
    await clickAsync(button("Previous"));
    expect(calls.at(-1)!.url).toContain("page=1");
  });

  it("shows the load error and the empty state", async () => {
    mockFetch([{ match: "/api/admin/videos/library?", respond: { error: "Library offline" }, status: 500 }]);
    mount(<VideoLibraryTable />);
    await flush();
    expect(bodyText()).toContain("Library offline");
    expect(bodyText()).toContain("No published videos match this filter.");
  });

  it("debounces the search into q", async () => {
    const { calls } = libraryRoutes();
    mount(<VideoLibraryTable />);
    await flush();
    change(document.querySelector("input[placeholder^='Search title']")!, " finals ");
    await vi.waitFor(() => expect(calls.some((c) => c.url.includes("q=finals"))).toBe(true));
  });

  it("rejects a bad link in the add-transcript box and opens the editor for a good one", async () => {
    const { calls } = libraryRoutes([
      { method: "GET", match: `/api/admin/videos/library/${VIDEO_ID}/documents`, respond: { documents: [] } },
      { method: "GET", match: `/api/admin/videos/library/${VIDEO_ID}/related`, respond: { relations: [] } },
      { method: "GET", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { error: "missing" }, status: 404 },
    ]);
    mount(<VideoLibraryTable />);
    await flush();
    const box = document.querySelector<HTMLInputElement>("input[aria-label='YouTube link or video id']")!;
    change(box, "nope nope");
    submit(box.closest("form")!);
    await flush();
    expect(bodyText()).toContain("That doesn't look like a YouTube link or video id.");

    change(box, `https://youtu.be/${VIDEO_ID}`);
    submit(box.closest("form")!);
    await flush();
    expect(calls.some((c) => c.url === `/api/admin/videos/library/${VIDEO_ID}`)).toBe(true);
    expect(bodyText()).toContain("Not in the library yet — dQw4w9WgXcQ");
    expect(box.value).toBe("");
  });

  it("opens the edit dialog and patches the saved row in place", async () => {
    libraryRoutes([
      { method: "PATCH", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { video: row({ title: "Fixed title" }) } },
    ]);
    mount(<VideoLibraryTable />);
    await flush();
    click(button("Edit"));
    expect(bodyText()).toContain("Edit video");
    await clickAsync(button("Save changes"));
    expect(bodyText()).toContain("Saved “Fixed title”.");
    expect(bodyText()).toContain("Fixed title");
  });

  it("adds a new video and reloads", async () => {
    const { calls } = libraryRoutes([
      { method: "POST", match: /\/api\/admin\/videos\/library$/, respond: { video: row({ title: "Added one" }) } },
    ]);
    mount(<VideoLibraryTable />);
    await flush();
    click(button("+ Add video"));
    change(document.getElementById("video-link")!, VIDEO_ID);
    const before = calls.filter((c) => c.method === "GET").length;
    await clickAsync(button("Add video"));
    expect(bodyText()).toContain("Added “Added one” to the library.");
    expect(calls.filter((c) => c.method === "GET").length).toBeGreaterThan(before);
  });

  it("opens the transcripts dialog for a row", async () => {
    libraryRoutes([
      { method: "GET", match: "/documents", respond: { documents: [] } },
      { method: "GET", match: "/related", respond: { relations: [] } },
    ]);
    mount(<VideoLibraryTable />);
    await flush();
    await clickAsync(button("Transcripts"));
    expect(bodyText()).toContain("Transcripts & related videos");
    expect(bodyText()).toContain("TOC Finals — dQw4w9WgXcQ");
  });

  it("removes a video after confirming, and shows a removal failure", async () => {
    const { calls } = libraryRoutes([
      { method: "DELETE", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { details: "Locked" }, status: 500, once: true },
      { method: "DELETE", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { ok: true } },
    ]);
    mount(<VideoLibraryTable />);
    await flush();
    click(button("Remove"));
    expect(bodyText()).toContain("Remove this video?");
    await clickAsync(button("Remove video"));
    expect(bodyText()).toContain("Locked");
    await clickAsync(button("Remove video"));
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(2);
    expect(bodyText()).toContain("Removed “TOC Finals” from the library.");
  });
});

function issue(overrides: Record<string, unknown> = {}) {
  return {
    id: "i1",
    videoId: VIDEO_ID,
    title: "TOC Finals",
    kind: "miscategorized",
    issue: "This is a PF round",
    suggestedStyle: 2,
    suggestedCategory: null,
    suggestedRoundLevel: "College",
    reportedBy: "viewer@example.com",
    status: "open",
    createdAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function reportRoutes(extra: Route[] = [], issues: unknown[] = [issue()]) {
  return mockFetch([
    ...extra,
    { method: "GET", match: "/api/video-issues?status=", respond: { issues } },
    {
      method: "GET",
      match: "/api/admin/videos/availability",
      respond: {
        videos: [
          { videoId: "RRRRRRRRRRR", title: "Removed one", channel: "Chan", availability: "removed", missingChecks: 1, availabilityCheckedAt: 1_700_000_000 },
          { videoId: "PPPPPPPPPPP", title: "", channel: "Chan", availability: "weird_state", missingChecks: 3, availabilityCheckedAt: null },
        ],
      },
    },
  ]);
}

describe("VideoReportsPanel", () => {
  it("lists reports and takedowns", async () => {
    reportRoutes([], [
      issue(),
      issue({ id: "i2", kind: "transcript", reportedBy: null, suggestedStyle: null, suggestedRoundLevel: null, issue: "", createdAt: 1_700_000_000 }),
      issue({ id: "i3", kind: "custom", reportedBy: null, status: "dismissed", suggestedStyle: null, suggestedRoundLevel: null, createdAt: "garbage", title: "" }),
    ]);
    mount(<VideoReportsPanel />);
    expect(bodyText()).toContain("Loading reports…");
    await flush();
    const text = bodyText();
    expect(text).toContain("Reported issues (3)");
    expect(text).toContain("Wrong category");
    expect(text).toContain("Should be: PF · College");
    expect(text).toContain("This is a PF round");
    expect(text).toContain("Needs transcript");
    expect(text).toContain("automatic");
    expect(text).toContain("anonymous");
    expect(text).toContain("unknown");
    expect(text).toContain("dismissed");
    expect(text).toContain("Unavailable videos (2)");
    expect(text).toContain("Gone from YouTube");
    expect(text).toContain("weird_state");
    expect(text).toContain("missed 1 check");
    expect(text).toContain("missed 3 checks");
    expect(text).toContain("last checked never");
    expect(button("Reopen")).toBeTruthy();
  });

  it("shows empty states and a failed load", async () => {
    mockFetch([
      { match: "/api/video-issues", respond: { issues: [] } },
      { match: "/api/admin/videos/availability", respond: { error: "x" }, status: 500 },
    ]);
    mount(<VideoReportsPanel />);
    await flush();
    expect(bodyText()).toContain("No reports waiting.");
    expect(bodyText()).toContain("Every stored video still plays.");
    cleanup();

    mockFetch([
      { match: "/api/video-issues", respond: { error: "Reports down" }, status: 500 },
      { match: "/api/admin/videos/availability", respond: { videos: [] } },
    ]);
    mount(<VideoReportsPanel />);
    await flush();
    expect(bodyText()).toContain("Reports down");
  });

  it("adds a submitted video to the library then marks it applied", async () => {
    const submission = issue({
      kind: "submit-video",
      issue: JSON.stringify({ url: `https://youtu.be/${VIDEO_ID}`, channel: "Debate Chan", note: "TOC final" }),
      suggestedStyle: null,
      suggestedRoundLevel: null,
    });
    const { calls } = reportRoutes(
      [
        { method: "POST", match: "/api/admin/videos/library", respond: { ok: true } },
        { method: "PATCH", match: "/api/video-issues", respond: { ok: true } },
      ],
      [submission],
    );
    mount(<VideoReportsPanel />);
    await flush();
    const text = bodyText();
    expect(text).toContain("Submitted video");
    expect(text).toContain("Channel: Debate Chan");
    expect(text).toContain("“TOC final”");
    await clickAsync(button("Add to library"));
    const post = calls.find((c) => c.method === "POST");
    expect(post?.body).toEqual({ videoId: VIDEO_ID, title: "TOC Finals", channel: "Debate Chan" });
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ id: "i1", status: "applied" });
    expect(bodyText()).toContain("Added “TOC Finals” to the library.");
  });

  it("subscribes to a submitted channel, and explains a moderator's 403", async () => {
    const submission = issue({
      kind: "submit-channel",
      videoId: "",
      title: "@DebateChan",
      issue: JSON.stringify({ url: "https://www.youtube.com/@DebateChan", note: "" }),
      suggestedStyle: null,
      suggestedRoundLevel: null,
    });
    const { calls } = reportRoutes(
      [
        { method: "POST", match: "/api/admin/youtube/channels", respond: { error: "Forbidden" }, status: 403, once: true },
        { method: "POST", match: "/api/admin/youtube/channels", respond: { channel: { id: 9 } } },
        { method: "PATCH", match: "/api/video-issues", respond: { ok: true } },
      ],
      [submission],
    );
    mount(<VideoReportsPanel />);
    await flush();
    expect(bodyText()).toContain("Submitted channel");
    await clickAsync(button("Subscribe"));
    expect(bodyText()).toContain("Only admins can subscribe to a channel");
    await clickAsync(button("Subscribe"));
    expect(calls.filter((c) => c.method === "POST").map((c) => c.body)).toEqual([
      { name: "@DebateChan" },
      { name: "@DebateChan" },
    ]);
    expect(bodyText()).toContain("Subscribed to @DebateChan");
  });

  it("applies a style correction then marks the report applied", async () => {
    const { calls } = reportRoutes([
      { method: "PATCH", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { video: { title: "TOC Finals" } } },
      { method: "PATCH", match: "/api/video-issues", respond: { ok: true } },
    ]);
    mount(<VideoReportsPanel />);
    await flush();
    await clickAsync(button("Apply"));
    const patches = calls.filter((c) => c.method === "PATCH");
    expect(patches[0].body).toEqual({ style: 2 });
    expect(patches[1].body).toEqual({ id: "i1", status: "applied" });
    expect(bodyText()).toContain("Recategorised “TOC Finals”.");
  });

  it("applies a category correction as a lecture", async () => {
    const { calls } = reportRoutes(
      [
        { method: "PATCH", match: "/api/admin/videos/library/", respond: { video: {} } },
        { method: "PATCH", match: "/api/video-issues", respond: { ok: true } },
      ],
      [issue({ suggestedStyle: 1, suggestedCategory: "Kritik Lectures" })],
    );
    mount(<VideoReportsPanel />);
    await flush();
    await clickAsync(button("Apply"));
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ style: null, category: "Kritik Lectures", categoryKey: "kritik_lectures" });
  });

  it("reports a failed correction", async () => {
    reportRoutes([{ method: "PATCH", match: "/api/admin/videos/library/", respond: { error: "Bad style" }, status: 400 }]);
    mount(<VideoReportsPanel />);
    await flush();
    await clickAsync(button("Apply"));
    expect(bodyText()).toContain("Bad style");
  });

  it("dismisses and reopens reports, and reports update failures", async () => {
    const { calls } = reportRoutes(
      [
        { method: "PATCH", match: "/api/video-issues", respond: { ok: true }, once: true },
        { method: "PATCH", match: "/api/video-issues", respond: { error: "Conflict" }, status: 409 },
      ],
      [issue({ suggestedStyle: null }), issue({ id: "i9", status: "applied", suggestedStyle: null })],
    );
    mount(<VideoReportsPanel />);
    await flush();
    await clickAsync(button("Dismiss"));
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ id: "i1", status: "dismissed" });
    await clickAsync(button("Reopen"));
    expect(bodyText()).toContain("Conflict");
  });

  it("includes resolved reports when asked", async () => {
    const { calls } = reportRoutes();
    mount(<VideoReportsPanel />);
    await flush();
    toggle(document.querySelector<HTMLInputElement>("input[type=checkbox]")!);
    await flush();
    expect(calls.some((c) => c.url === "/api/video-issues?status=all")).toBe(true);
    const before = calls.length;
    await clickAsync(button("Refresh"));
    expect(calls.length).toBeGreaterThan(before);
  });

  it("clears an availability flag, and shows a failure", async () => {
    const { calls } = reportRoutes([
      { method: "POST", match: "/api/admin/videos/availability", respond: { ok: true }, once: true },
      { method: "POST", match: "/api/admin/videos/availability", respond: { error: "Still gone" }, status: 400 },
    ]);
    mount(<VideoReportsPanel />);
    await flush();
    await clickAsync(allByText("It works now", "button")[0]);
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ videoId: "RRRRRRRRRRR" });
    expect(bodyText()).not.toContain("Removed one");
    await clickAsync(button("It works now"));
    expect(bodyText()).toContain("Still gone");
  });

  it("shows takedown counts and removes the chosen states after confirming", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const { calls } = reportRoutes([
      {
        method: "GET",
        match: "/api/admin/videos/availability",
        respond: {
          videos: [{ videoId: "RRRRRRRRRRR", title: "Removed one", channel: "Chan", availability: "removed", missingChecks: 1, availabilityCheckedAt: 1_700_000_000 }],
          counts: { removed: 3, private: 2, not_embeddable: 0 },
        },
      },
      { method: "DELETE", match: "/api/admin/videos/availability", respond: { ok: true, removed: 5 }, once: true },
      { method: "DELETE", match: "/api/admin/videos/availability", respond: { error: "Locked" }, status: 500 },
    ]);
    mount(<VideoReportsPanel />);
    await flush();
    expect(bodyText()).toContain("Gone from YouTube (3)");
    expect(bodyText()).toContain("Made private (2)");

    // Deleted uploads only, by default; declining the confirm sends nothing.
    await clickAsync(button("Remove 3 unavailable videos"));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    toggle(allByText(/Made private/, "label")[0].querySelector("input")!);
    await flush();
    await clickAsync(button("Remove 5 unavailable videos"));
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining("3 gone from youtube, 2 made private"));
    expect(calls.find((c) => c.method === "DELETE")!.body).toEqual({ states: ["removed", "private"] });
    expect(bodyText()).toContain("Removed 5 unavailable videos.");

    await clickAsync(button("Remove 5 unavailable videos"));
    expect(bodyText()).toContain("Locked");
  });

  it("removes one unavailable video, and checks YouTube on demand", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { calls } = reportRoutes([
      { method: "DELETE", match: "/api/admin/videos/library/RRRRRRRRRRR", respond: { ok: true } },
      { method: "POST", match: "/api/admin/videos/view-counts", respond: { videosChecked: 42 }, once: true },
      { method: "POST", match: "/api/admin/videos/view-counts", respond: { error: "No API key" }, status: 500 },
    ]);
    mount(<VideoReportsPanel />);
    await flush();
    expect(button("Remove 0 unavailable videos").disabled).toBe(true);
    await clickAsync(allByText("Remove", "button").find((b) => b.textContent === "Remove")!);
    expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/admin/videos/library/RRRRRRRRRRR")).toBe(true);
    expect(bodyText()).toContain("Removed “Removed one”.");

    await clickAsync(button("Check YouTube now"));
    expect(bodyText()).toContain("Checked 42 videos against YouTube.");
    await clickAsync(button("Check YouTube now"));
    expect(bodyText()).toContain("No API key");
  });

  it("opens the transcript editor for a needs-transcript report and applies it on save", async () => {
    const { calls } = reportRoutes(
      [
        { method: "GET", match: "/documents", respond: { documents: [] } },
        { method: "GET", match: "/related", respond: { relations: [] } },
        { method: "PUT", match: "/documents", respond: { document: { wordCount: 3 } } },
        { method: "PATCH", match: "/api/video-issues", respond: { ok: true } },
      ],
      [issue({ kind: "transcript", suggestedStyle: null, suggestedRoundLevel: null })],
    );
    mount(<VideoReportsPanel />);
    await flush();
    await clickAsync(button("Add transcript"));
    expect(bodyText()).toContain("Transcripts & related videos");
    change(document.getElementById("document-body")!, "one two three");
    await clickAsync(button("Save document"));
    const patch = calls.find((c) => c.method === "PATCH" && c.url === "/api/video-issues")!;
    expect(patch.body).toEqual({ id: "i1", status: "applied" });
  });
});

function channel(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    channelId: "UC123",
    name: "Kansas Debate",
    enabled: true,
    addedBy: "boss@example.com",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-02-01T00:00:00.000Z",
    ...overrides,
  };
}

function channelRoutes(extra: Route[] = []) {
  return mockFetch([
    ...extra,
    {
      method: "GET",
      match: "/api/admin/youtube/channels",
      respond: {
        channels: [channel({ videoCount: 12, latestVideo: { videoId: "abc123", title: "TOC Finals 2026", publishedAt: "2026-04-20" } }), channel({ id: 2, name: "", channelId: null, enabled: false, addedBy: null, createdAt: 1_700_000_000, updatedAt: 1_700_000_000 })],
        nextCursor: null,
      },
    },
  ]);
}

describe("YoutubeChannelsPanel", () => {
  it("lists the subscribed channels", async () => {
    const { calls } = channelRoutes();
    mount(<YoutubeChannelsPanel />);
    expect(bodyText()).toContain("Loading channels…");
    await flush();
    expect(calls[0].url).toBe("/api/admin/youtube/channels");
    const text = bodyText();
    expect(text).toContain("Most recent video");
    expect(text).toContain("TOC Finals 2026");
    expect(text).toContain("Kansas Debate");
    expect(text).toContain("(UC123)");
    expect(text).toContain("added by boss@example.com");
    expect(text).toContain("paused");
    expect(text).toContain(" · added ");
  });

  it("shows a load error and the empty list", async () => {
    mockFetch([{ match: "/api/admin/youtube/channels", respond: { error: "Nope" }, status: 500 }]);
    mount(<YoutubeChannelsPanel />);
    await flush();
    expect(bodyText()).toContain("Nope");
    expect(bodyText()).toContain("No subscribed channels yet.");
  });

  it("adds a channel, and reports a failed add", async () => {
    const { calls } = channelRoutes([
      { method: "POST", match: "/api/admin/youtube/channels", respond: { channel: { name: "@newchan" } }, once: true },
      { method: "POST", match: "/api/admin/youtube/channels", respond: { error: "Duplicate" }, status: 409 },
    ]);
    mount(<YoutubeChannelsPanel />);
    await flush();
    const inputEl = document.getElementById("channel-name") as HTMLInputElement;
    submit(inputEl.closest("form")!);
    await flush();
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    change(inputEl, " @newchan ");
    submit(inputEl.closest("form")!);
    await flush();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ name: "@newchan" });
    expect(bodyText()).toContain("Added “@newchan” to the subscribed channels.");

    change(inputEl, "dupe");
    submit(inputEl.closest("form")!);
    await flush();
    expect(bodyText()).toContain("Duplicate");
  });

  it("renames a channel, skipping unchanged names", async () => {
    const { calls } = channelRoutes([
      { method: "PATCH", match: "/api/admin/youtube/channels?id=1", respond: { channel: { name: "KU Debate" } }, once: true },
      { method: "PATCH", match: "/api/admin/youtube/channels?id=1", respond: { error: "Rename failed" }, status: 500 },
    ]);
    mount(<YoutubeChannelsPanel />);
    await flush();

    click(button("Edit"));
    const nameInput = () => document.querySelector<HTMLInputElement>("input[aria-label='Channel name']")!;
    expect(nameInput().value).toBe("Kansas Debate");
    // Saving the unchanged name just closes the editor.
    await clickAsync(button("Save"));
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    expect(document.querySelector("input[aria-label='Channel name']")).toBeNull();

    click(button("Edit"));
    change(nameInput(), "KU Debate");
    await clickAsync(button("Save"));
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ name: "KU Debate" });
    expect(bodyText()).toContain("Renamed “Kansas Debate” to “KU Debate”.");

    click(button("Edit"));
    change(nameInput(), "Another");
    await clickAsync(button("Save"));
    expect(bodyText()).toContain("Rename failed");
    click(button("Cancel"));
    expect(document.querySelector("input[aria-label='Channel name']")).toBeNull();
  });

  it("pauses and allows channels in", async () => {
    const { calls } = channelRoutes([
      { method: "PATCH", match: "/api/admin/youtube/channels?id=", respond: { ok: true }, once: true },
      { method: "PATCH", match: "/api/admin/youtube/channels?id=", respond: { ok: true }, once: true },
      { method: "PATCH", match: "/api/admin/youtube/channels?id=", respond: { error: "Toggle refused" }, status: 500 },
    ]);
    mount(<YoutubeChannelsPanel />);
    await flush();
    toggle(document.querySelector<HTMLInputElement>("input[aria-label='Pause channel']")!);
    await flush();
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ enabled: false });
    expect(bodyText()).toContain("Kansas Debate is paused — its rounds won't be picked up.");

    toggle(document.querySelectorAll<HTMLInputElement>("input[aria-label='Allow channel in']")[0]);
    await flush();
    expect(bodyText()).toContain("Kansas Debate is now allowed in.");

    toggle(document.querySelector<HTMLInputElement>("input[aria-label='Pause channel']")!);
    await flush();
    expect(bodyText()).toContain("Toggle refused");
  });

  it("removes a channel through the confirm dialog", async () => {
    const { calls } = channelRoutes([
      { method: "DELETE", match: "/api/admin/youtube/channels?id=1", respond: { error: "Remove failed" }, status: 500, once: true },
      { method: "DELETE", match: "/api/admin/youtube/channels?id=1", respond: { ok: true } },
    ]);
    mount(<YoutubeChannelsPanel />);
    await flush();
    click(allByText("Remove", "button")[0]);
    expect(bodyText()).toContain("Remove this channel?");
    await clickAsync(button("Remove channel"));
    expect(bodyText()).toContain("Remove failed");
    await clickAsync(button("Remove channel"));
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(2);
    expect(bodyText()).toContain("Removed “Kansas Debate” — it will no longer be scanned.");
    // The removal updates the list in place; nothing refetches it.
    expect(calls.filter((c) => c.method === "GET")).toHaveLength(1);
  });
});
