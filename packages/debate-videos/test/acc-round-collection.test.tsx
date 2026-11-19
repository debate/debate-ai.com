/**
 * @fileoverview ACC (the ACC Debate Tournament's rounds) is a collection of
 * debate rounds, not a lecture category: its listing uses the round rows
 * (Aff / Neg columns) instead of the lecture table, and it gets no card in the
 * lecture category bar.
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
  usePathname: () => "/videos/acc",
  useParams: () => ({ category: "acc" }),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const { LecturesVideoGridView } = await import("../src/panels/LecturesVideoGridView");

const noop = () => {};
const ref = { current: null };

/** A 2025 ACC Debate Tournament round, in the feed's tuple shape. */
const accRound = [
  "acc1", "2025 ACC Debate Tournament Final Round - SMU vs Wake Forest", "2025-04-19",
  "Debate Stream", 100, "", 4, "ACC Debate Tournament", "Final", "SMU", "Wake Forest",
];

const lectureCategories = [
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

describe("the ACC collection", () => {
  it("lists as debate rounds, with Aff and Neg columns, not the lecture table", () => {
    const html = render({ selectedCategory: "acc", currentVideos: [accRound], totalVideos: 1 });
    expect(html).toContain(">Aff<");
    expect(html).toContain(">Neg<");
    expect(html).not.toContain(">Library<");
    // Not a lecture category, so no lecture category bar above it.
    expect(html).not.toContain('aria-label="Lecture categories"');
  });

  it("is left out of the lecture category bar", () => {
    const html = render({ viewMode: "grid" });
    expect(html).toContain('aria-label="Lecture categories"');
    expect(html).toContain("Demo Debates");
    expect(html).not.toContain("/lectures/acc");
    expect(html).not.toContain('href="/videos/acc"');
  });
});
