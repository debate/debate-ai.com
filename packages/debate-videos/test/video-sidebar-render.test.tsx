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
import { createElement, type ComponentProps, type FunctionComponent } from "react";
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
  "../src/components/navigation/sidebar-nav/VideoSidebarTree"
);
const { QuickLinksGrid } = await import(
  "../src/components/navigation/category-gallery/QuickLinksGrid"
);

function renderSidebar(overrides: Partial<ComponentProps<typeof VideoSidebarTree>> = {}): string {
  return renderToStaticMarkup(
    createElement(VideoSidebarTree, {
      counts: { rounds: 12, favorites: 3, lectures: 40 },
      activeId: "lectures",
      ...overrides,
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
    // The Debates / Research headings carry Lucide icons.
    expect(html).toContain("Practice debates");
    expect(html).toContain("Research");
    expect(html).not.toContain("Inference");
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

  it("draws every row in gray", () => {
    const html = renderSidebar();
    // No baked-color image icons: Favorites and Strategy Lectures are plain glyphs.
    expect(html).not.toContain("<img");
    expect(html).toMatch(/<svg[^>]*text-muted-foreground[^>]*>(?:(?!<\/svg>).)*<\/svg><h2[^>]*>My Favorites/s);
    expect(html).toMatch(/<svg[^>]*text-muted-foreground[^>]*>(?:(?!<\/svg>).)*<\/svg><h2[^>]*>Strategy Lectures/s);
    expect(html).not.toMatch(/<svg[^>]*text-lime-600/);
  });

  it("does not select Strategy Lectures while Debate Rounds is active", () => {
    const html = renderSidebar({ activeId: "rounds" });
    expect(html).toMatch(/<h2 class="[^"]*text-primary[^"]*">Debate Rounds/);
    expect(html).not.toMatch(/<h2 class="[^"]*text-primary[^"]*">Strategy Lectures/);
  });
});

describe("the sidebar's heading structure", () => {
  it("puts Debate Rounds and My Favorites under a Videos h1", () => {
    const html = renderSidebar();
    expect(html).toMatch(/<h1[^>]*>Videos<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Debate Rounds<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>My Favorites<\/h2>/);
    // The h1 comes first: both are nested inside it, not siblings of it.
    expect(html.indexOf(">Videos<")).toBeLessThan(html.indexOf(">Debate Rounds<"));
    expect(html.indexOf(">Debate Rounds<")).toBeLessThan(html.indexOf(">My Favorites<"));
  });

  it("keeps every video link on one level under Videos", () => {
    const html = renderSidebar();
    for (const title of ["Debate Rounds", "Strategy Lectures", "Greatest of All-Time", "My Favorites"]) {
      expect(html).toMatch(new RegExp(`<h2[^>]*>${title}</h2>`));
      expect(html).not.toMatch(new RegExp(`<span[^>]*>${title}</span>`));
    }
    // One expand control in the section — the Videos heading itself.
    expect(html).not.toContain("Collapse Debate Rounds");
    expect(html).not.toContain("Expand Debate Rounds");
  });

  it("lists exactly two library destinations, Debate Rounds then Strategy Lectures", () => {
    // The lecture categories live on the lectures page as a card bar; the
    // sidebar carries one Strategy Lectures link, right after Debate Rounds,
    // and no All Videos or per-format rows.
    const html = renderSidebar();
    expect(html).toMatch(/<h2[^>]*>Strategy Lectures<\/h2>/);
    expect(html).not.toMatch(/<h1[^>]*>Strategy Lectures<\/h1>/);
    expect(html).toMatch(/<a[^>]*href="\/lectures"/);
    expect(html).toMatch(/<a[^>]*href="\/videos\/rounds"/);
    expect(html.indexOf(">Debate Rounds<")).toBeLessThan(html.indexOf(">Strategy Lectures<"));
    expect(html.indexOf(">Strategy Lectures<")).toBeLessThan(html.indexOf(">Greatest of All-Time<"));
    for (const gone of ["All Videos", "All Lectures", "College Policy", "HS Policy", "HS Individual", "HS Forum"]) {
      expect(html).not.toContain(gone);
    }
  });

  it("renders Research / Debates as h1 sections", () => {
    const html = renderSidebar();
    for (const title of ["Debates", "Research"]) {
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
    for (const title of ["Videos", "Debates", "Research"]) {
      expect(html).toMatch(
        new RegExp(
          `<a[^>]*href="/[^"]*"[^>]*aria-expanded="(?:true|false)"[^>]*>(?:(?!</a>)[\\s\\S])*<h1[^>]*>${title}</h1>`,
        ),
      );
    }
  });

  it("opens only the section that holds the current route", () => {
    // `usePathname` is mocked to `/videos`, so Videos is the open section.
    const html = renderSidebar();
    expect(html).toMatch(
      /<a[^>]*aria-expanded="true"[^>]*>(?:(?!<\/a>)[\s\S])*<h1[^>]*>Videos<\/h1>/,
    );
    for (const title of ["Debates", "Research"]) {
      expect(html).toMatch(
        new RegExp(`<a[^>]*aria-expanded="true"[^>]*>(?:(?!</a>)[\\s\\S])*<h1[^>]*>${title}</h1>`),
      );
    }
    // Docs starts open too, expanded to its second level (`DocsNavTree`).
    expect(html).toMatch(/<a[^>]*aria-expanded="true"[^>]*>(?:(?!<\/a>)[\s\S])*<h1[^>]*>Learning<\/h1>/);
  });

  it("renders no Apps node restating the app dock", () => {
    // The dock itself is mounted directly above this tree (`dockSlot`), so
    // the node under it was the same five destinations a second time.
    const html = renderSidebar();
    expect(html).not.toContain(">Apps<");
    expect(html).not.toContain("All Tools");
    expect(html).not.toContain('href="/tools"');
  });

  it("renders every section's links, not just the route's", () => {
    // There is no accordion left to leave anything closed: sections all
    // start expanded and collapse independently, so one link from each is
    // mounted on arrival.
    const html = renderSidebar();
    expect(html).toContain("Coach Workspace");
    expect(html).toContain("Research Workspace");
    expect(html).toContain("Prep Workspace");
    // ...alongside the Videos node's own links, which were never in doubt.
    expect(html).toContain("Debate Rounds");
    expect(html).toContain("My Favorites");
  });

  it("prints all totals in k format in the tree", () => {
    // All counts now use k format consistently.
    const html = renderSidebar({ counts: { rounds: 1400, lectures: 1346 } });
    expect(html).toContain(">1.4k<");
    expect(html).toContain(">1.3k<");
    expect(html).not.toContain("1400");
  });

  it("lists Team & School Rank under Debates and the reference rows under Learning", () => {
    const html = renderSidebar();
    const inference = html.indexOf(">Debates<");
    const rank = html.indexOf("Team &amp; School Rank");
    const statistics = html.indexOf("Topics &amp; Statistics");
    const learning = html.indexOf(">Learning<");
    const rules = html.indexOf("Rules &amp; Glossary");
    const features = html.indexOf("Overview Home");
    expect(inference).toBeGreaterThan(-1);
    expect(rank).toBeGreaterThan(inference);
    expect(statistics).toBeGreaterThan(rank);
    expect(learning).toBeGreaterThan(statistics);
    expect(rules).toBeGreaterThan(learning);
    expect(features).toBeGreaterThan(rules);
    expect(html).toContain('href="/rank"');
    expect(html).toContain('href="/practice/rules"');
    expect(html).toContain('href="/practice/features"');
  });
});

describe("QuickLinksGrid", () => {
  it("renders both layouts without throwing and with usable image sources", () => {
    for (const layout of ["grid", "list"] as const) {
      const html = renderToStaticMarkup(
        createElement(QuickLinksGrid, {
          counts: { rounds: 4, lectures: 2 },
          activeId: "rounds",
          layout,
        }),
      );
      expect(html).toContain("Debate Rounds");
      expect(html).not.toContain('src="undefined"');
      for (const [, src] of html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)) {
        expect(src.length).toBeGreaterThan(0);
      }
    }
  });

  it("prints all counts in k format on every layout", () => {
    for (const layout of ["grid", "list"] as const) {
      const html = renderToStaticMarkup(
        createElement(QuickLinksGrid, {
          counts: { rounds: 1400, lectures: 1346 },
          layout,
        }),
      );
      expect(html).toContain(">1.4k<");
      expect(html).toContain(">1.3k<");
      expect(html).not.toContain("1400");
    }
  });
});
