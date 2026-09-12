/**
 * @fileoverview Pins the icons on the tool sidebar's rows: every tool link
 * carries one, every one of them is a Lucide glyph, and the tree renders no
 * image icon that would draw at its own colors next to them.
 *
 * Two things this guards:
 *
 * - The tool rows used to render with no glyph at all — a column of 35 bare
 *   text links under three sections that each had one.
 * - The glossary/rankings pair at the end of Practice drew `ui/icons` images
 *   (`icon-book.svg`, `icon-leaderboard.png`). An image cannot take a text
 *   color, so those two were the only rows in the tree whose icons did not
 *   match `TREE_ITEM_ICON_CLASS`.
 *
 * Static markup is enough: the icon each row draws is decided during render.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/research",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) =>
    createElement("img", { src: typeof src === "string" ? src : (src as { src: string }).src, alt }),
}));

const { ToolNavTree } = await import("../src/components/category-gallery/ToolNavTree");
const { TREE_ITEM_ICON_CLASS } = await import("../src/components/category-gallery/TreeItem");
const { isImageIconSource } = await import("../src/components/category-gallery/icon-kind");
const { APP_DOCK_LINKS, SIDEBAR_TOOL_SECTIONS } = await import(
  "../src/components/category-gallery/sidebar-tool-sections"
);
const { VIDEO_REFERENCE_LINKS } = await import(
  "../src/components/category-gallery/sidebar-video-links"
);

const html = renderToStaticMarkup(<ToolNavTree />);

describe("sidebar tool link icons", () => {
  it("gives every tool in every section an icon", () => {
    expect(SIDEBAR_TOOL_SECTIONS.length).toBeGreaterThan(0);
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      expect(section.tools.length).toBeGreaterThan(0);
      for (const tool of section.tools) {
        expect(tool.icon, `${tool.href} (${tool.title}) has no icon`).toBeTruthy();
      }
    }
  });

  it("gives every app dock link an icon", () => {
    for (const link of APP_DOCK_LINKS) {
      expect(link.icon, `${link.href} (${link.title}) has no icon`).toBeTruthy();
    }
  });

  it("uses Lucide components throughout, never an image source", () => {
    const icons = [
      ...SIDEBAR_TOOL_SECTIONS.map((section) => section.icon),
      ...SIDEBAR_TOOL_SECTIONS.flatMap((section) => section.tools.map((tool) => tool.icon)),
      ...APP_DOCK_LINKS.map((link) => link.icon),
    ];
    for (const icon of icons) {
      expect(isImageIconSource(icon)).toBe(false);
    }
  });
});

describe("the rendered tool tree", () => {
  it("draws one glyph per row, all in the one shared icon color", () => {
    const glyphs = html.match(new RegExp(TREE_ITEM_ICON_CLASS, "g")) ?? [];
    const rows =
      SIDEBAR_TOOL_SECTIONS.length +
      SIDEBAR_TOOL_SECTIONS.reduce((sum, section) => sum + section.tools.length, 0) +
      VIDEO_REFERENCE_LINKS.length;

    expect(glyphs).toHaveLength(rows);
    expect(TREE_ITEM_ICON_CLASS).toContain("text-muted-foreground");
  });

  it("renders no image icon, which would ignore that color", () => {
    expect(html).not.toContain("<img");
  });
});
