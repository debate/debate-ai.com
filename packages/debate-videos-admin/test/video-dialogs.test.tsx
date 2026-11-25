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

  it("passes the watch-page paths the save returned, so the page can follow a moved video", async () => {
    const onSaved = vi.fn();
    const saved = libraryVideo({ roundLevel: "Semis" });
    mockFetch([
      {
        method: "PATCH",
        match: `/api/admin/videos/library/${VIDEO_ID}`,
        respond: { video: saved, href: "/videos/a/semis", previousHref: "/videos/a/finals" },
      },
    ]);
    mount(<VideoEditDialog video={libraryVideo()} onClose={() => {}} onSaved={onSaved} />);
    await clickAsync(button("Save changes"));
    expect(onSaved).toHaveBeenCalledWith(saved, { href: "/videos/a/semis", previousHref: "/videos/a/finals" });
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

describe("VideoEditDialog college results lookup", () => {
  const college = (overrides: Partial<LibraryVideo> = {}) =>
    libraryVideo({
      style: 4,
      category: null,
      tournament: "Shirley",
      roundLevel: "Finals",
      affTeam: "Emory GY",
      negTeam: "Michigan BS",
      affWin: null,
      judgeDecision: null,
      publishedAt: "2026-11-17",
      seasonYear: 2027,
      ...overrides,
    });

  const finalsLookup = {
    status: "verified",
    message: "Finals: Emory GY won on the NEG 3-2.",
    tournament: { id: 2014, name: "Shirley / ADA Fall Championship", season: "2026-2027", startDate: "2026-11-14", url: "https://collegedebateresults.vercel.app/tournaments/2014" },
    round: "Finals",
    match: { affTeam: "Michigan BS", affDebaters: "Barrett (-), Song (-)", negTeam: "Emory GY", negDebaters: "Gallagher (-), Young (-)", judges: "Jacob Wilkus, Cade Blenden*, Jared Spiers*, AJ Byrne, David Griffith", decision: "NEG" },
    sidesSwapped: true,
    winnerSide: "neg",
    winnerTeam: "Emory GY",
    ballots: "3-2",
    candidates: [],
  };

  it("is hidden on lecture and non-debate styles", () => {
    mount(<VideoEditDialog video={libraryVideo({ style: 7 })} onClose={() => {}} onSaved={() => {}} />);
    expect(bodyText()).not.toContain("Look up results");
    cleanup();
    mount(<VideoEditDialog video={libraryVideo({ style: null })} onClose={() => {}} onSaved={() => {}} />);
    expect(bodyText()).not.toContain("Look up results");
  });

  it("looks a high-school LD round up on Tabroom", async () => {
    const tabroomLookup = {
      status: "verified",
      message: "Finals: Valley Christian YN won on the NEG 3-0.",
      tournament: {
        id: 35001,
        name: "UCLA Invitational",
        season: "2025-2026",
        startDate: "2026-01-17 08:00:00",
        url: "https://www.tabroom.com/index/tourn/results/index.mhtml?tourn_id=35001",
      },
      round: "Finals",
      match: {
        affTeam: "Mission San Jose SL",
        affDebaters: "Siddharth Lagisetty",
        negTeam: "Valley Christian YN",
        negDebaters: "Yohaan Narayanan",
        judges: "Emilio Lois, Angelina Tan, Tanisha Sonkusare",
        decision: "NEG",
      },
      sidesSwapped: false,
      winnerSide: "neg",
      winnerTeam: "Valley Christian YN",
      ballots: "3-0",
      candidates: [],
    };
    const { calls } = mockFetch([{ method: "GET", match: "/api/videos/hs-results", respond: tabroomLookup }]);
    mount(
      <VideoEditDialog
        video={libraryVideo({
          style: 3,
          tournament: "UCLA",
          roundLevel: "Finals",
          affTeam: "Mission San Jose SL",
          negTeam: "Valley Christian YN",
          seasonYear: 2026,
          publishedAt: "2026-01-19",
        })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    await clickAsync(button("🏛️ Look up results"));
    const url = new URL(calls[0].url, "https://example.com");
    expect(url.pathname).toBe("/api/videos/hs-results");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      tournament: "UCLA",
      style: "3",
      affTeam: "Mission San Jose SL",
      negTeam: "Valley Christian YN",
    });
    expect(bodyText()).toContain("Finals: Valley Christian YN won on the NEG 3-0.");
    expect(document.querySelector('[data-testid="hs-results"]')).toBeTruthy();
  });

  it("looks the round up, shows the match and fills the form from it", async () => {
    const { calls } = mockFetch([{ method: "GET", match: "/api/videos/college-results", respond: finalsLookup }]);
    mount(<VideoEditDialog video={college()} onClose={() => {}} onSaved={() => {}} />);
    await clickAsync(button("🏛️ Look up results"));

    const url = new URL(calls[0].url, "https://example.com");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      tournament: "Shirley",
      roundLevel: "Finals",
      affTeam: "Emory GY",
      negTeam: "Michigan BS",
      seasonYear: "2027",
      publishedAt: "2026-11-17",
    });
    expect(bodyText()).toContain("Finals: Emory GY won on the NEG 3-2.");
    expect(bodyText()).toContain("NEG: Emory GY (Gallagher (-), Young (-))");
    expect(bodyText()).toContain("opposite sides");

    click(button("Use this result"));
    expect(input("video-affTeam").value).toBe("Michigan BS");
    expect(input("video-negTeam").value).toBe("Emory GY");
    expect(input("video-judgeDecision").value).toBe("3-2");
    expect(document.getElementById("video-winner")!.textContent).toContain("Neg won");
    expect(bodyText()).toContain("Filled in Aff team: Michigan BS, Neg team: Emory GY, Winner: Neg won, Judge decision: 3-2, Judges: Jacob Wilkus, Cade Blenden*, Jared Spiers*, AJ Byrne, David Griffith. Save to keep it.");
    expect(input("video-judgeDecision").className).toContain("ring-emerald-500");
  });

  it("says so when the form already matches the result, and fills only the ballots otherwise", async () => {
    mockFetch([{ method: "GET", match: "/api/videos/college-results", respond: { ...finalsLookup, sidesSwapped: false } }]);
    // The 2026 Shirley final as stored: sides right, Neg already the winner, no ballots.
    mount(
      <VideoEditDialog
        video={college({ affTeam: "Michigan BS", negTeam: "Emory GY", affWin: false })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    await clickAsync(button("🏛️ Look up results"));
    click(button("Use this result"));
    expect(input("video-judgeDecision").value).toBe("3-2");
    expect(bodyText()).toContain("Filled in Judge decision: 3-2, Judges: Jacob Wilkus, Cade Blenden*, Jared Spiers*, AJ Byrne, David Griffith. Save to keep it.");

    click(button("Use this result"));
    expect(bodyText()).toContain("The form already matches this result — nothing to change.");
  });

  it("fills a one-judge prelim whose winner is already saved, and saves the judges", async () => {
    // Dartmouth RR 2025-26 Round 1: Emory GS won on the NEG, judge Ryan Cavanaugh.
    const prelim = {
      ...finalsLookup,
      message: "Round 1: Emory GS won on the NEG.",
      round: "Round 1",
      match: { affTeam: "Dartmouth CG", affDebaters: "Cai (29.1), Goldberg (29)", negTeam: "Emory GS", negDebaters: "Gallagher (29.3), Song (29.2)", judges: "Ryan Cavanaugh", decision: "NEG" },
      sidesSwapped: false,
      winnerTeam: "Emory GS",
      ballots: "1-0",
    };
    const { calls } = mockFetch([
      { method: "GET", match: "/api/videos/college-results", respond: prelim },
      { method: "PATCH", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { video: libraryVideo() } },
    ]);
    mount(
      <VideoEditDialog
        video={college({ tournament: "Dartmouth RR", roundLevel: "Round 1", affTeam: "Dartmouth CG", negTeam: "Emory GS", affWin: false, seasonYear: 2026 })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    await clickAsync(button("🏛️ Look up results"));
    click(button("Use this result"));
    expect(bodyText()).toContain("Filled in Judge decision: 1-0, Judges: Ryan Cavanaugh. Save to keep it.");
    expect(input("video-judges").value).toBe("Ryan Cavanaugh");
    expect(input("video-judges").className).toContain("ring-emerald-500");

    await clickAsync(button("Save changes"));
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({
      affWin: false,
      judgeDecision: "1-0",
      resultsJudges: "Ryan Cavanaugh",
      resultsSquirrels: "",
    });
  });

  it("stars the squirrels, colors each judge by their vote, and saves the stars as squirrels", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: "/api/videos/college-results", respond: { ...finalsLookup, sidesSwapped: false } },
      { method: "PATCH", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { video: libraryVideo() } },
    ]);
    mount(<VideoEditDialog video={college({ affTeam: "Michigan BS", negTeam: "Emory GY" })} onClose={() => {}} onSaved={() => {}} />);
    await clickAsync(button("🏛️ Look up results"));

    // The lookup's panel: Neg won 3-2, so the majority is red and the two squirrels blue.
    const sides = (root: Element) =>
      Object.fromEntries([...root.querySelectorAll("[data-side]")].map((el) => [el.textContent, el.getAttribute("data-side")]));
    expect(sides(document.querySelector('[data-testid="college-results"]')!)).toEqual({
      "Jacob Wilkus": "neg",
      "Cade Blenden*": "aff",
      "Jared Spiers*": "aff",
      "AJ Byrne": "neg",
      "David Griffith": "neg",
    });

    click(button("Use this result"));
    expect(input("video-judges").value).toBe("Jacob Wilkus, Cade Blenden*, Jared Spiers*, AJ Byrne, David Griffith");
    await clickAsync(button("Save changes"));
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({
      resultsJudges: "Jacob Wilkus, Cade Blenden, Jared Spiers, AJ Byrne, David Griffith",
      resultsSquirrels: "Cade Blenden, Jared Spiers",
    });
  });

  it("fills a unanimous panel's judges with no stars", async () => {
    // Kentucky 2026 Doubles: Iowa EW won on the AFF 3-0; the form already had the winner and ballots.
    const doubles = {
      ...finalsLookup,
      message: "Doubles: Iowa EW won on the AFF 3-0.",
      round: "Doubles",
      match: { affTeam: "Iowa EW", affDebaters: "Eltyeb (-), Weimar (-)", negTeam: "Michigan GV", negDebaters: "George (-), Vadathavoor (-)", judges: "Maverick Edwards, Justin Green, Scott Phillips", decision: "AFF" },
      sidesSwapped: false,
      winnerSide: "aff",
      winnerTeam: "Iowa EW",
      ballots: "3-0",
    };
    mockFetch([{ method: "GET", match: "/api/videos/college-results", respond: doubles }]);
    mount(
      <VideoEditDialog
        video={college({ tournament: "Kentucky", roundLevel: "Doubles", affTeam: "Iowa EW", negTeam: "Michigan GV", affWin: true, judgeDecision: "3-0" })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    await clickAsync(button("🏛️ Look up results"));
    click(button("Use this result"));
    expect(bodyText()).toContain("Filled in Judges: Maverick Edwards, Justin Green, Scott Phillips. Save to keep it.");
  });

  it("shows saved squirrels with their stars", () => {
    mount(
      <VideoEditDialog
        video={college({ affWin: false, judgeDecision: "3-2", resultsJudges: "A One, B Two, C Three", resultsSquirrels: "B Two" })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(input("video-judges").value).toBe("A One, B Two*, C Three");
  });

  it("fills empty team boxes from the site", async () => {
    mockFetch([{ method: "GET", match: "/api/videos/college-results", respond: { ...finalsLookup, sidesSwapped: false } }]);
    mount(<VideoEditDialog video={college({ affTeam: "Michigan BS", negTeam: "Emory GY" })} onClose={() => {}} onSaved={() => {}} />);
    await clickAsync(button("🏛️ Look up results"));
    change(input("video-negTeam"), "");
    click(button("Use this result"));
    expect(input("video-negTeam").value).toBe("Emory GY");
  });

  it("hides the judge fields on videos no results site covers, with none saved", () => {
    mount(<VideoEditDialog video={libraryVideo({ style: 7 })} onClose={() => {}} onSaved={() => {}} />);
    expect(document.getElementById("video-judges")).toBeNull();
  });

  it("looks high school Policy, PF and LD rounds up on Tabroom", async () => {
    const tabroomLookup = {
      ...finalsLookup,
      message: "Round 3: Harker AB won on the AFF 1-0.",
      tournament: { id: 34644, name: "53rd Annual Tournament of Champions", season: "2024-2025", startDate: "2025-04-25", url: "https://www.tabroom.com/x" },
      round: "Round 3",
      match: { affTeam: "Harker AB", affDebaters: "Ann Able, Bo Baker", negTeam: "Westminster CD", negDebaters: "Cy Cole, Di Dunn", judges: "Pat Judge", decision: "AFF 1-0" },
      sidesSwapped: false,
      winnerSide: "aff",
      winnerTeam: "Harker AB",
      ballots: "1-0",
    };
    const { calls } = mockFetch([{ method: "GET", match: "/api/videos/hs-results", respond: tabroomLookup }]);
    mount(
      <VideoEditDialog
        video={libraryVideo({ style: 1, tournament: "TOC", roundLevel: "Round 3", affTeam: "Harker AB", negTeam: "Westminster CD" })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(bodyText()).toContain("Finds this round on Tabroom");
    await clickAsync(button("🏛️ Look up results"));
    const url = new URL(calls[0].url, "https://example.com");
    expect(url.pathname).toBe("/api/videos/hs-results");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ style: "1", tournament: "TOC", roundLevel: "Round 3" });
    expect(bodyText()).toContain("Round 3: Harker AB won on the AFF 1-0.");
    click(button("Use this result"));
    expect(input("video-judgeDecision").value).toBe("1-0");
    expect(input("video-judges").value).toBe("Pat Judge");
  });

  it("is offered in suggest mode too, and reports a failed lookup", async () => {
    mockFetch([{ method: "GET", match: "/api/videos/college-results", respond: { error: "College Debate Results lookup failed" }, status: 502 }]);
    mount(<VideoEditDialog video={college()} mode="suggest" onClose={() => {}} onSaved={() => {}} />);
    await clickAsync(button("🏛️ Look up results"));
    expect(bodyText()).toContain("College Debate Results lookup failed");
  });
});

describe("VideoEditDialog delete", () => {
  it("asks to confirm, then DELETEs the video and reports it", async () => {
    const onDeleted = vi.fn();
    const { calls } = mockFetch([{ method: "DELETE", match: `/api/admin/videos/library/${VIDEO_ID}`, respond: { ok: true, id: VIDEO_ID } }]);
    mount(<VideoEditDialog video={libraryVideo()} onClose={() => {}} onSaved={() => {}} onDeleted={onDeleted} />);

    click(button("Delete video"));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(bodyText()).toContain("Delete “TOC Finals”?");

    click(button("Keep video"));
    expect(bodyText()).not.toContain("Delete “TOC Finals”?");

    click(button("Delete video"));
    await clickAsync(button("Yes, delete video"));
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
    expect(onDeleted).toHaveBeenCalledWith(expect.objectContaining({ videoId: VIDEO_ID }));
  });

  it("shows the error and keeps the dialog when the delete fails", async () => {
    const onDeleted = vi.fn();
    mockFetch([{ method: "DELETE", match: "/api/admin/videos/library/", respond: { error: "Forbidden" }, status: 403 }]);
    mount(<VideoEditDialog video={libraryVideo()} onClose={() => {}} onSaved={() => {}} onDeleted={onDeleted} />);
    click(button("Delete video"));
    await clickAsync(button("Yes, delete video"));
    expect(bodyText()).toContain("Forbidden");
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("is staff only: hidden in suggest mode and when adding a video", () => {
    mount(<VideoEditDialog video={libraryVideo()} mode="suggest" onClose={() => {}} onSaved={() => {}} />);
    expect(bodyText()).not.toContain("Delete video");
    cleanup();
    mount(<VideoEditDialog video={emptyLibraryVideo()} isNew onClose={() => {}} onSaved={() => {}} />);
    expect(bodyText()).not.toContain("Delete video");
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
