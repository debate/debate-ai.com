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

import type { ToolNavTreeProps } from "../src/components/navigation/sidebar-nav/ToolNavTree";

const { ToolNavTree } = await import("../src/components/navigation/sidebar-nav/ToolNavTree");
const { PRACTICE_DEBATES_SECTION_ID, RESEARCH_SECTION_ID } = await import(
  "../src/components/navigation/sidebar-nav/sidebar-tool-sections"
);

function render(props: ToolNavTreeProps): string {
  return renderToStaticMarkup(<ToolNavTree {...props} />);
}

describe("ToolNavTree sectionIds", () => {
  it("renders only the named section's heading", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID] });

    expect(html).toContain("Research");
    expect(html).not.toContain("Practice debates");
    expect(html).not.toContain("Inference");
    expect(html).not.toMatch(/<h1[^>]*>Practice<\/h1>/);
  });

  it("lists the Prep Workspace under Research, keeping its /practice URL, and no Practice vs AI row", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID] });

    expect(html).not.toContain('href="/practice/versus-ai"');
    expect(html).not.toContain("Practice vs AI");
    expect(html).toContain('href="/practice/prep"');
    expect(html).toContain("Prep Workspace");
  });

  it("leaves out the glossary/rankings pair, which rides with Inference", () => {
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

    // Team Research merged into the Research Workspace row, which also
    // answers for `/research/team`.
    expect(html).toContain("Research Workspace");
    expect(html).toContain("Card Search");
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

    expect(html).toContain("Practice debates");
    expect(html).toContain("Research");
    expect(html).not.toContain("Inference");
  });

  it("lists the former Inference links in Debates without subgroup labels", () => {
    const html = render({ sectionIds: [PRACTICE_DEBATES_SECTION_ID] });

    expect(html).not.toContain(">Performance<");
    expect(html).not.toContain(">Data &amp; Reference<");
    expect(html).toContain("/rank");
    expect(html).toContain("/practice/statistics");
    expect(html).toContain("/practice/predictions");
    expect(html).not.toContain("/practice/rules");
    expect(html).not.toContain("/practice/features");
  });

  it("ignores an id no section carries rather than throwing", () => {
    const html = render({ sectionIds: [RESEARCH_SECTION_ID, "no-such-section"] });

    expect(html).toContain("Research");
    expect(html).not.toContain("Practice debates");
  });
});

describe("SIDEBAR_TOOL_SECTIONS", () => {
  it("is the two remaining sections, in order", async () => {
    const { SIDEBAR_TOOL_SECTIONS } = await import(
      "../src/components/navigation/sidebar-nav/sidebar-tool-sections"
    );
    expect(SIDEBAR_TOOL_SECTIONS.map((section) => section.title)).toEqual([
      "Research",
      "Debates",
    ]);
    // Every link appears in exactly one section.
    const hrefs = SIDEBAR_TOOL_SECTIONS.flatMap((section) => section.tools.map((tool) => tool.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("Team & School Rank", () => {
  it("is a Debates link, and nowhere else", async () => {
    const { SIDEBAR_TOOL_SECTIONS, PRACTICE_DEBATES_SECTION_ID, LEARNING_LINKS } = await import(
      "../src/components/navigation/sidebar-nav/sidebar-tool-sections"
    );
    const debates = SIDEBAR_TOOL_SECTIONS.find((entry) => entry.id === PRACTICE_DEBATES_SECTION_ID);
    expect(debates?.tools.find((tool) => tool.href === "/rank")).toMatchObject({
      href: "/rank",
      title: "Team & School Rank",
    });
    const elsewhere = SIDEBAR_TOOL_SECTIONS.filter((entry) => entry.id !== PRACTICE_DEBATES_SECTION_ID);
    for (const section of elsewhere) {
      expect(section.tools.some((tool) => tool.href === "/rank")).toBe(false);
    }
    expect(LEARNING_LINKS.some((link) => link.href === "/rank")).toBe(false);
  });
});

describe("Learning links", () => {
  it("pins Rules & Glossary then All Features, outside the tool sections", async () => {
    const { SIDEBAR_TOOL_SECTIONS, LEARNING_LINKS } = await import(
      "../src/components/navigation/sidebar-nav/sidebar-tool-sections"
    );
    expect(LEARNING_LINKS.map((link) => link.href)).toEqual(["/practice/rules", "/practice/features"]);
    expect(LEARNING_LINKS[0]).toMatchObject({
      title: "Rules & Glossary",
      aliases: ["/practice/glossary"],
    });
    expect(LEARNING_LINKS[1]?.title).toBe("All Features");
    const toolHrefs = SIDEBAR_TOOL_SECTIONS.flatMap((section) => section.tools.map((tool) => tool.href));
    expect(toolHrefs).not.toContain("/practice/rules");
    expect(toolHrefs).not.toContain("/practice/features");
  });
});

describe("the Debates section", () => {
  it("is the renamed Coaching section (titled Debates), with the merged Practice debates row after Tournaments", async () => {
    const { SIDEBAR_TOOL_SECTIONS, PRACTICE_DEBATES_SECTION_ID } = await import(
      "../src/components/navigation/sidebar-nav/sidebar-tool-sections"
    );
    const section = SIDEBAR_TOOL_SECTIONS.find((entry) => entry.id === PRACTICE_DEBATES_SECTION_ID);
    expect(section?.title).toBe("Debates");
    expect(section?.tools[0]?.href).toBe("/tournament");
    expect(section?.tools[1]).toMatchObject({
      href: "/practice/debates",
      title: "Practice debates",
      aliases: ["/practice/challenges", "/practice/drills", "/practice/partners", "/practice/versus-ai"],
    });
    // The tools no longer have rows of their own anywhere.
    const hrefs = SIDEBAR_TOOL_SECTIONS.flatMap((entry) => entry.tools.map((tool) => tool.href));
    for (const old of ["/practice/challenges", "/practice/drills", "/practice/partners", "/practice/versus-ai"]) {
      expect(hrefs).not.toContain(old);
    }
  });
});
