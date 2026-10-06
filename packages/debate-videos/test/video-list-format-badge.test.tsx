/**
 * @fileoverview Pins the format badge Top Picks puts beside each tournament
 * name in the list layout: one per format on a tournament's group row, one on
 * each round row, and none when the listing does not ask for it.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { DebateStyle, VideoType } from "../src/types/videos";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
  useParams: () => ({}),
  usePathname: () => "/videos/goat-status",
}));

const { VideoListRows } = await import("../src/components/video-grid/VideoListRows");

function round(id: string, style: DebateStyle): VideoType {
  return [id, `Round ${id}`, "2025-04-20", "Channel", 10, "", style, "Tournament of Champions",
    "Finals", "Aff Team", "Neg Team", true, "3-0", null, null, true, null, 2025];
}

function render(videos: VideoType[], showFormat: boolean): string {
  return renderToStaticMarkup(
    createElement(VideoListRows, {
      videos,
      videoContainerRef: { current: null },
      favorites: new Set<string>(),
      onToggleFavorite: () => {},
      onHideVideo: () => {},
      onUnhideVideo: () => {},
      hiddenVideos: new Set<string>(),
      layout: "round",
      showFormat,
    }),
  );
}

const badges = (html: string) =>
  [...html.matchAll(/data-testid="format-badge">([^<]+)</g)].map((match) => match[1]);

describe("format badges in the list layout", () => {
  it("badges the tournament row once per format and every round row with its own", () => {
    const html = render([round("a", 2), round("b", 3), round("c", 2)], true);
    // Group row: PF and LD once each, in style order; then a, b, c.
    expect(badges(html)).toEqual(["PF", "LD", "PF", "LD", "PF"]);
  });

  it("draws none unless the listing asks for them", () => {
    expect(badges(render([round("a", 2)], false))).toEqual([]);
  });
});
