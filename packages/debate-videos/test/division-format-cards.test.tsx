/**
 * @fileoverview The four format cards (College Policy, HS Policy, Individual,
 * Forum) lead every division page — `/videos/college`, `/videos/policy`,
 * `/videos/ld`, `/videos/pf` — and the round collection pages, with the
 * current division selected. The division pages also list the other formats
 * (Worlds, Demo Debates, Parli, Atlantic, Congress) under the cards. Pages that already carry the full category bar,
 * and the favorites and history views, do not repeat them.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) =>
    createElement("img", { src: typeof src === "string" ? src : (src as { src: string })?.src, alt }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    "aria-current": ariaCurrent,
  }: {
    href: string;
    children?: unknown;
    "aria-current"?: string;
  }) => createElement("a", { href, "aria-current": ariaCurrent }, children as never),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/videos",
  useParams: () => ({}),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const { LecturesVideoGridView } = await import("../src/panels/LecturesVideoGridView");

const noop = () => {};
const ref = { current: null };

const lectureCategories = [
  { key: "wsd", label: "WSD", count: 25, maxViews: 10 },
  { key: "acc", label: "ACC", count: 39, maxViews: 10 },
  { key: "demo_debates", label: "Demo Debates", count: 5, maxViews: 10 },
  { key: "negative_strategy", label: "Negative Strategy", count: 75, maxViews: 10 },
];

function render(overrides: Record<string, unknown>): string {
  const props = {
    searchTerm: "",
    sortOrder: "newest",
    selectedYear: "all",
    isSearchFocused: false,
    showThumbnails: true,
    viewMode: "list",
    showFavoritesOnly: false,
    stackedPlaylists: false,
    currentCategory: "lectures",
    totalVideos: 0,
    facets: null,
    searchSuggestions: { keywords: [], tournaments: [] },
    isLoading: false,
    errorMessage: "",
    isLoadingMore: false,
    currentVideos: [],
    favorites: new Set<string>(),
    hiddenVideos: new Set<string>(),
    topPicks: new Set<string>(),
    topics: undefined,
    lectureCategories,
    loadMoreTriggerRef: ref,
    videoContainerRef: ref,
    videosSectionRef: ref,
    quickLinkCounts: {},
    selectedCategory: "all",
    onSearchChange: noop,
    onSearchFocus: noop,
    onSearchBlur: noop,
    onClearSearch: noop,
    onSortChange: noop,
    onYearChange: noop,
    onToggleThumbnails: noop,
    onViewModeChange: noop,
    onToggleFavoritesOnly: noop,
    onToggleFavorite: noop,
    onHideVideo: noop,
    onUnhideVideo: noop,
    onStyleChange: noop,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(LecturesVideoGridView, props as never));
}


const CARD_HREFS = ["/videos/college", "/videos/policy", "/videos/ld", "/videos/pf"];

function sectionOf(html: string, title: string): string {
  const start = html.indexOf(`<section aria-label="${title}"`);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf("</section>", start));
}

function formatNav(html: string): string | null {
  const start = html.indexOf('<nav class="mb-6" aria-label="Debate formats">');
  if (start === -1) return null;
  return html.slice(start, html.indexOf("</nav>", start));
}

describe("format cards on division pages", () => {
  it.each([
    [4, "college"],
    [1, "policy"],
    [3, "ld"],
    [2, "pf"],
  ])("shows all four cards on style %i with %s selected", (style, id) => {
    const nav = formatNav(render({ selectedStyle: style, quickLinkCounts: { ld: 42 } }));
    expect(nav).not.toBeNull();
    for (const href of CARD_HREFS) expect(nav).toContain(`href="${href}"`);
    expect(nav!.match(/aria-current="page"/g)).toHaveLength(1);
    const selected = nav!.match(/<a href="([^"]+)" aria-current="page"/);
    expect(selected?.[1]).toBe(`/videos/${id}`);
    if (id === "ld") expect(nav).toContain(">42<");
  });

  it("shows the cards on round collection pages with none selected", () => {
    const nav = formatNav(render({ selectedCategory: "acc" }));
    expect(nav).not.toBeNull();
    for (const href of CARD_HREFS) expect(nav).toContain(`href="${href}"`);
    expect(nav).not.toContain("aria-current");
  });

  it("does not repeat the cards where the full category bar already has them", () => {
    const html = render({});
    expect(formatNav(html)).toBeNull();
    expect(html).toContain('aria-label="Lecture categories"');
    expect(html.match(/href="\/videos\/college"/g)?.length).toBeGreaterThan(0);
  });

  it("leaves favorites and history pages without the cards", () => {
    expect(formatNav(render({ selectedStyle: 3, showFavoritesOnly: true }))).toBeNull();
    expect(formatNav(render({ selectedStyle: 3, currentCategory: "history" }))).toBeNull();
  });

  describe("Formats list on division pages", () => {
    const FORMAT_HREFS = [
      "/lectures/wsd",
      "/lectures/demo_debates",
      "/videos/parli",
      "/videos/acc",
      "/videos/congress",
    ];
    const counts = { wsd: 25, acc: 39, parli: 15, congress: 7, ld: 42 };

    it.each([
      [4, "college"],
      [1, "policy"],
      [3, "ld"],
      [2, "pf"],
    ])("lists the other formats under the cards on style %i with none selected", (style, id) => {
      const nav = formatNav(render({ selectedStyle: style, quickLinkCounts: counts }))!;
      expect(nav).not.toBeNull();
      const formats = sectionOf(nav, "Formats");
      for (const href of FORMAT_HREFS) expect(formats).toContain(`href="${href}"`);
      expect(formats).not.toContain("aria-current");
      expect(nav).not.toContain('<section aria-label="Strategy"');
      expect(nav).not.toContain("Negative Strategy");
      expect(nav.match(/aria-current="page"/g)).toHaveLength(1);
      expect(nav.indexOf(`href="/videos/${id}" aria-current="page"`)).toBeGreaterThan(-1);
      expect(nav.indexOf('<section aria-label="Formats"')).toBeGreaterThan(nav.indexOf('href="/videos/pf"'));
    });

    it("shows each format's count", () => {
      const formats = sectionOf(formatNav(render({ selectedStyle: 3, quickLinkCounts: counts }))!, "Formats");
      for (const count of [25, 39, 15, 7]) expect(formats).toContain(`>${count}<`);
    });

    it("lists each format once, with no separate collection row on College Policy", () => {
      const html = render({ selectedStyle: 4, quickLinkCounts: counts });
      expect(html.match(/href="\/videos\/acc"/g)).toHaveLength(1);
      expect(html.match(/href="\/videos\/parli"/g)).toHaveLength(1);
    });

    it("keeps the round collection pages to just the cards", () => {
      const nav = formatNav(render({ selectedCategory: "acc", quickLinkCounts: counts }))!;
      expect(nav).not.toContain("<section");
    });

    it("falls back to just the cards before the categories load", () => {
      const nav = formatNav(render({ selectedStyle: 3, lectureCategories: [] }))!;
      expect(nav).not.toBeNull();
      expect(nav).not.toContain("<section");
    });

    it("leaves the division's own video list in place", () => {
      const html = render({ selectedStyle: 3, quickLinkCounts: counts, isLoading: true });
      expect(html).toContain("Loading videos...");
      expect(html.indexOf("Loading videos...")).toBeGreaterThan(html.indexOf('<section aria-label="Formats"'));
    });
  });
});
