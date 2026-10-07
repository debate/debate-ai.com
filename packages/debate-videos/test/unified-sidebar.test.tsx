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
const { ResizableSidebarLayout, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, isNearSidebarEdge, isSidebarMenuOpen, sidebarPeekWidth } =
  await import("../src/ui/layout/ResizableSidebarLayout");
const { PEEK_ANIMATIONS, pickPeekAnimation } = await import("../src/ui/layout/sidebar-peek-animations");
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

describe("hidden sidebar peek", () => {
  it("peeks only when the pointer is right at the left edge", () => {
    expect(isNearSidebarEdge(0)).toBe(true);
    expect(isNearSidebarEdge(8)).toBe(true);
    expect(isNearSidebarEdge(9)).toBe(false);
    expect(isNearSidebarEdge(400)).toBe(false);
  });

  it("opens at the user's own width, clamped, or the default", () => {
    expect(sidebarPeekWidth(null)).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(sidebarPeekWidth(360)).toBe(360);
    expect(sidebarPeekWidth(10)).toBe(SIDEBAR_MIN_WIDTH);
    expect(sidebarPeekWidth(5000)).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("stays out for an open menu, but not for an expanded tree section", () => {
    const aside = document.createElement("aside");
    aside.innerHTML = '<button aria-expanded="true">Research</button><button aria-haspopup="menu" aria-expanded="false">Me</button>';
    expect(isSidebarMenuOpen(aside)).toBe(false);
    aside.querySelector("[aria-haspopup]")!.setAttribute("aria-expanded", "true");
    expect(isSidebarMenuOpen(aside)).toBe(true);
    expect(isSidebarMenuOpen(null)).toBe(false);
  });

  it("comes and goes with one of ten animations, never the same twice running", () => {
    expect(PEEK_ANIMATIONS).toHaveLength(10);
    expect(new Set(PEEK_ANIMATIONS.map((a) => a.name)).size).toBe(10);
    for (const a of PEEK_ANIMATIONS) {
      expect(a.in).toBeTruthy();
      expect(a.out).toBeTruthy();
    }
    expect(pickPeekAnimation(null, () => 0)).toBe(PEEK_ANIMATIONS[0]);
    expect(pickPeekAnimation(null, () => 0.999)).toBe(PEEK_ANIMATIONS[9]);
    for (const previous of PEEK_ANIMATIONS) {
      for (const r of [0, 0.5, 0.999]) expect(pickPeekAnimation(previous, () => r)).not.toBe(previous);
    }
  });
});
