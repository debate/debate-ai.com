/**
 * @fileoverview Render guard for the popular-search chips under the video grid.
 *
 * The chips are the only part of the page that offers a search the user did
 * not type, so what matters is that a chip carries the exact term it will
 * search for, that there are no category headings, and that the row
 * disappears when the library has nothing to suggest.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { VideoSearchSuggestions } from "../src/components/videos/search/VideoSearchSuggestions";
import type { VideoSuggestions } from "../src/types/videos";

const SUGGESTIONS: VideoSuggestions = {
  keywords: [
    { label: "Finals", count: 206, kind: "keyword" },
    { label: "Critique", count: 43, kind: "keyword" },
  ],
  tournaments: [
    { label: "NDT", count: 1346, kind: "tournament" },
    { label: "TOC", count: 179, kind: "tournament" },
  ],
};

function render(
  props: Partial<Parameters<typeof VideoSearchSuggestions>[0]> = {},
): string {
  return renderToStaticMarkup(
    createElement(VideoSearchSuggestions, {
      suggestions: SUGGESTIONS,
      onSelect: () => {},
      ...props,
    }),
  );
}

describe("VideoSearchSuggestions", () => {
  it("shows keyword and tournament chips in one row with no category headings", () => {
    const html = render();
    expect(html).not.toContain("Popular searches");
    expect(html).not.toContain("Tournaments");
    expect(html.indexOf(">Critique</span>")).toBeLessThan(html.indexOf(">NDT</span>"));
  });

  it("renders one chip per suggestion without view totals", () => {
    const html = render();
    for (const label of ["Finals", "Critique", "NDT", "TOC"]) {
      expect(html).toContain(`>${label}</span>`);
    }
    expect(html).not.toContain(">0.2k<");
    expect(html).not.toContain(">0.0k<");
    expect(html).not.toContain(">1.3k<");
  });

  it("marks the chip matching the active search term", () => {
    const html = render({ searchTerm: " ndt " });
    expect(html).toMatch(/aria-pressed="true"[^>]*>[\s\S]{0,120}NDT/);
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
  });

  it("passes a max width through so the chips wrap at the rows' edge", () => {
    expect(render({ style: { maxWidth: 640 } })).toContain("max-width:640px");
  });

  it("renders nothing at all when there is nothing to suggest", () => {
    expect(render({ suggestions: { keywords: [], tournaments: [] } })).toBe("");
  });

  it("still renders keyword chips when there are no tournaments", () => {
    const html = render({
      suggestions: { keywords: SUGGESTIONS.keywords, tournaments: [] },
    });
    expect(html).toContain(">Finals</span>");
    expect(html).not.toContain(">NDT</span>");
  });
});
