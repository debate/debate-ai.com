/**
 * @fileoverview Pins the Videos half of the sidebar to one list.
 *
 * The sidebar is `md+` only, so every one of these destinations reaches a
 * phone through some other surface — the quick-link tiles on `/videos`, and
 * the app dock's Settings menu everywhere else. Each surface used to restate
 * the links, which is how the glossary/rankings pair ended up in the sidebar
 * and in no mobile menu at all. These tests hold the two in-package surfaces
 * to `SIDEBAR_VIDEO_LINKS`; the app's
 * `lib/nav/__tests__/dock-menu-sections.test.ts` holds the menu to it.
 */

import { describe, it, expect, vi } from "vitest";
import { isVideoLibraryPath } from "../src/components/category-gallery/sidebar-routes";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  SIDEBAR_VIDEO_LINKS,
  SIDEBAR_VIDEO_LINKS_BY_ID,
  VIDEO_ALL_LINK,
  VIDEO_COLLEGE_LINK,
  VIDEO_FORMAT_LINKS,
  VIDEO_LIBRARY_LINKS,
  VIDEO_REFERENCE_LINKS,
} from "../src/components/category-gallery/sidebar-video-links";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: unknown; alt?: string; className?: string }) =>
    createElement("img", {
      src: typeof src === "string" ? src : (src as { src: string }).src,
      alt,
      className,
    }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: unknown; className?: string }) =>
    createElement("a", { href, className }, children as never),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/videos",
}));

const { VideoSidebarTree } = await import("../src/components/category-gallery/VideoSidebarTree");
const { QuickLinksGrid } = await import("../src/components/category-gallery/QuickLinksGrid");
const { ToolNavTree } = await import("../src/components/category-gallery/ToolNavTree");
const { INSIGHTS_SECTION_ID } = await import(
  "../src/components/category-gallery/sidebar-tool-sections"
);

function sidebarHtml(): string {
  return renderToStaticMarkup(
    createElement(VideoSidebarTree, {
      lectureCategories: [],
      lecturesExpanded: true,
      onToggleLectures: () => {},
    }),
  );
}

function hrefsIn(html: string): string[] {
  return [...html.matchAll(/<a[^>]*\shref="([^"]*)"/g)].map(([, href]) => href);
}

/** A title as React's own static-markup renderer would escape it into HTML
 *  text — `&` becomes `&amp;` ("Topic & Video Statistics"), so a raw
 *  `html.toContain(link.title)` check would never find it. */
function htmlEscaped(title: string): string {
  return title.replace(/&/g, "&amp;");
}

describe("SIDEBAR_VIDEO_LINKS", () => {
  it("is the concatenation of the tree's five groups", () => {
    expect(SIDEBAR_VIDEO_LINKS).toEqual([
      VIDEO_ALL_LINK,
      VIDEO_COLLEGE_LINK,
      ...VIDEO_FORMAT_LINKS,
      ...VIDEO_LIBRARY_LINKS,
      ...VIDEO_REFERENCE_LINKS,
    ]);
  });

  it("puts All Videos, the home page, at /videos first", () => {
    expect(SIDEBAR_VIDEO_LINKS[0]).toMatchObject({ href: "/videos", title: "All Videos" });
  });

  it("carries no duplicate id or destination", () => {
    const ids = SIDEBAR_VIDEO_LINKS.map((link) => link.id);
    const hrefs = SIDEBAR_VIDEO_LINKS.map((link) => link.href);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("points every link at a video library route", () => {
    for (const link of SIDEBAR_VIDEO_LINKS) {
      expect(isVideoLibraryPath(link.href)).toBe(true);
      expect(link.title.length).toBeGreaterThan(0);
    }
  });

  it("indexes the same links by id", () => {
    for (const link of SIDEBAR_VIDEO_LINKS) {
      expect(SIDEBAR_VIDEO_LINKS_BY_ID[link.id]).toEqual(link);
    }
  });
});

describe("the surfaces that render them", () => {
  it("gives the sidebar tree a link for every video destination", () => {
    // Every entry but the reference pair, which moved into the tool tree's
    // Insights section — see the test below.
    const html = sidebarHtml();
    const hrefs = hrefsIn(html);
    const referenceHrefs = new Set(VIDEO_REFERENCE_LINKS.map((link) => link.href));
    for (const link of SIDEBAR_VIDEO_LINKS) {
      if (referenceHrefs.has(link.href)) continue;
      expect(hrefs).toContain(link.href);
      expect(html).toContain(htmlEscaped(link.title));
    }
  });

  it("gives the mobile quick-link tiles one per entry but the reference pair", () => {
    // The tiles are the sidebar's stand-in on `/videos` below `md`. The
    // reference pair has no tile; it stays reachable from Practice.
    const html = renderToStaticMarkup(createElement(QuickLinksGrid, {}));
    const hrefs = hrefsIn(html);
    const referenceHrefs = new Set(VIDEO_REFERENCE_LINKS.map((link) => link.href));
    const tiled = SIDEBAR_VIDEO_LINKS.filter((link) => !referenceHrefs.has(link.href));
    expect(hrefs).toHaveLength(tiled.length);
    for (const link of tiled) {
      expect(hrefs).toContain(link.href);
      expect(html).toContain(htmlEscaped(link.title));
    }
  });

  it("keeps the glossary and statistics in Practice, not as tiles", () => {
    // Reachable from the tool tree's Practice section; no longer tiles.
    const practice = hrefsIn(
      renderToStaticMarkup(<ToolNavTree sectionIds={[PRACTICE_SECTION_ID]} />),
    );
    const tiles = hrefsIn(renderToStaticMarkup(createElement(QuickLinksGrid, {})));
    for (const link of VIDEO_REFERENCE_LINKS) {
      expect(practice).toContain(link.href);
      expect(tiles).not.toContain(link.href);
    }
  });
});
