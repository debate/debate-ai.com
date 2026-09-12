/**
 * @fileoverview Pins the two things that decide what the video library looks
 * like before anyone touches a control: the search and filter bar lives over
 * the results panel rather than in the sidebar, and results open as rows.
 *
 * Static markup answers the first — the question is only which column the
 * search input renders in. The second is read off a probe component, since
 * the default is the hook's initial state.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/videos",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) =>
    createElement("img", { src: typeof src === "string" ? src : (src as { src: string }).src, alt }),
}));

const { LecturesVideoGridView } = await import("../src/panels/LecturesVideoGridView");
const { useVideoState } = await import("../src/hooks/useVideoState");

const noop = () => {};
const ref = { current: null };

function renderGrid(): string {
  return renderToStaticMarkup(
    createElement(LecturesVideoGridView, {
      searchTerm: "",
      sortOrder: "newest",
      selectedYear: "",
      isSearchFocused: false,
      showThumbnails: true,
      viewMode: "list",
      showFavoritesOnly: false,
      currentCategory: "lectures",
      totalVideos: 0,
      facets: null,
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
      showLectureCategories: false,
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
      onToggleLectureCategories: noop,
      onToggleFavorite: noop,
      onHideVideo: noop,
      onUnhideVideo: noop,
      onStatsModalOpenChange: noop,
      onStyleChange: noop,
    } as never),
  );
}

describe("the search and filter controls", () => {
  it("render over the results panel, not inside the sidebar", () => {
    const markup = renderGrid();
    const asideEnd = markup.indexOf("</aside>");
    const searchInput = markup.indexOf('placeholder="Search..."');

    expect(asideEnd).toBeGreaterThan(-1);
    expect(searchInput).toBeGreaterThan(-1);
    // Everything before `</aside>` is the sidebar column.
    expect(searchInput).toBeGreaterThan(asideEnd);
  });

  it("collapse to one trigger, shared by desktop and mobile", () => {
    const markup = renderGrid();
    // Two instances is what the sidebar + mobile `StickyHeader` pair used to
    // render, and what made the search term appear to reset when the viewport
    // crossed `md`.
    expect(markup.split("data-floating-search-trigger").length - 1).toBe(1);
    expect(markup.split('placeholder="Search..."').length - 1).toBe(1);
  });

  it("start collapsed, with the panel hidden rather than unmounted", () => {
    const markup = renderGrid();
    expect(markup).toContain('aria-expanded="false"');
    // Kept in the DOM so the input holds its value across a hover-out.
    expect(markup).toContain('placeholder="Search..."');
  });
});

describe("the default results layout", () => {
  it("is rows", () => {
    function Probe() {
      const { state } = useVideoState("lectures");
      return createElement("span", null, state.viewMode);
    }
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>list</span>");
  });
});
