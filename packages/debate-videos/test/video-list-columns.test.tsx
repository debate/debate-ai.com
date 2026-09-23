/**
 * @fileoverview Pins the columns and the tree shape of the list (table)
 * layout for videos.
 *
 * Three things worth a guard here. The obvious one: the round table has no
 * Arguments column — the 1AC/2NR labels ride under the team that ran them in
 * the Aff and Neg cells instead.
 *
 * The one that actually breaks silently: the header is rendered from a
 * column list and the cells from hand-written `<td>`s, so dropping a column
 * from one and not the other shifts every value in the row under the wrong
 * heading without throwing. These count them against each other, across the
 * video rows and the group rows, whose empty matchup cells are a `colSpan`.
 *
 * And the tree itself: round rows are grouped season → tournament → round,
 * so a round's season and tournament are headings above it rather than
 * columns beside it. Lectures, by contrast, are listed flat.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { VideoType } from "../src/types/videos";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/videos",
}));

const { VideoListRows, cleanTournamentName } = await import("../src/components/video-grid/VideoListRows");

/** A round with a tournament and both teams — the full-column layout. */
const identifiableRound: VideoType = [
  "vid-round",
  "Harvard Finals",
  "2025-02-14",
  "Debate Channel",
  1200,
  "",
  1,
  "Harvard",
  "Finals",
  "Team Aff",
  "Team Neg",
  true,
  "2-1",
  "Warming Advantage",
  "Cap K",
  false,
  null,
  2025,
];

/** A round with tournament data on the feed but none of its own: it files
 *  under the `Unsorted` tournament and still shows its own title. */
const bareRound: VideoType = [
  "vid-bare",
  "Untagged Round",
  "2025-01-02",
  "Debate Channel",
  30,
  "",
  1,
  null,
  "Octas",
  null,
  null,
  null,
  null,
  null,
  null,
  false,
  null,
  2025,
];

function renderList(videos: VideoType[]): string {
  return renderToStaticMarkup(
    createElement(VideoListRows, {
      videos,
      videoContainerRef: { current: null },
      favorites: new Set<string>(),
      onToggleFavorite: () => {},
      onHideVideo: () => {},
      onUnhideVideo: () => {},
      hiddenVideos: new Set<string>(),
    }),
  );
}

function headers(html: string): string[] {
  const headerRow = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
  return [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(([, cell]) =>
    cell
      // The `− Ln +` collapse stepper shares the first header with its label.
      .replace(/<button[^>]*aria-label="(?:Collapse|Expand) one level"[\s\S]*?<\/button>/g, "")
      .replace(/<span[^>]*>L\d+<\/span>/g, "")
      .replace(/<[^>]*>/g, "")
      .trim(),
  );
}

/** Cell count of the row holding `marker`, counting a `colSpan` as its span. */
function cellCount(html: string, marker: string): number {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) => row);
  const row = rows.find((candidate) => candidate.includes(marker));
  expect(row).toBeDefined();
  return [...(row as string).matchAll(/<td[^>]*>/g)].reduce((total, [tag]) => {
    const span = /colspan="(\d+)"/i.exec(tag);
    return total + (span ? Number(span[1]) : 1);
  }, 0);
}

describe("tournament names in round rows", () => {
  it.each([
    ["TOC 2025", "TOC"],
    ["NDT 2025", "NDT"],
    ["Shirley 2024", "Shirley"],
    ["Harvard 2024", "Harvard"],
    ["Northwestern 2024", "Northwestern"],
    ["Greenhill RR", "Greenhill RR"],
    ["Shirley 2019 Rd 6", "Shirley"],
    ["Tournament of Champions 2019", "TOC"],
    ["ACC Debate Tournament", "ACC"],
  ])("shortens %p to %p", (tournament, expected) => {
    expect(cleanTournamentName(tournament)).toBe(expected)
  })
})

describe("the round list's columns", () => {
  it("carries no Arguments column", () => {
    expect(headers(renderList([identifiableRound]))).not.toContain("Arguments");
  });

  it("shows each side's argument under its team name", () => {
    const html = renderList([identifiableRound]);
    const cells = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => cell);
    const aff = cells.find((cell) => cell.includes("Team Aff"));
    const neg = cells.find((cell) => cell.includes("Team Neg"));
    expect(aff).toContain("Warming Advantage");
    expect(aff!.indexOf("Team Aff")).toBeLessThan(aff!.indexOf("Warming Advantage"));
    expect(neg).toContain("Cap K");
    expect(neg!.indexOf("Team Neg")).toBeLessThan(neg!.indexOf("Cap K"));
  });

  it("heads the columns it does render, in order", () => {
    expect(headers(renderList([identifiableRound]))).toEqual([
      "Round",
      "Aff",
      "Neg",
      "Date",
      "Views",
      "Actions",
    ]);
  });

  it("gives every row exactly as many cells as there are headers", () => {
    const html = renderList([identifiableRound, bareRound]);
    const columnCount = headers(html).length;
    // A video row, a round with nothing but its title, and a group row —
    // whose empty Aff/Neg pair is one spanned cell.
    expect(cellCount(html, "Team Aff")).toBe(columnCount);
    expect(cellCount(html, "Untagged Round")).toBe(columnCount);
    expect(cellCount(html, "Harvard")).toBe(columnCount);
  });
});

describe("the round list's tree", () => {
  it("heads its rows with the season, the tournament and the round", () => {
    const html = renderList([identifiableRound]);
    // Season 2025 is the 24-25 season; the tournament keeps its short name.
    expect(html).toContain("24-25");
    expect(html).toContain("Harvard");
    expect(html).toContain("Finals");
    expect(html).toContain("Harvard Finals");
  });

  it("files a round with no tournament under Unsorted rather than dropping it", () => {
    // Alongside an identifiable round: a feed of nothing but untagged rounds
    // carries no tournament and no teams at all, which is how the table tells
    // a lecture listing apart from an archive of rounds.
    const html = renderList([identifiableRound, bareRound]);
    expect(html).toContain("Unsorted");
    expect(html).toContain("Untagged Round");
  });

  it("opens every level, so no video is hidden until a group is collapsed", () => {
    const html = renderList([identifiableRound, bareRound]);
    expect(html).toContain("Harvard Finals");
    expect(html).toContain("Untagged Round");
  });

  it("offers the collapse-level control in the first header", () => {
    const html = renderList([identifiableRound]);
    expect(html).toContain('aria-label="Collapse one level"');
    expect(html).toContain('aria-label="Expand one level"');
    // Season → tournament → round → video.
    expect(html).toContain(">L4<");
  });
});

describe("the lecture list's columns", () => {
  /** A lecture: no tournament and no teams, so the table reads lecture mode. */
  const lecture: VideoType = [
    "vid-lecture",
    "Kritik Basics",
    "2025-03-01",
    "Lecture Channel",
    500,
    "",
    "Kritik / Critical Theory",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    false,
    null,
    2025,
  ];

  it("keeps its own set, which never had an Arguments column", () => {
    const html = renderList([lecture]);
    const columnHeaders = headers(html);
    expect(columnHeaders).toEqual(["Library", "Date", "Views", "Actions"]);
    expect(cellCount(html, "Kritik Basics")).toBe(columnHeaders.length);
  });

  it("names the channel and the category on every row, at every width", () => {
    // The two things a lecture listing is scanned by. They head the groups a
    // lecture sits in and ride on the row's own second tier, and neither is
    // dropped at a narrow width — the table scrolls sideways instead.
    const html = renderList([lecture]);
    expect(html).toContain("Lecture Channel");
    expect(html).toContain("Kritik / Critical Theory");

    const headerRow = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    expect(headerRow).not.toContain("hidden");
  });

  it("gives the video row its thumbnail", () => {
    expect(renderList([lecture])).toContain("https://img.youtube.com/vi/vid-lecture/mqdefault.jpg");
  });

  it("lists lectures flat, with no group rows or collapse control", () => {
    const html = renderList([lecture]);
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain('aria-label="Collapse one level"');
    // One header row and one video row — no season/channel/category rows.
    const bodyRows = html.slice(html.indexOf("<tbody")).match(/<tr[^>]*>/g) ?? [];
    expect(bodyRows).toHaveLength(1);
  });
});
