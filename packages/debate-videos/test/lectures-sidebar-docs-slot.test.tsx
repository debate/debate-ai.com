/**
 * @fileoverview Pins that the videos sidebar has a place for the app's REASON
 * document panels, and that it sits where the other tool routes put them.
 *
 * `/videos` renders its own sidebar rather than the app's `AppSidebarShell`,
 * and so was the one route with a sidebar but no files in it — the panels
 * simply had nowhere to mount. They arrive as a slot for the same reason the
 * dock does: they read app-level document state and route into
 * `/reason-editor`, neither of which this package can reach.
 *
 * Static markup is enough — the question is whether the slot is rendered, and
 * where in the column.
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

const noop = () => {};
const ref = { current: null };

function render(slots: { dockSlot?: ReactNode; docsSlot?: ReactNode }): string {
  return renderToStaticMarkup(
    createElement(LecturesVideoGridView, {
      searchTerm: "",
      sortOrder: "newest",
      selectedYear: "",
      isSearchFocused: false,
      showThumbnails: true,
      viewMode: "grid",
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
      ...slots,
    } as never),
  );
}

describe("the videos sidebar's docs slot", () => {
  it("renders the panels the page hands it", () => {
    const markup = render({ docsSlot: createElement("div", { id: "reason-docs" }, "Files") });
    expect(markup).toContain('id="reason-docs"');
  });

  it("puts them above the nav tree, as the other tool routes do", () => {
    // Below it they would start under the fold: the tree is long enough that
    // a section auto-expanding to show where you are pushes past the column.
    const markup = render({ docsSlot: createElement("div", { id: "reason-docs" }) });
    expect(markup.indexOf('id="reason-docs"')).toBeLessThan(markup.indexOf('href="/videos/college"'));
  });

  it("keeps them under the app dock", () => {
    const markup = render({
      dockSlot: createElement("div", { id: "app-dock" }),
      docsSlot: createElement("div", { id: "reason-docs" }),
    });
    expect(markup.indexOf('id="app-dock"')).toBeLessThan(markup.indexOf('id="reason-docs"'));
  });

  it("renders the sidebar unchanged when no panels are supplied", () => {
    // The leaderboard and dictionary branches pass neither slot.
    expect(() => render({})).not.toThrow();
    expect(render({})).toContain('href="/videos/college"');
  });
});
