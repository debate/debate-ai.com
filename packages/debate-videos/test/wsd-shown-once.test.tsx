/**
 * @fileoverview On All Videos the lecture category bar and the collection
 * row sit one above the other. A collection that already has a lecture
 * category card (WSD) shows once, in the category bar.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) =>
    createElement("img", { src: typeof src === "string" ? src : (src as { src: string })?.src, alt }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: unknown }) => createElement("a", { href }, children as never),
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

describe("WSD on All Videos", () => {
  it("shows once, as its lecture category card", () => {
    const html = render({ viewMode: "grid" });
    expect(html).toContain('aria-label="Lecture categories"');
    expect(html.match(/>Worlds</g)?.length).toBe(1);
    expect(html).toContain('href="/lectures/wsd"');
    expect(html).not.toContain('href="/videos/wsd"');
    // Collections without a lecture card keep theirs.
    expect(html).toContain('href="/videos/acc"');
  });
});
