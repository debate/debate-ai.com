/**
 * @fileoverview Render guard for the popular-search chips under the video grid.
 *
 * The chips are the only part of the page that offers a search the user did
 * not type, so what matters is that a chip carries the exact term it will
 * search for, shows how many videos back it, and that the row disappears
 * rather than rendering an empty heading when the library has nothing to
 * suggest.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { VideoSearchSuggestions } from "../src/components/video-search/VideoSearchSuggestions";
import type { VideoSuggestions } from "../src/types/videos";

const SUGGESTIONS: VideoSuggestions = {
  keywords: [
    { label: "Finals", count: 206, kind: "keyword" },
    { label: "Kritik", count: 43, kind: "keyword" },
  ],
  tournaments: [
    { label: "NDT", count: 1346, kind: "tournament" },
    { label: "TOC", count: 179, kind: "tournament" },
  ],
};

function render(props: Partial<Parameters<typeof VideoSearchSuggestions>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(VideoSearchSuggestions, {
      suggestions: SUGGESTIONS,
      onSelect: () => {},
      ...props,
    }),
  );
}

describe("VideoSearchSuggestions", () => {
  it("shows both rows with their headings", () => {
    const html = render();
    expect(html).toContain("Popular searches");
    expect(html).toContain("Tournaments");
  });

  it("renders one chip per suggestion, with its match count", () => {
    const html = render();
    for (const label of ["Finals", "Kritik", "NDT", "TOC"]) {
      expect(html).toContain(`>${label}</span>`);
    }
    expect(html).toContain(">206<");
    // Four-digit counts are abbreviated, matching the quick-link cards.
    expect(html).toContain(">1.3k<");
  });

  it("marks the chip matching the active search term", () => {
    const html = render({ searchTerm: " ndt " });
    expect(html).toMatch(/aria-pressed="true"[^>]*>[\s\S]{0,120}NDT/);
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
  });

  it("renders nothing at all when there is nothing to suggest", () => {
    expect(render({ suggestions: { keywords: [], tournaments: [] } })).toBe("");
  });

  it("hides a row that has no chips instead of leaving an empty heading", () => {
    const html = render({ suggestions: { keywords: SUGGESTIONS.keywords, tournaments: [] } });
    expect(html).toContain("Popular searches");
    expect(html).not.toContain("Tournaments");
  });
});
