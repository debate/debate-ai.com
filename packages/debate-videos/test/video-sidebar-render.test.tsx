/**
 * @fileoverview End-to-end render guard for the videos sidebar.
 *
 * `tree-item-icon.test.ts` pins the icon discriminator in isolation; this
 * file pins the thing that actually broke — rendering `/videos` threw
 * `TypeError: Cannot read properties of undefined (reading 'startsWith')`
 * and dropped the whole route into the error boundary, because Lucide icons
 * (which are `React.forwardRef` objects, not functions) were handed to
 * `next/image` as a `src`.
 *
 * Rendering to static markup is enough to catch it: the failure happened
 * during render, before any effect or browser API was involved.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type FunctionComponent } from "react";
import { GraduationCap } from "lucide-react";

/**
 * Stand-in for `next/image` that reproduces the one behaviour this test is
 * about: vinext's shim resolves a source as
 * `typeof src === "string" ? src : src.src` and then calls
 * `.startsWith("http://")` on the result. Anything that is neither a URL
 * string nor a `StaticImageData` therefore yields `undefined` and throws —
 * which is precisely the production crash. Mocking rather than importing the
 * real shim keeps the test pinned to that contract instead of to whichever
 * `next` version the package happens to resolve.
 */
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: unknown; alt?: string; className?: string }) => {
    const resolved = typeof src === "string" ? src : (src as { src: string }).src;
    // The exact call that threw in production.
    resolved.startsWith("http://");
    return createElement("img", { src: resolved, alt, className });
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: unknown; className?: string }) =>
    createElement("a", { href, className }, children as never),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/videos",
}));

const ImageMock = (await import("next/image")) as unknown as {
  default: FunctionComponent<{ src: unknown; alt?: string; className?: string }>;
};
const { VideoSidebarTree } = await import(
  "../src/components/category-gallery/VideoSidebarTree"
);
const { QuickLinksGrid } = await import(
  "../src/components/category-gallery/QuickLinksGrid"
);

function renderSidebar(): string {
  return renderToStaticMarkup(
    createElement(VideoSidebarTree, {
      counts: { college: 12, favorites: 3, lectures: 40 },
      lectureCategories: [
        { id: "all", title: "All Lectures", count: 40 },
        { id: "strategy", title: "Strategy", count: 9 },
      ] as never,
      selectedCategory: "all",
      activeId: "lectures",
      lecturesExpanded: true,
      onToggleLectures: () => {},
    }),
  );
}

describe("the next/image stand-in", () => {
  it("throws the production error when handed a Lucide icon as a src", () => {
    // Without this, the sidebar assertions below could pass vacuously. It
    // shows the stand-in still reproduces the original failure, so the tests
    // that follow are only green because the component stopped routing
    // components through it.
    const NextImage = ImageMock.default;
    expect(() =>
      renderToStaticMarkup(createElement(NextImage, { src: GraduationCap })),
    ).toThrow(/Cannot read properties of undefined \(reading 'startsWith'\)/);
    // A real image source still renders.
    expect(
      renderToStaticMarkup(createElement(NextImage, { src: "/assets/icon.svg" })),
    ).toContain('src="/assets/icon.svg"');
  });
});

describe("VideoSidebarTree", () => {
  it("renders without throwing", () => {
    expect(() => renderSidebar()).not.toThrow();
  });

  it("renders Lucide section headings as inline SVG, never as an image", () => {
    const html = renderSidebar();
    // The Coaching / Research / Practice headings carry Lucide icons.
    expect(html).toContain("Coaching");
    expect(html).toContain("Research");
    expect(html).toContain("Practice");
    expect(html).toContain("lucide");
    expect(html).toContain("<svg");
  });

  it("never emits an image with an undefined or empty source", () => {
    const html = renderSidebar();
    expect(html).not.toContain('src="undefined"');
    expect(html).not.toContain('src=""');
    for (const [, src] of html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)) {
      expect(src.length).toBeGreaterThan(0);
      expect(src).not.toBe("undefined");
    }
  });

  it("still renders the imported-image icons as images", () => {
    const html = renderSidebar();
    expect(html).toContain("<img");
  });
});

describe("QuickLinksGrid", () => {
  it("renders both layouts without throwing and with usable image sources", () => {
    for (const layout of ["grid", "list"] as const) {
      const html = renderToStaticMarkup(
        createElement(QuickLinksGrid, {
          counts: { college: 4, policy: 2 },
          activeId: "college",
          layout,
        }),
      );
      expect(html).toContain("College Debates");
      expect(html).not.toContain('src="undefined"');
      for (const [, src] of html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)) {
        expect(src.length).toBeGreaterThan(0);
      }
    }
  });
});
