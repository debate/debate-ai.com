/**
 * @fileoverview Pins what `ToolNavTree` renders when a caller narrows it to a
 * subset of sections.
 *
 * The regression this covers: `/cards` used to get the whole nav — the Apps
 * node, all three tool sections, and the glossary/rankings pair — stacked
 * under its document panels. The app's `AppSidebarShell` now asks for the
 * Research section alone, and the two things that have to hold for that
 * column to be usable are that nothing else renders, and that the one section
 * shown is *open*: `/cards` matches the (omitted) Apps node, so following the
 * route blindly would leave a heading with no links under it.
 *
 * Static markup is enough — the question is which rows the tree renders.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const pathname = vi.hoisted(() => ({ current: "/cards" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => pathname.current,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) =>
    createElement("img", { src: typeof src === "string" ? src : (src as { src: string }).src, alt }),
}));

import type { ToolNavTreeProps } from "../src/components/category-gallery/ToolNavTree";

const { ToolNavTree } = await import("../src/components/category-gallery/ToolNavTree");
const { RESEARCH_SECTION_ID } = await import(
  "../src/components/category-gallery/sidebar-tool-sections"
);

function render(props: ToolNavTreeProps): string {
  return renderToStaticMarkup(<ToolNavTree {...props} />);
}

describe("ToolNavTree sectionIds", () => {
  it("renders only the named section's heading", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID] });

    expect(html).toContain("Research");
    expect(html).not.toContain("Coaching");
    expect(html).not.toContain("Practice");
  });

  it("drops the Apps node and the reference links around the sections", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID] });

    // The Apps node and its "All Tools" entry are the app dock restated as
    // text; on /cards the dock itself sits right above this tree.
    expect(html).not.toContain("All Tools");
    expect(html).not.toContain(">Apps<");
    // The glossary/rankings pair below the tree belongs to the video library.
    expect(html).not.toContain("/dictionary");
  });

  it("opens the one section shown even though the route matches another", () => {
    // `/cards` is an app-dock destination, so `sidebarSectionForPath` puts it
    // in the Apps node — which this tree doesn't render. Without the fallback
    // the column would be a single collapsed heading.
    const html = render({ sectionIds: [RESEARCH_SECTION_ID] });

    expect(html).toContain("/cards/library");
    expect(html).toContain("/reason-editor");
  });

  it("still renders the whole tree when no sections are named", () => {
    const html = render({});

    expect(html).toContain("All Tools");
    expect(html).toContain("Coaching");
    expect(html).toContain("Practice");
  });

  it("ignores an id no section carries rather than throwing", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID, "no-such-section"] });

    expect(html).toContain("Research");
    expect(html).not.toContain("Coaching");
  });
});
