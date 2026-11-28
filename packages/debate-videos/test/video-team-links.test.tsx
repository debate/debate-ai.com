// @vitest-environment jsdom
/**
 * @fileoverview Pins where a team name in the videos UI goes when clicked: its
 * team page, not a search of the library. Covers the address helper, the
 * list/tree row cells, the card thumbnail, the watch page's header badges and
 * the player's title bar — including the fallbacks (a label with no team code
 * searches, or is plain text) and the no-nested-anchors rule.
 */

import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoType } from "../src/types/videos";
import { click, mount, type Mounted } from "./helpers/mount";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({}),
  usePathname: () => "/videos",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) =>
    createElement("img", { src: typeof src === "string" ? src : (src as { src: string }).src, alt }),
}));

vi.mock("grab-url", () => ({
  default: async (path: string) => (path === "transcript" ? { videoId: "x", snippets: [] } : {}),
}));

const { videoTeamHref } = await import("../src/lib/video-team-href");
const { VideoListRow } = await import("../src/components/videos/grid/VideoListRow");
const { VideoListRows } = await import("../src/components/videos/grid/VideoListRows");
const { VideoCardThumbnail } = await import("../src/components/videos/card/VideoCardThumbnail");
const { TeamNameLink } = await import("../src/components/videos/card/TeamNameLink");
const { PlayerTitleBar } = await import("../src/components/videos/player/PlayerTitleBar");
const { VideoWatchPage } = await import("../src/panels/watch/VideoWatchPage");

let view: Mounted | null = null;

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  view = null;
});

const noop = () => {};

function round(aff: string | null, neg: string | null): VideoType {
  return ["vid-1", "Finals", "2025-03-30", "Channel", 100, "", 1, "NDT", "Finals", aff, neg, true, "3-0 Aff", null, null, false, null, 2025] as unknown as VideoType;
}

/** Every `a` with another `a` somewhere above it. */
const nestedAnchors = (root: HTMLElement) => [...root.querySelectorAll("a")].filter((a) => a.parentElement?.closest("a"));

const teamLinks = (root: HTMLElement) => [...root.querySelectorAll<HTMLAnchorElement>("a[href^='/@']")];

describe("videoTeamHref", () => {
  it("uses the rankings helpers for a ranked team", () => {
    expect(videoTeamHref("Harker LL", { school: "Harker", name: "Le & Luo" } as never)).toBe("/@harker-le-luo");
  });

  it("links a past college season's row by its short school and last names", () => {
    const past = { school: "University of Kansas", name: "Katz & Robinson", season: 2015, mu: 25, rank: 3 } as never;
    expect(videoTeamHref("Kansas KR", past)).toBe("/@kansas-katz-robinson");
  });

  it("links an unranked team by its label's school and initials", () => {
    expect(videoTeamHref("Harker LL")).toBe("/@harker-ll");
    expect(videoTeamHref("  Strath   Haven YS ")).toBe("/@strath-haven-ys");
    expect(videoTeamHref("Harvard-Westlake AB", null)).toBe("/@harvard-westlake-ab");
  });

  it("has no team page for a label without a team code, or no label", () => {
    expect(videoTeamHref("SMU")).toBeNull();
    expect(videoTeamHref("Boston College")).toBeNull();
    expect(videoTeamHref("Team Aff")).toBeNull();
    expect(videoTeamHref("")).toBeNull();
    expect(videoTeamHref(null)).toBeNull();
    expect(videoTeamHref(undefined)).toBeNull();
  });
});

describe("list and tree rows", () => {
  const rowProps = {
    depth: 0,
    stackIndex: 0,
    onStackSelect: noop,
    isFavorite: false,
    isHidden: false,
    isTopPick: false,
    isRoundMode: true,
    showThumbnails: false,
    onToggleFavorite: noop,
    onHideVideo: noop,
    onUnhideVideo: noop,
  };

  async function mountRow(video: VideoType, extra: Record<string, unknown> = {}) {
    view = await mount(
      createElement("table", null, createElement("tbody", null, createElement(VideoListRow, { ...rowProps, video, stackVideos: [video], ...extra }))),
    );
    return view.container;
  }

  it("links an unranked team to its team page instead of searching", async () => {
    const onSearch = vi.fn();
    const root = await mountRow(round("Harker LL", "Damien AS"), { onSearch });
    expect(teamLinks(root).map((a) => a.getAttribute("href"))).toEqual(["/@harker-ll", "/@damien-as"]);
    expect(root.querySelectorAll("button[title^='Search for']")).toHaveLength(0);
    await click(teamLinks(root)[0]);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("links a ranked team by its rankings row", async () => {
    const root = await mountRow(round("Harker LL", "Damien AS"), {
      affRanking: { school: "Harker", name: "Le & Luo", rank: 4 },
    });
    expect(teamLinks(root)[0].getAttribute("href")).toBe("/@harker-le-luo");
    expect(teamLinks(root)[1].getAttribute("href")).toBe("/@damien-as");
  });

  it("clicking a team name does not open the row's watch page", async () => {
    const root = await mountRow(round("Harker LL", "Damien AS"));
    await click(teamLinks(root)[0]);
    expect(push).not.toHaveBeenCalled();
    await click(root.querySelector("tr") as HTMLElement);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("never nests an anchor in an anchor", async () => {
    const root = await mountRow(round("Harker LL", "Damien AS"), { affRanking: { school: "Harker", name: "Le & Luo", rank: 4 } });
    expect(nestedAnchors(root)).toHaveLength(0);
  });

  it("falls back to the library search for a bare school, and plain text without a handler", async () => {
    const onSearch = vi.fn();
    let root = await mountRow(round("SMU", "Boston College"), { onSearch });
    expect(teamLinks(root)).toHaveLength(0);
    const buttons = root.querySelectorAll<HTMLButtonElement>("button[title^='Search for']");
    expect([...buttons].map((b) => b.title)).toEqual(["Search for SMU", "Search for Boston College"]);
    await click(buttons[1]);
    expect(onSearch).toHaveBeenCalledWith("Boston College");
    expect(push).not.toHaveBeenCalled();

    await view?.unmount();
    root = await mountRow(round("SMU", "Boston College"));
    expect(teamLinks(root)).toHaveLength(0);
    expect(root.querySelectorAll("button[title^='Search for']")).toHaveLength(0);
    expect(root.textContent).toContain("SMU");
  });

  it("links the team names in the full round list (tree rows)", async () => {
    view = await mount(
      createElement(VideoListRows, {
        videos: [round("Harker LL", "Damien AS")],
        layout: "round",
        videoContainerRef: { current: null },
        favorites: new Set<string>(),
        onToggleFavorite: noop,
        onHideVideo: noop,
        onUnhideVideo: noop,
        hiddenVideos: new Set<string>(),
        onSearch: noop,
      }),
    );
    const hrefs = teamLinks(view.container).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/@harker-ll");
    expect(hrefs).toContain("/@damien-as");
    expect(nestedAnchors(view.container)).toHaveLength(0);
  });
});

describe("card thumbnail", () => {
  const thumbnailProps = {
    videoId: "vid-1",
    title: "Finals",
    showThumbnails: true,
    isPlaying: false,
    isTopPick: false,
    hasFullMetadata: true,
    hasTeams: true,
    cleanTournament: "NDT",
    year: 2025,
    roundLevel: "Finals",
    affWin: null,
    arg1AC: null,
    arg2NR: null,
    youtubeUrl: "https://www.youtube.com/watch?v=vid-1",
    videoMeta: {},
    styleNumber: 1,
  };

  it("links each team above the thumbnail's watch overlay without nesting anchors", async () => {
    const video = round("Harker LL", "Damien AS");
    view = await mount(createElement(VideoCardThumbnail, { ...thumbnailProps, video, affTeam: "Harker LL", negTeam: "Damien AS" } as never));
    const links = teamLinks(view.container);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/@harker-ll", "/@damien-as"]);
    for (const link of links) expect(link.className).toContain("z-20");
    const overlays = [...view.container.querySelectorAll("a[aria-label^='Watch']")];
    expect(overlays.length).toBeGreaterThan(0);
    for (const overlay of overlays) for (const link of links) expect(overlay.contains(link)).toBe(false);
    expect(nestedAnchors(view.container)).toHaveLength(0);
  });

  it("leaves a team with no team page as plain text", async () => {
    const video = round("SMU", "Damien AS");
    view = await mount(createElement(VideoCardThumbnail, { ...thumbnailProps, video, affTeam: "SMU", negTeam: "Damien AS" } as never));
    expect(teamLinks(view.container).map((a) => a.getAttribute("href"))).toEqual(["/@damien-as"]);
    expect(view.container.textContent).toContain("SMU");
  });
});

describe("TeamNameLink", () => {
  it("is a real, focusable anchor for a resolvable team", async () => {
    view = await mount(createElement(TeamNameLink, { team: "Harker LL", children: "Harker LL" }));
    const link = view.container.querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/@harker-ll");
    expect(link.tabIndex).toBe(0);
    expect(link.title).toBe("Harker LL — team page");
  });

  it("is a keyboard-operable button for the search fallback", async () => {
    const onSearch = vi.fn();
    view = await mount(createElement(TeamNameLink, { team: "SMU", onSearch, children: "SMU" }));
    const button = view.container.querySelector("button") as HTMLButtonElement;
    expect(button.type).toBe("button");
    await click(button);
    expect(onSearch).toHaveBeenCalledWith("SMU");
  });
});

describe("player title bar", () => {
  it("links the playing round's teams to their team pages", async () => {
    view = await mount(
      createElement(PlayerTitleBar, {
        activeVideoMeta: { style: 1, tournament: "NDT", year: 2025, affTeam: "Harker LL", negTeam: "SMU" },
        activeVideoTitle: "Finals",
      }),
    );
    expect(teamLinks(view.container).map((a) => a.getAttribute("href"))).toEqual(["/@harker-ll"]);
    expect(view.container.textContent).toContain("SMU");
  });
});

describe("watch page header", () => {
  it("links the aff and neg badges to their team pages and searches nothing", async () => {
    const video = round("Harker LL", "Damien AS");
    view = await mount(createElement(VideoWatchPage, { video }));
    const hrefs = teamLinks(view.container).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/@harker-ll");
    expect(hrefs).toContain("/@damien-as");
    expect(view.container.querySelector("button[title^='Affirmative']")).toBeNull();
    await click(teamLinks(view.container)[0]);
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining("/videos?q="));
  });

  it("keeps the search for a team that has no team page", async () => {
    const video = round("SMU", "Damien AS");
    view = await mount(createElement(VideoWatchPage, { video }));
    const button = view.container.querySelector<HTMLButtonElement>("button[title='Search for SMU']");
    expect(button).not.toBeNull();
    await click(button as HTMLButtonElement);
    expect(push).toHaveBeenCalledWith("/videos?q=SMU");
  });
});
