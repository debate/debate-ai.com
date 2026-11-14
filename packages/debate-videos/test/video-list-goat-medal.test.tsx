/**
 * @fileoverview Pins the 🎖️ Greatest of All Time medal on the list (row)
 * layout: a GOAT round's row wears it in its details line, beside the round
 * level, and any other round's row does not.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { VideoType } from "../src/types/videos";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
  useParams: () => ({}),
  usePathname: () => "/videos",
}));

const { VideoListRows } = await import("../src/components/videos/grid/VideoListRows");

function round(id: string, isTopPick: boolean): VideoType {
  return [id, `Round ${id}`, "2025-04-20", "Channel", 10, "", 1, "Tournament of Champions",
    "Finals", "Aff Team", "Neg Team", true, "3-0", null, null, isTopPick, null, 2025];
}

function render(videos: VideoType[], topPicks?: Set<string>): string {
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
      topPicks,
    }),
  );
}

const medals = (html: string) => html.match(/Greatest of All Time"/g)?.length ?? 0;

describe("GOAT medal in the list layout", () => {
  it("shows the medal on a GOAT round's row and nowhere else", () => {
    const html = render([round("goat", true), round("plain", false)]);
    expect(medals(html)).toBe(1);
    expect(html).toContain("🎖️");
  });

  it("puts the medal in the details line, not among the row actions", () => {
    const html = render([round("goat", true)]);
    const medal = html.indexOf("Greatest of All Time");
    expect(medal).toBeGreaterThan(-1);
    // The action strip opens with the watch-progress ring.
    expect(medal).toBeLessThan(html.indexOf('aria-label="Not watched'));
  });

  it("honours a feed's top-pick set as well as the row's own flag", () => {
    expect(medals(render([round("listed", false)], new Set(["listed"])))).toBe(1);
  });
});
