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
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  SIDEBAR_VIDEO_LINKS,
  SIDEBAR_VIDEO_LINKS_BY_ID,
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
const { PRACTICE_SECTION_ID } = await import(
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

describe("SIDEBAR_VIDEO_LINKS", () => {
  it("is the concatenation of the tree's four groups", () => {
    expect(SIDEBAR_VIDEO_LINKS).toEqual([
      VIDEO_COLLEGE_LINK,
      ...VIDEO_FORMAT_LINKS,
      ...VIDEO_LIBRARY_LINKS,
      ...VIDEO_REFERENCE_LINKS,
    ]);
  });

  it("carries no duplicate id or destination", () => {
    const ids = SIDEBAR_VIDEO_LINKS.map((link) => link.id);
    const hrefs = SIDEBAR_VIDEO_LINKS.map((link) => link.href);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("points every link at a /videos route", () => {
    for (const link of SIDEBAR_VIDEO_LINKS) {
      expect(link.href.startsWith("/videos/")).toBe(true);
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
    // Practice section — see the test below.
    const html = sidebarHtml();
    const hrefs = hrefsIn(html);
    const referenceHrefs = new Set(VIDEO_REFERENCE_LINKS.map((link) => link.href));
    for (const link of SIDEBAR_VIDEO_LINKS) {
      if (referenceHrefs.has(link.href)) continue;
      expect(hrefs).toContain(link.href);
      expect(html).toContain(link.title);
    }
  });

  it("gives the mobile quick-link tiles one per entry", () => {
    // The tiles are the sidebar's stand-in on `/videos` below `md`, so a
    // destination missing here is a destination a phone cannot reach there.
    const html = renderToStaticMarkup(createElement(QuickLinksGrid, {}));
    const hrefs = hrefsIn(html);
    expect(hrefs).toHaveLength(SIDEBAR_VIDEO_LINKS.length);
    for (const link of SIDEBAR_VIDEO_LINKS) {
      expect(hrefs).toContain(link.href);
      expect(html).toContain(link.title);
    }
  });

  it("keeps the glossary and rankings pair in both", () => {
    // The pair that went missing: at the end of the tool tree's Practice
    // section in the sidebar, and a tile on mobile.
    const practice = hrefsIn(
      renderToStaticMarkup(<ToolNavTree sectionIds={[PRACTICE_SECTION_ID]} />),
    );
    const tiles = hrefsIn(renderToStaticMarkup(createElement(QuickLinksGrid, {})));
    for (const link of VIDEO_REFERENCE_LINKS) {
      expect(practice).toContain(link.href);
      expect(tiles).toContain(link.href);
    }
  });
});
