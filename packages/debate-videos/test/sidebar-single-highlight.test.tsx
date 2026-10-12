/**
 * @fileoverview Pins that exactly one collection in the videos sidebar reads
 * as selected.
 *
 * The Lectures row lights up from `browsingLectures` (any lecture-library
 * page, category pages included) as well as `activeId`, so the assertions
 * below pin that it never lights alongside a round collection.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/videos/college",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) =>
    createElement("img", { src: typeof src === "string" ? src : (src as { src: string }).src, alt }),
}));

const { VideoSidebarTree } = await import(
  "../src/components/category-gallery/VideoSidebarTree"
);

/** The ring `TreeItem` puts on the selected row. */
const ACTIVE_CLASS = "ring-primary/40";

function render(props: { activeId?: string; browsingLectures?: boolean }): string {
  return renderToStaticMarkup(
    createElement(VideoSidebarTree, {
      counts: { college: 1400, lectures: 895 },
      ...props,
    }),
  );
}

/** Titles of the rows rendered with the active ring, in document order. */
function activeRows(markup: string): string[] {
  const titles: string[] = [];
  // Each row is `<div class="… ring-primary/40">…<h*>Title</h*>`; the ring
  // and the heading are in the same block, so one pass over the rows is
  // enough to say which of them is selected.
  for (const row of markup.split('<div class="flex items-stretch')) {
    if (!row.includes(ACTIVE_CLASS)) continue;
    const heading = row.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/);
    if (heading) titles.push(heading[1]);
  }
  return titles;
}

describe("VideoSidebarTree highlighting", () => {
  it("highlights only College Policy on a round collection", () => {
    const rows = activeRows(render({ activeId: "college" }));

    expect(rows).toEqual(["College Policy"]);
    expect(rows).not.toContain("Lectures");
  });

  it("highlights Lectures while the lecture library is what is open", () => {
    expect(activeRows(render({ browsingLectures: true }))).toEqual(["Lectures"]);
  });

  it("highlights nothing on the rankings and glossary pages", () => {
    expect(activeRows(render({ activeId: "rankings" }))).toEqual([]);
  });
});
