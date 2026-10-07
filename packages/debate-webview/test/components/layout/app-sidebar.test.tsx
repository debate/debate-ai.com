/**
 * @fileoverview Pins the sidebar-07 tool sidebar's navigation: the real tool
 * routes (not the block's `#` demo links), one highlighted row, the current
 * sections all open, and the five apps standing in for the dock at icon
 * width.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SIDEBAR_TOOL_SECTIONS } from "@debate/videos";

let pathname = "/coaching/ai-coach";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: () => {}, refresh: () => {}, prefetch: () => {} }),
}));

const { SidebarProvider } = await import("../../../src/lib/ui/primitives/sidebar");
const { NavMain, isToolActive } = await import("../../../src/components/layout/app-sidebar/nav-main");
const { NavApps } = await import("../../../src/components/layout/app-sidebar/nav-apps");

function render(node: React.ReactNode, open = true) {
  return renderToStaticMarkup(<SidebarProvider open={open}>{node}</SidebarProvider>);
}

describe("isToolActive", () => {
  it("matches a tool's own path exactly", () => {
    expect(isToolActive("/research/cards", "/research/cards")).toBe(true);
    // A prefix is not enough: `/research` would otherwise light up on every
    // `/research/cards/*` page beside the row you are actually on.
    expect(isToolActive("/research", "/research/cards")).toBe(false);
  });

  it("keeps Team Rankings lit on the team and school profiles it links to", () => {
    expect(isToolActive("/coaching/rankings", "/teams/some-team")).toBe(true);
    expect(isToolActive("/coaching/rankings", "/schools/some-school")).toBe(true);
    expect(isToolActive("/coaching/leaderboard", "/teams/some-team")).toBe(false);
  });

  it("is false without a pathname", () => {
    expect(isToolActive("/practice", null)).toBe(false);
  });
});

describe("NavMain", () => {
  it("renders every tool section by title", () => {
    pathname = "/coaching/ai-coach";
    const html = render(<NavMain />);
    // Titles reach the markup HTML-escaped ("Prep &amp; Scout").
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      expect(html).toContain(`<span>${section.title.replace(/&/g, "&amp;")}</span>`);
    }
  });

  it("opens the current route's section with real links and one active row", () => {
    pathname = "/coaching/ai-coach";
    const html = render(<NavMain />);
    const coaching = SIDEBAR_TOOL_SECTIONS.find((section) => section.id === "coaching")!;
    for (const tool of coaching.tools) expect(html).toContain(`href="${tool.href}"`);
    expect(html).not.toContain('href="#"');
    expect(html.match(/data-active="true"/g)).toHaveLength(1);
  });

  it("starts every section expanded", () => {
    pathname = "/coaching/ai-coach";
    const html = render(<NavMain />);
    // Closed Radix collapsibles render no content, so every tool link showing
    // means every section is open.
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      for (const tool of section.tools) expect(html).toContain(`href="${tool.href}"`);
    }
  });
});

describe("NavApps", () => {
  it("lists the app dock's destinations and is shown only at icon width", () => {
    pathname = "/videos";
    const html = render(<NavApps />, false);
    expect(html).toContain('href="/videos"');
    expect(html).toContain('href="/research/cards"');
    expect(html).toContain("group-data-[collapsible=icon]:flex");
  });
});
