/**
 * @fileoverview The links under the Greatest of All-Time banner point at the
 * all-time rankings of each of the four event tabs.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GoatRankingsLinks, goatRankingsHref } from "../src/components/navigation/category-gallery/GoatRankingsLinks";

describe("GoatRankingsLinks", () => {
  it("builds the all-time rankings address of a format", () => {
    expect(goatRankingsHref("VCX")).toBe("/rank/VCX?season=all-time");
  });

  it("links to the all-time rankings of all four events, labelled as the rankings tabs are", () => {
    const html = renderToStaticMarkup(<GoatRankingsLinks />);
    for (const [format, label] of [
      ["NDT", "College Policy"],
      ["VCX", "HS Policy"],
      ["VPF", "Forum"],
      ["VLD", "Individual"],
    ]) {
      expect(html).toMatch(new RegExp(`<a[^>]*href="/rank/${format}\\?season=all-time"[^>]*>${label}</a>`));
    }
    expect(html.match(/<a /g)).toHaveLength(4);
  });

  it("wraps on narrow screens", () => {
    expect(renderToStaticMarkup(<GoatRankingsLinks />)).toMatch(/<nav[^>]*class="[^"]*flex-wrap/);
  });
});
