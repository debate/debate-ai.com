/**
 * @fileoverview Pins the columns of the list (table) layout for videos.
 *
 * Two things worth a guard here. The obvious one: the round table has no
 * Arguments column — the 1AC/2NR labels are prose, the widest thing in a
 * table meant for scanning, and nothing sorts or filters on them, so they
 * live on the cards instead.
 *
 * The one that actually breaks silently: the header is rendered from a
 * column list and the cells from hand-written `<td>`s, so dropping a column
 * from one and not the other shifts every value in the row under the wrong
 * heading without throwing. These count them against each other, in both
 * the identifiable-round layout and the `colSpan` fallback rows use when a
 * round carries neither a tournament nor a team.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { VideoType } from "../src/types/videos";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/videos",
}));

const { VideoListRows } = await import("../src/components/video-grid/VideoListRows");

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

/** A round with tournament data on the feed but none of its own: the row
 *  falls back to its title across the round columns' `colSpan`. */
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
    cell.replace(/<[^>]*>/g, "").trim(),
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

describe("the round list's columns", () => {
  it("carries no Arguments column", () => {
    const html = renderList([identifiableRound]);
    expect(headers(html)).not.toContain("Arguments");
    // Nor the argument labels themselves, anywhere in the table.
    expect(html).not.toContain("Warming Advantage");
    expect(html).not.toContain("Cap K");
    expect(html).not.toContain("1AC:");
    expect(html).not.toContain("2NR:");
  });

  it("heads the columns it does render, in order", () => {
    expect(headers(renderList([identifiableRound]))).toEqual([
      "Tournament",
      "Level",
      "Aff",
      "Neg",
      "Season",
      "Date",
      "Views",
      "Actions",
    ]);
  });

  it("gives every row exactly as many cells as there are headers", () => {
    const html = renderList([identifiableRound, bareRound]);
    const columnCount = headers(html).length;
    // The full layout, and the fallback row whose `colSpan` stands in for the
    // round columns it has nothing to put in.
    expect(cellCount(html, "Team Aff")).toBe(columnCount);
    expect(cellCount(html, "Untagged Round")).toBe(columnCount);
  });
});

describe("the lecture list's columns", () => {
  it("keeps its own set, which never had an Arguments column", () => {
    // No tournament or team on any row, so the table renders lecture mode.
    const lecture: VideoType = [
      "vid-lecture",
      "Kritik Basics",
      "2025-03-01",
      "Lecture Channel",
      500,
      "",
      "Theory",
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
    const html = renderList([lecture]);
    const columnHeaders = headers(html);
    expect(columnHeaders).toEqual(["Channel", "Season", "Title", "Category", "Actions"]);
    expect(cellCount(html, "Kritik Basics")).toBe(columnHeaders.length);
  });
});
