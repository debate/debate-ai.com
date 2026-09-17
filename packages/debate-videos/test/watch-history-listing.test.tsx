/**
 * @fileoverview The watch history as a listing of its own.
 *
 * Two things worth pinning. The route: `/videos/history` has to resolve
 * through `SLUG_MAP` to the history view — an unmapped slug is treated as a
 * *lecture category id*, so a missing entry there does not 404, it silently
 * renders an empty category page named "history".
 *
 * And its place in the nav: the row sits directly under the Lectures
 * section, as a peer of it rather than one of its categories, because the
 * history spans both libraries. `sidebar-video-links.test.tsx` already holds
 * every surface to `SIDEBAR_VIDEO_LINKS`; what this adds is the *order*, which
 * that list cannot express on its own.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SLUG_MAP } from "../src/panels/lectureRouteConfig";
import {
  SIDEBAR_VIDEO_LINKS,
  VIDEO_LIBRARY_LINKS,
} from "../src/components/category-gallery/sidebar-video-links";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) =>
    createElement("img", {
      src: typeof src === "string" ? src : (src as { src: string }).src,
      alt,
    }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: unknown }) =>
    createElement("a", { href }, children as never),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/videos/history",
}));

const { VideoSidebarTree } = await import(
  "../src/components/category-gallery/VideoSidebarTree"
);

/** The tree, with the lecture categories loaded as the live page has them. */
function sidebarHtml(): string {
  return renderToStaticMarkup(
    createElement(VideoSidebarTree, {
      lectureCategories: [
        { key: "theory", label: "Counterplans & Theory", count: 12, maxViews: 900 },
      ],
      lecturesExpanded: true,
      onToggleLectures: () => {},
      activeId: "history",
      counts: { history: 7 },
    }),
  );
}

describe("the watch history's route", () => {
  it("maps /videos/history onto the history view", () => {
    expect(SLUG_MAP.history).toEqual({ view: "history" });
    expect(SLUG_MAP.watchhistory).toEqual({ view: "history" });
  });
});

describe("the watch history's place in the sidebar", () => {
  it("is a link of its own, right after Lectures", () => {
    const ids = VIDEO_LIBRARY_LINKS.map((link) => link.id);
    expect(ids.indexOf("history")).toBe(ids.indexOf("lectures") + 1);

    const link = SIDEBAR_VIDEO_LINKS.find((entry) => entry.id === "history");
    expect(link).toEqual({
      id: "history",
      href: "/videos/history",
      title: "Watch History",
    });
  });

  it("renders after the Lectures section rather than inside it", () => {
    const html = sidebarHtml();
    expect(html).toContain("Watch History");
    // After the lecture categories, not among them.
    expect(html.indexOf("Watch History")).toBeGreaterThan(
      html.indexOf("Counterplans &amp; Theory"),
    );
    expect(html.indexOf('href="/videos/history"')).toBeGreaterThan(
      html.indexOf('href="/videos/lectures"'),
    );
  });
});
