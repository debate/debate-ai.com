/**
 * @fileoverview Pins the sidebar tree's expansion behaviour: every section is
 * open from the start, and collapsing one leaves the others alone.
 *
 * The regression this covers: the tree used to be an accordion — exactly one
 * section open, the one holding the current route, every other section's links
 * unmounted. Reaching a tool in another section was therefore always two
 * clicks with the list you were reading vanishing in between. `ToolNavTree`
 * now renders all sections expanded and toggles them independently.
 *
 * Two halves: static markup answers which links are mounted on arrival, and
 * `sidebar-section-expansion`'s pure helpers answer what a click does to the
 * expanded set — the trees hand their `useState` setters straight to those, so
 * testing them is testing the toggle without needing a DOM.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const pathname = vi.hoisted(() => ({ current: "/practice-round" }));

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

const { ToolNavTree } = await import("../src/components/category-gallery/ToolNavTree");
const { SIDEBAR_TOOL_SECTIONS } = await import(
  "../src/components/category-gallery/sidebar-tool-sections"
);
const { VIDEOS_SECTION_ID } = await import(
  "../src/components/category-gallery/sidebar-active-section"
);
const { ALL_SIDEBAR_SECTION_IDS, toggleExpandedSection, withSectionExpanded } = await import(
  "../src/components/category-gallery/sidebar-section-expansion"
);

/** One href per section, to assert that section's links are mounted. */
const SAMPLE_HREF_BY_SECTION: Record<string, string> = {
  coaching: "/coaching-programs",
  research: "/cards/library",
  practice: "/judge-decision",
};

describe("ToolNavTree expansion", () => {
  it("mounts every section's links on arrival, not just the route's", () => {
    const html = renderToStaticMarkup(<ToolNavTree />);

    for (const section of SIDEBAR_TOOL_SECTIONS) {
      const href = SAMPLE_HREF_BY_SECTION[section.id];
      expect(href, `no sample href for section "${section.id}"`).toBeTruthy();
      expect(html).toContain(`href="${href}"`);
    }
    // No "Apps" node any more: it spelled out the dock's own five icons as
    // text right below the dock, so the column said everything twice.
    expect(html).not.toContain("All Tools");
  });

  it("starts fully collapsed when defaultExpanded is false", () => {
    const html = renderToStaticMarkup(<ToolNavTree defaultExpanded={false} />);

    for (const href of Object.values(SAMPLE_HREF_BY_SECTION)) {
      expect(html).not.toContain(`href="${href}"`);
    }
    // The headings themselves are still there to expand.
    expect(html).toContain("Coaching");
  });

  it("renders exactly the sections a controlling parent says are expanded", () => {
    const html = renderToStaticMarkup(
      <ToolNavTree expandedSectionIds={["research"]} onToggleSection={() => {}} />,
    );

    expect(html).toContain('href="/cards/library"');
    expect(html).not.toContain('href="/coaching-programs"');
    expect(html).not.toContain('href="/judge-decision"');
  });
});

describe("sidebar section expansion set", () => {
  it("starts with every h1 node open, Videos included", () => {
    expect(ALL_SIDEBAR_SECTION_IDS).toContain(VIDEOS_SECTION_ID);
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      expect(ALL_SIDEBAR_SECTION_IDS).toContain(section.id);
    }
  });

  it("collapses only the toggled section, never the rest", () => {
    const next = toggleExpandedSection(ALL_SIDEBAR_SECTION_IDS, "coaching");

    expect(next).not.toContain("coaching");
    expect(next).toContain("research");
    expect(next).toContain("practice");
    expect(next).toContain(VIDEOS_SECTION_ID);
  });

  it("re-expands a collapsed section without closing anything else", () => {
    const collapsed = toggleExpandedSection(ALL_SIDEBAR_SECTION_IDS, "research");
    const reopened = toggleExpandedSection(collapsed, "research");

    expect([...reopened].sort()).toEqual([...ALL_SIDEBAR_SECTION_IDS].sort());
  });

  it("leaves the input array untouched", () => {
    const before = [...ALL_SIDEBAR_SECTION_IDS];
    toggleExpandedSection(ALL_SIDEBAR_SECTION_IDS, "practice");

    expect([...ALL_SIDEBAR_SECTION_IDS]).toEqual(before);
  });

  it("expands the route's section on navigation and collapses nothing", () => {
    const collapsed = toggleExpandedSection(ALL_SIDEBAR_SECTION_IDS, "practice");
    const navigated = withSectionExpanded(collapsed, "practice");

    expect(navigated).toContain("practice");
    expect(navigated).toContain("research");
  });

  it("returns the same array when the section is already expanded", () => {
    // Identity, not just equality: the trees feed this to a `useState` setter,
    // where a new array on every navigation would re-render for nothing.
    expect(withSectionExpanded(ALL_SIDEBAR_SECTION_IDS, "research")).toBe(
      ALL_SIDEBAR_SECTION_IDS,
    );
  });
});
