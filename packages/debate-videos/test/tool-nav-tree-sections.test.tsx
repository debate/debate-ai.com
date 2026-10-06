/**
 * @fileoverview Pins what `ToolNavTree` renders when a caller narrows it to a
 * subset of sections.
 *
 * The regression this covers: `/research/cards` used to get the whole nav — every tool
 * section and the glossary/rankings pair — stacked under its document panels.
 * The app's `AppSidebarShell` now asks for the Research section alone, and
 * the two things that have to hold for that column to be usable are that
 * nothing else renders, and that the one section shown is *open*: `/research/cards` is
 * a dock destination that no tool section lists, so following the route
 * blindly would leave a heading with no links under it.
 *
 * Static markup is enough — the question is which rows the tree renders.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const pathname = vi.hoisted(() => ({ current: "/research/cards" }));

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
const { INSIGHTS_SECTION_ID, RESEARCH_SECTION_ID } = await import(
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

  it("leaves out the glossary/rankings pair, which rides with Insights", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID] });

    expect(html).not.toContain("/dictionary");
    expect(html).not.toContain("/practice/rankings");
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
    // `/research/cards` is an app-dock destination that no tool section lists, so
    // `sidebarSectionForPath` returns null for it. Without the fallback the
    // column would be a single collapsed heading.
    const html = render({ sectionIds: [RESEARCH_SECTION_ID] });

    expect(html).toContain("/research/cards/coverage");
    // Last row in Research: "Team Brainstorm Assist".
    expect(html).toContain("/research/cards/brainstorm");
  });

  it("no longer lists the two dock destinations under Research", () => {
    // "Reason Editor" and "Debate Docs" restated `/reason-editor` and the
    // dock's own Docs button directly beneath the dock, which says both
    // again as icons. The routes keep their sidebars — see
    // `sidebar-routes`' `EXTRA_SIDEBAR_HREFS` and `APP_DOCK_LINKS`.
    for (const html of [render({}), render({ sectionIds: [RESEARCH_SECTION_ID] })]) {
      expect(html).not.toContain("/reason-editor");
      expect(html).not.toContain(">Debate Docs<");
    }
  });

  it("still renders every section when no sections are named", () => {
    const html = render({});

    expect(html).toContain("Coaching");
    expect(html).toContain("Research");
    expect(html).toContain("Practice");
  });

  it("lists Insights links without subgroup labels", () => {
    const html = render({ sectionIds: [INSIGHTS_SECTION_ID] });

    expect(html).not.toContain(">Performance<");
    expect(html).not.toContain(">Data &amp; Reference<");
    expect(html).toContain("/practice/level");
    expect(html).toContain("/practice/glossary");
  });

  it("ignores an id no section carries rather than throwing", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID, "no-such-section"] });

    expect(html).toContain("Research");
    expect(html).not.toContain("Coaching");
  });
});

describe("SIDEBAR_TOOL_SECTIONS", () => {
  it("is the five requested sections, in order", async () => {
    const { SIDEBAR_TOOL_SECTIONS } = await import(
      "../src/components/category-gallery/sidebar-tool-sections"
    );
    expect(SIDEBAR_TOOL_SECTIONS.map((section) => section.title)).toEqual([
      "Research",
      "Prep & Scout",
      "Practice",
      "Coaching",
      "Insights",
    ]);
    // Every link appears in exactly one section.
    const hrefs = SIDEBAR_TOOL_SECTIONS.flatMap((section) => section.tools.map((tool) => tool.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
