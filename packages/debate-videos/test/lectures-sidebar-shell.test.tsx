/**
 * @fileoverview The glossary and rankings pages keep the sidebar.
 *
 * `/videos/dictionary` and `/videos/rankings` are two rows in the sidebar's
 * own tree, and both used to answer with a bare page: `LecturesPage` returned
 * their branch without the column, and because `hasEmbeddedDock` reports every
 * `/videos` path as already carrying a sidebar-hosted dock, the app's
 * `CategoryDock` kept its fixed instance hidden too. Clicking either link in
 * the sidebar therefore removed the sidebar — and the dock with it.
 *
 * {@link LecturesSidebarShell} is what puts the column back, so this pins that
 * it renders the dock slot it is given, the nav tree, and the footer.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: unknown; alt?: string; className?: string }) =>
    createElement("img", {
      src: typeof src === "string" ? src : (src as { src: string })?.src,
      alt,
      className,
    }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: unknown; className?: string }) =>
    createElement("a", { href, className }, children as never),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/videos/dictionary",
}));

const { LecturesSidebarShell } = await import("../src/panels/LecturesSidebarShell");

function render(activeId: string): string {
  return renderToStaticMarkup(
    createElement(LecturesSidebarShell, {
      dockSlot: createElement("div", { "data-testid": "dock-slot" }, "dock"),
      lectureCategories: [],
      lecturesExpanded: false,
      onToggleLectures: () => {},
      activeId,
      children: createElement("main", null, "page"),
    }),
  );
}

describe("LecturesSidebarShell", () => {
  it("renders the dock slot it is handed", () => {
    expect(render("dictionary")).toContain('data-testid="dock-slot"');
  });

  it("renders the nav tree, so the next hop is one click away", () => {
    const html = render("rankings");
    // A video destination, a tool destination, and the two reference rows
    // themselves — i.e. the whole tree, not a stub.
    expect(html).toContain('href="/videos/lectures"');
    expect(html).toContain('href="/coach"');
    expect(html).toContain('href="/videos/dictionary"');
    expect(html).toContain('href="/videos/rankings"');
  });

  it("renders the site footer links", () => {
    const html = render("dictionary");
    expect(html).toContain("Privacy");
  });

  it("renders the page it wraps beside the column", () => {
    expect(render("dictionary")).toContain("<main>page</main>");
  });

  it("marks the column as app chrome, so the pre-paint rule can hide it in a frame", () => {
    expect(render("dictionary")).toContain("data-app-chrome");
  });
});
