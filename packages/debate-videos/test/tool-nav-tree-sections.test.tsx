/**
 * @fileoverview Pins what `ToolNavTree` renders when a caller narrows it to a
 * subset of sections.
 *
 * The regression this covers: `/cards` used to get the whole nav — every tool
 * section and the glossary/rankings pair — stacked under its document panels.
 * The app's `AppSidebarShell` now asks for the Research section alone, and
 * the two things that have to hold for that column to be usable are that
 * nothing else renders, and that the one section shown is *open*: `/cards` is
 * a dock destination that no tool section lists, so following the route
 * blindly would leave a heading with no links under it.
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
const { PRACTICE_SECTION_ID, RESEARCH_SECTION_ID } = await import(
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

  it("leaves out the glossary/rankings pair, which rides with Practice", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID] });

    expect(html).not.toContain("/dictionary");
    expect(html).not.toContain("/videos/rankings");
  });

  it("renders no Apps node in any shape", () => {
    // It was the app dock's own five icons spelled out as text directly
    // below the dock — the column saying everything twice.
    for (const html of [render({}), render({ sectionIds: [RESEARCH_SECTION_ID] })]) {
      expect(html).not.toContain(">Apps<");
      expect(html).not.toContain("All Tools");
      expect(html).not.toContain('href="/tools"');
    }
  });

  it("opens the one section shown even though the route matches another", () => {
    // `/cards` is an app-dock destination that no tool section lists, so
    // `sidebarSectionForPath` returns null for it. Without the fallback the
    // column would be a single collapsed heading.
    const html = render({ sectionIds: [RESEARCH_SECTION_ID] });

    expect(html).toContain("/cards/library");
    expect(html).toContain("/reason-editor");
  });

  it("still renders every section when no sections are named", () => {
    const html = render({});

    expect(html).toContain("Coaching");
    expect(html).toContain("Research");
    expect(html).toContain("Practice");
  });

  it("closes Practice with the glossary and rankings links", () => {
    // They used to hang below the whole tree, in no section at all.
    pathname.current = "/paradigms";
    try {
      const html = render({ sectionIds: [PRACTICE_SECTION_ID] });

      expect(html).toContain("/videos/dictionary");
      expect(html).toContain("/videos/rankings");
      // Last in the section: reference material after the tools themselves.
      expect(html.indexOf("/annotations")).toBeLessThan(html.indexOf("/videos/dictionary"));
    } finally {
      pathname.current = "/cards";
    }
  });

  it("ignores an id no section carries rather than throwing", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID, "no-such-section"] });

    expect(html).toContain("Research");
    expect(html).not.toContain("Coaching");
  });
});
