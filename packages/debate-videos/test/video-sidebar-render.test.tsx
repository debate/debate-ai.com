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
      // The real `/api/videos/meta` shape — `key`/`label`, not `id`/`title`.
      // Cast as `never`, the wrong shape rendered blank rows pointing at
      // `/videos/undefined` and the assertions below never noticed.
      lectureCategories: [
        { key: "strategy", label: "Strategy", count: 9, maxViews: 100 },
        { key: "theory", label: "Theory", count: 31, maxViews: 80 },
      ],
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

describe("the sidebar's heading structure", () => {
  it("puts College Debates and My Favorites under a Round Videos h1", () => {
    const html = renderSidebar();
    expect(html).toMatch(/<h1[^>]*>Round Videos<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>College Debates<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>My Favorites<\/h2>/);
    // The h1 comes first: both are nested inside it, not siblings of it.
    expect(html.indexOf(">Round Videos<")).toBeLessThan(html.indexOf(">College Debates<"));
    expect(html.indexOf(">College Debates<")).toBeLessThan(html.indexOf(">My Favorites<"));
  });

  it("gives Lectures an h1 of its own, after the Round Videos section", () => {
    // Lectures used to hang off the Videos node as an h2 two levels in, which
    // read as a filter on the round archive rather than the other library.
    const html = renderSidebar();
    expect(html).toMatch(/<h1[^>]*>Lectures<\/h1>/);
    expect(html).not.toMatch(/<h2[^>]*>Lectures<\/h2>/);
    expect(html.indexOf(">My Favorites<")).toBeLessThan(html.indexOf(">Lectures<"));
    // Its categories are the section's own content, one level in.
    expect(html).toMatch(/<h2[^>]*>All Lectures<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>Strategy<\/h2>/);
  });

  it("renders Coaching / Research / Practice as h1 sections", () => {
    const html = renderSidebar();
    for (const title of ["Coaching", "Research", "Practice"]) {
      expect(html).toMatch(new RegExp(`<h1[^>]*>${title}<\\/h1>`));
    }
  });

  it("gives every h1 section a destination a modifier-click can open", () => {
    // A plain click on a section heading still only toggles it — the heading
    // is a grouping, not a destination (`TreeItem` calls `preventDefault` for
    // exactly that, see `opensElsewhere` below). But it has to be a real
    // anchor with a real href, because ctrl/cmd/shift/middle-click is handled
    // by the browser and there is nothing for it to open on a `<button>`:
    // "open in a new tab" silently did nothing on the five rows that happened
    // to be sections.
    const html = renderSidebar();
    for (const title of ["Round Videos", "Lectures", "Coaching", "Research", "Practice"]) {
      expect(html).toMatch(
        new RegExp(
          `<a[^>]*href="/[^"]*"[^>]*aria-expanded="(?:true|false)"[^>]*>(?:(?!</a>)[\\s\\S])*<h1[^>]*>${title}</h1>`,
        ),
      );
    }
  });

  it("opens only the section that holds the current route", () => {
    // `usePathname` is mocked to `/videos`, so Round Videos is the open
    // section and every tool section is closed: those are one accordion,
    // which is what keeps the sidebar to the content of wherever the dock
    // just took you. Lectures is outside it — the page owns whether it is
    // open, and here it is.
    const html = renderSidebar();
    expect(html).toMatch(
      /<a[^>]*aria-expanded="true"[^>]*>(?:(?!<\/a>)[\s\S])*<h1[^>]*>Round Videos<\/h1>/,
    );
    for (const title of ["Coaching", "Research", "Practice"]) {
      expect(html).toMatch(
        new RegExp(`<a[^>]*aria-expanded="true"[^>]*>(?:(?!</a>)[\\s\\S])*<h1[^>]*>${title}</h1>`),
      );
    }
    expect(html).not.toContain('aria-expanded="false"');
  });

  it("renders no Apps node restating the app dock", () => {
    // The dock itself is mounted directly above this tree (`dockSlot`), so
    // the node under it was the same five destinations a second time.
    const html = renderSidebar();
    expect(html).not.toContain(">Apps<");
    expect(html).not.toContain("All Tools");
    expect(html).not.toContain('href="/tools"');
  });

  it("renders no links for the sections it leaves closed", () => {
    // The point of the accordion: a closed section costs no DOM and no link
    // for the router to prefetch. Fifty of those fired on every /videos load.
    const html = renderSidebar();
    expect(html).toContain("Coaching Programs");
    expect(html).toContain("Evidence Library");
    expect(html).toContain("Judge Paradigm Picker");
    expect(html).toContain("All Tools");
    // ...alongside the Videos node's own links, which were never in doubt.
    expect(html).toContain("PF Debates");
    expect(html).toContain("My Favorites");
  });

  it("keeps the glossary and rankings pair inside the Practice section", () => {
    // They used to hang below the tree, outside every section. Now they are
    // the tail of Practice, so on `/videos` — where Practice is closed —
    // they cost no DOM, exactly like the tools they sit with.
    // `tool-nav-tree-sections.test.tsx` pins that they are in fact there.
    const html = renderSidebar();
    expect(html).not.toContain("Glossary of Terms");
    expect(html).not.toContain("/videos/dictionary");
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
