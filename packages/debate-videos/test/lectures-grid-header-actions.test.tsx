/**
 * @fileoverview The video grid renders host-supplied header actions (the app's
 * account-sync badge / Save now) beside the search bar, and renders nothing
 * extra when the host passes none.
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

// The rankings adapter re-exports a git submodule that is absent from some
// checkouts; the grid view never touches it, so stub it out.
vi.mock("@debate/rankings-adapter", () => ({
  RANKING_DATASETS: [],
  loadRankingDataset: async () => null,
  normalizeSchool: (name: string) => name,
}));

const { LecturesVideoGridView } = await import("../src/panels/LecturesVideoGridView");

const noop = () => {};
const ref = { current: null };

function render(headerActionsSlot?: React.ReactNode): string {
  const props = {
    searchTerm: "",
    sortOrder: "newest",
    selectedYear: "all",
    isSearchFocused: false,
    showThumbnails: true,
    viewMode: "grid",
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
    lectureCategories: [],
    loadMoreTriggerRef: ref,
    videoContainerRef: ref,
    videosSectionRef: ref,
    quickLinkCounts: {},
    showLectureCategories: false,
    selectedCategory: "all",
    youtubeStats: null,
    statsModalOpen: false,
    onSearchChange: noop,
    onSearchFocus: noop,
    onSearchBlur: noop,
    onClearSearch: noop,
    onSortChange: noop,
    onYearChange: noop,
    onToggleThumbnails: noop,
    onViewModeChange: noop,
    onToggleFavoritesOnly: noop,
    onToggleStackedPlaylists: noop,
    onToggleLectureCategories: noop,
    onToggleFavorite: noop,
    onHideVideo: noop,
    onUnhideVideo: noop,
    onStatsModalOpenChange: noop,
    onStyleChange: noop,
    headerActionsSlot,
  };
  return renderToStaticMarkup(createElement(LecturesVideoGridView, props as never));
}

describe("LecturesVideoGridView headerActionsSlot", () => {
  it("renders the host's header actions", () => {
    expect(render(createElement("span", { "data-testid": "sync-badge" }, "Saved"))).toContain('data-testid="sync-badge"');
  });

  it("renders without header actions", () => {
    expect(render()).not.toContain("sync-badge");
  });
});
