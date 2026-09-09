/**
 * @fileoverview Pins what the videos sidebar holds: the app dock the page
 * hands it, and the video library's own nav — and nothing else.
 *
 * `/videos` renders this sidebar rather than the app's `AppSidebarShell`. It
 * used to take a second app-owned slot for the REASON document panels
 * (`docsSlot`), which put a file tree above the video nav on a page that is
 * not about documents; those panels now mount only on the routes they are the
 * subject of (`apps/debate-ai.com/lib/reason-docs/sidebar-routes.ts`), so the
 * slot is gone.
 *
 * Static markup is enough — the question is what the column renders, and in
 * what order.
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

function render(slots: { dockSlot?: ReactNode }): string {
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

describe("the videos sidebar", () => {
  it("renders the dock the page hands it, above the video nav", () => {
    const markup = render({ dockSlot: createElement("div", { id: "app-dock" }) });
    expect(markup).toContain('id="app-dock"');
    expect(markup.indexOf('id="app-dock"')).toBeLessThan(markup.indexOf('href="/videos/college"'));
  });

  it("renders the video nav with no app document panels above it", () => {
    // The dock is the only app-owned slot left: the REASON file tree / topic
    // starters / open tabs belong to `/cards` and `/reason-editor` now, and a
    // page with no `docsSlot` to pass is what keeps them off this sidebar.
    const markup = render({});
    expect(markup).toContain('href="/videos/college"');
    for (const label of ["Topic Starters", "Open Tabs"]) {
      expect(markup).not.toContain(label);
    }
  });

  it("renders without a dock too", () => {
    // The leaderboard and dictionary branches pass no slots at all.
    expect(() => render({})).not.toThrow();
  });
});

describe("the mobile block below md", () => {
  /** The `md:hidden` column, which is what a phone actually sees. */
  function mobileMarkup(): string {
    const markup = render({});
    const start = markup.indexOf('class="md:hidden"');
    expect(start).toBeGreaterThan(-1);
    // Up to the video grid that follows the block.
    const end = markup.indexOf('class="scroll-mt-20"', start);
    return markup.slice(start, end === -1 ? undefined : end);
  }

  it("carries the tool sections the sidebar shows", () => {
    // The quick-link tiles cover the tree's Videos section only; without the
    // tool nav below them, Apps / Coaching / Research / Practice had no
    // counterpart on a phone anywhere on this page.
    const mobile = mobileMarkup();
    for (const heading of ["Apps", "Coaching", "Research", "Practice"]) {
      expect(mobile).toMatch(new RegExp(`<h1[^>]*>${heading}</h1>`));
    }
  });

  it("starts those sections collapsed so the grid stays in view", () => {
    const mobile = mobileMarkup();
    for (const heading of ["Apps", "Coaching", "Research", "Practice"]) {
      expect(mobile).toMatch(
        new RegExp(`<button[^>]*aria-expanded="false"[^>]*>(?:(?!</button>)[\\s\\S])*<h1[^>]*>${heading}</h1>`),
      );
    }
  });

  it("still reaches the glossary and rankings pair", () => {
    const mobile = mobileMarkup();
    expect(mobile).toContain('href="/videos/dictionary"');
    expect(mobile).toContain('href="/videos/rankings"');
  });
});
