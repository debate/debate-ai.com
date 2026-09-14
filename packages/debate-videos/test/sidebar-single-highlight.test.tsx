/**
 * @fileoverview Pins that exactly one collection in the videos sidebar reads
 * as selected.
 *
 * Opening College Debates highlighted "All Lectures" as well: the two
 * collections are highlighted by different rules — `activeId` for the round
 * collections, `selectedCategory` for the lecture categories — and the second
 * defaults to `"all"` on every video route, not only inside the lecture
 * library. `browsingLectures` is what separates them, so the assertions below
 * are about which rows carry the active ring, not about how the tree looks.
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
      lectureCategories: [
        { key: "documentaries_culture", label: "Documentaries & Culture", count: 20, maxViews: 100 },
        { key: "round_analysis", label: "Round Analysis", count: 17, maxViews: 90 },
      ],
      selectedCategory: "all",
      lecturesExpanded: true,
      onToggleLectures: () => {},
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
  it("highlights only College Debates on a round collection", () => {
    const rows = activeRows(render({ activeId: "college" }));

    expect(rows).toEqual(["College Debates"]);
    expect(rows).not.toContain("All Lectures");
  });

  it("highlights All Lectures while the lecture library is what is open", () => {
    expect(activeRows(render({ browsingLectures: true }))).toEqual(["All Lectures"]);
  });

  it("highlights nothing on the rankings and glossary pages", () => {
    expect(activeRows(render({ activeId: "rankings" }))).toEqual([]);
  });
});
