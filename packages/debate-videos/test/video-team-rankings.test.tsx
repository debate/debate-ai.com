/**
 * @fileoverview The rankings in the list layout's Aff and Neg cells: a round's
 * team label resolves to its current-season rankings row, which turns the
 * name into a link to the team page and puts the team's rating beside it.
 * A team the rankings do not know keeps the old behaviour — its name
 * searches the library for that team's videos.
 *
 * Also pins the watch page's search box, which runs a library search.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { RankingDataset, RankingEntry } from "@debate/rankings-adapter";
import type { VideoType } from "../src/types/videos";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
  useParams: () => ({}),
  usePathname: () => "/videos",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

const { findVideoTeamRanking, videoStyleDatasetId } = await import(
  "../src/panels/leaderboard/profile/rankingProfileHelpers"
);
const { isRankedSeasonRound } = await import("../src/hooks/useVideoTeamRankings");
const { VideoListRow } = await import("../src/components/video-grid/VideoListRow");
const { WatchSearchBox } = await import("../src/components/watch/WatchSearchBox");
const { TooltipProvider } = await import("../src/ui/primitives/tooltip");

function entry(rank: number, school: string, name: string): RankingEntry {
  return {
    rank,
    school,
    name,
    adjustedRating: 72.4,
    deviation: 3,
    matches: 20,
    rating: 80,
    hash: `${school}-${name}`,
    affWinRate: 50,
    negWinRate: 50,
    affElimWinRate: null,
    negElimWinRate: null,
  };
}

function dataset(id: RankingDataset["id"], entries: RankingEntry[]): RankingDataset {
  return { id, label: id, tournaments: [], majors: [], entries, field: null };
}

const harker = entry(4, "Harker", "Lee & Liu");
const datasets = [dataset("hspf", [harker]), dataset("hscx", [entry(1, "Harker", "Kim & Park")])];

/** A PF round from the 2026-27 season (season year 2027). */
const round: VideoType = [
  "vid-1", "Harker LL vs Gunn AB", "2026-09-20", "Channel", 10, "",
  2, "Yale", "Finals", "Harker LL", "Gunn AB", true, "3-0", null, null, false, null, 2027,
];

describe("findVideoTeamRanking", () => {
  it("matches a team label in the dataset for the round's style", () => {
    expect(findVideoTeamRanking(datasets, 2, "Harker LL")).toBe(harker);
    // Same school and initials in Policy are different people.
    expect(findVideoTeamRanking(datasets, 1, "Harker LL")).toBeNull();
  });

  it("finds nothing for a lecture, a missing dataset or an empty label", () => {
    expect(findVideoTeamRanking(datasets, "Theory", "Harker LL")).toBeNull();
    expect(findVideoTeamRanking(datasets, 3, "Harker LL")).toBeNull();
    expect(findVideoTeamRanking(datasets, 2, "  ")).toBeNull();
    expect(videoStyleDatasetId(3)).toBe("hsld");
    expect(videoStyleDatasetId("Theory")).toBeNull();
  });
});

describe("isRankedSeasonRound", () => {
  const october2026 = new Date("2026-10-06T12:00:00Z");

  it("accepts only a ranked style from the current season", () => {
    expect(isRankedSeasonRound(round, october2026)).toBe(true);
    const lastSeason = [...round] as VideoType;
    lastSeason[17] = 2026;
    expect(isRankedSeasonRound(lastSeason, october2026)).toBe(false);
    const lecture = [...round] as VideoType;
    lecture[6] = "Theory";
    expect(isRankedSeasonRound(lecture, october2026)).toBe(false);
  });
});

function renderRow(affRanking: RankingEntry | null, negRanking: RankingEntry | null): string {
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(
      TooltipProvider,
      null,
      createElement(
        "table",
        null,
        createElement(
          "tbody",
          null,
          createElement(VideoListRow, {
            video: round,
            depth: 0,
            stackVideos: [round],
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
            onSearch: noop,
            affRanking,
            negRanking,
          }),
        ),
      ),
    ),
  );
}

describe("VideoListRow team cells", () => {
  it("links a ranked team to its team page without showing rating", () => {
    const html = renderRow(harker, null);
    expect(html).toContain('href="/@harker-ll"');
    // Rating is no longer displayed in team cells (replaced by row index in first column)
    expect(html).not.toContain(">72<");
  });

  it("keeps an unranked team as a library search", () => {
    const html = renderRow(harker, null);
    expect(html).toContain('title="Search for Gunn AB"');
    expect(renderRow(null, null)).not.toContain("/teams/");
    expect(renderRow(null, null)).not.toContain("/@");
  });
});

describe("WatchSearchBox", () => {
  it("renders a search form", () => {
    const html = renderToStaticMarkup(createElement(WatchSearchBox, { onSearch: () => {} }));
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Search videos"');
  });
});
