// @vitest-environment jsdom
/**
 * @fileoverview The app's one sidebar: the library tree every view mounts,
 * and the shared hide/show choice the column, the dock and every page read.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: unknown; className?: string }) =>
    createElement("a", { href, className }, children as never),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/coaching/ai-coach",
}));

const { LibrarySidebarTree } = await import("../src/components/category-gallery/LibrarySidebarTree");
const { SIDEBAR_TOOL_SECTIONS } = await import("../src/components/category-gallery/sidebar-tool-sections");
const { ResizableSidebarLayout } = await import("../src/ui/layout/ResizableSidebarLayout");
const {
  SIDEBAR_COLLAPSED_KEY,
  readSidebarCollapsed,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
} = await import("../src/ui/layout/sidebar-collapse");

describe("LibrarySidebarTree", () => {
  const html = renderToStaticMarkup(createElement(LibrarySidebarTree));

  it("carries the video library's sections on a tool page", () => {
    expect(html).toContain("Round Videos");
    expect(html).toContain('href="/videos/college"');
    expect(html).toContain("Lectures");
  });

  it("carries every tool section too", () => {
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      expect(html).toContain(section.title.replace(/&/g, "&amp;"));
    }
  });
});

describe("ResizableSidebarLayout", () => {
  const html = renderToStaticMarkup(
    createElement(ResizableSidebarLayout, {
      sidebar: createElement("nav", null, "tree"),
      footer: createElement("div", { "data-testid": "footer" }),
      children: createElement("main", null, "page"),
    }),
  );

  it("has a resize handle and a hide button", () => {
    expect(html).toContain('aria-label="Resize sidebar"');
    expect(html).toContain('aria-label="Hide sidebar"');
  });

  it("pins the footer it is given beside the hide button", () => {
    expect(html).toContain('data-testid="footer"');
  });

  it("renders shown on the server, so hydration never disagrees", () => {
    expect(html).not.toContain('aria-label="Show sidebar"');
    expect(html).not.toContain("data-collapsed");
  });
});

describe("sidebar-collapse", () => {
  afterEach(() => localStorage.removeItem(SIDEBAR_COLLAPSED_KEY));

  it("is shown until hidden, and remembers the choice", () => {
    expect(readSidebarCollapsed()).toBe(false);
    setSidebarCollapsed(true);
    expect(readSidebarCollapsed()).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
    setSidebarCollapsed(false);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
  });

  it("tells subscribers in this document when it changes", () => {
    const listener = vi.fn();
    window.addEventListener("app-sidebar-collapsed-change", listener);
    toggleSidebarCollapsed();
    toggleSidebarCollapsed();
    window.removeEventListener("app-sidebar-collapsed-change", listener);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(readSidebarCollapsed()).toBe(false);
  });
});
