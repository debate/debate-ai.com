/**
 * @fileoverview Collapsible navigation tree shown in the persistent left
 * sidebar on the videos pages. Structure:
 *   Videos (h1, expandable, heading-only)
 *     -> Debate Rounds / Strategy Lectures / Greatest of All-Time /
 *        My Favorites / Watch History (h2, plain links, all peers)
 *   Apps / Coaching / Research / Practice (h1, expandable) -> tool links
 *     — this trailing portion is `ToolNavTree`, shared with the non-video
 *       tool pages those links point to (see `ToolNavTree`'s file comment).
 *   Docs (h1, starts collapsed) -> every help docs page (`DocsNavTree`)
 *
 * Debate Rounds is every format's round videos in one listing, with the
 * lecture library's Formats section (Worlds, NSDA Speech, Parli …) on its
 * page; Strategy Lectures is the rest of the lecture library. The per-format
 * round pages (`/videos/college`, `/policy`, `/ld`, `/pf`) have no row of
 * their own but still render, and light up Debate Rounds. Lecture categories
 * live only on the lectures page itself, as a bar of category cards
 * (`LectureCategoryGridGallery`). The Strategy Lectures row lights up on the
 * lecture-library pages outside the Formats section (`browsingLectures`).
 *
 * The h1 sections are groupings, not destinations: a plain click on one only
 * toggles it (a ctrl/shift/middle-click still opens its flagship page in a
 * new tab, via `TreeItem`'s `sectionHref`). "Videos" and the `ToolNavTree`
 * sections form one accordion — exactly one is open and a closed section
 * renders none of its links. The open one follows the route, which is what
 * makes clicking an app dock button load that destination's section and
 * nothing else (see `sidebar-active-section`).
 *
 * Every row draws a plain gray Lucide glyph.
 */

"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Clapperboard, History } from "lucide-react";
import { TreeItem } from "./TreeItem";
import { ToolNavTree } from "./ToolNavTree";
import { DocsNavTree } from "./DocsNavTree";
import {
  VIDEO_ROUNDS_LINK,
  VIDEO_STRATEGY_LECTURES_LINK,
  VIDEO_GOAT_LINK,
  SIDEBAR_VIDEO_LINKS_BY_ID,
} from "./sidebar-video-links";
import { VIDEOS_SECTION_ID, sidebarSectionForPath } from "./sidebar-active-section";
import {
  ALL_SIDEBAR_SECTION_IDS,
  toggleExpandedSection,
  withSectionExpanded,
} from "./sidebar-section-expansion";

interface VideoSidebarTreeProps {
  /** Per-category video counts, keyed by quick-link id. */
  counts?: Record<string, number>;
  /**
   * Whether the page is browsing the lecture library outside its Formats
   * section (`/lectures` or one of its other categories). Lights the Strategy
   * Lectures row even when `activeId` is unset, as it is on a category page.
   */
  browsingLectures?: boolean;
  /** Id of the currently active nav item, used for highlighting. */
  activeId?: string;
}

export function VideoSidebarTree({
  counts,
  browsingLectures = false,
  activeId,
}: VideoSidebarTreeProps) {
  const pathname = usePathname();
  // "Videos" and the tool sections are one accordion: this component owns
  // which of them is open and hands the same state down to `ToolNavTree`, so
  // opening a tool section closes Videos rather than stacking on top of it.
  const routeSectionId = sidebarSectionForPath(pathname);
  const [expandedSectionIds, setExpandedSectionIds] =
    useState<readonly string[]>(ALL_SIDEBAR_SECTION_IDS);

  const expandSection = React.useCallback((sectionId: string) => {
    setExpandedSectionIds((current) => withSectionExpanded(current, sectionId));
  }, []);

  const toggleSection = React.useCallback((sectionId: string) => {
    setExpandedSectionIds((current) => toggleExpandedSection(current, sectionId));
  }, []);

  // Re-open the section holding the route on navigation — nothing else closes.
  useEffect(() => {
    if (routeSectionId == null) return;
    expandSection(routeSectionId);
  }, [routeSectionId, expandSection]);

  const videosExpanded = expandedSectionIds.includes(VIDEOS_SECTION_ID);

  return (
    <nav className="flex flex-col gap-3 text-sm" aria-label="Videos">
      <TreeItem
        level={1}
        title="Videos"
        icon={Clapperboard}
        sectionHref={VIDEO_ROUNDS_LINK.href}
        expanded={videosExpanded}
        onToggleExpand={() => toggleSection(VIDEOS_SECTION_ID)}
      >
        <TreeItem
          level={2}
          href={VIDEO_ROUNDS_LINK.href}
          title={VIDEO_ROUNDS_LINK.title}
          icon={VIDEO_ROUNDS_LINK.glyph}
          count={counts?.[VIDEO_ROUNDS_LINK.id]}
          exactCount={VIDEO_ROUNDS_LINK.exactCount}
          isActive={activeId === VIDEO_ROUNDS_LINK.id}
        />

        <TreeItem
          level={2}
          href={VIDEO_STRATEGY_LECTURES_LINK.href}
          title={VIDEO_STRATEGY_LECTURES_LINK.title}
          icon={VIDEO_STRATEGY_LECTURES_LINK.glyph}
          count={counts?.[VIDEO_STRATEGY_LECTURES_LINK.id]}
          isActive={activeId === VIDEO_STRATEGY_LECTURES_LINK.id || browsingLectures}
        />

        <TreeItem
          level={2}
          href={VIDEO_GOAT_LINK.href}
          title={VIDEO_GOAT_LINK.title}
          icon={VIDEO_GOAT_LINK.glyph}
          count={counts?.[VIDEO_GOAT_LINK.id]}
          isActive={activeId === VIDEO_GOAT_LINK.id}
        />

        <TreeItem
          level={2}
          href={SIDEBAR_VIDEO_LINKS_BY_ID.favorites.href}
          title={SIDEBAR_VIDEO_LINKS_BY_ID.favorites.title}
          count={counts?.favorites}
          isActive={activeId === "favorites"}
          icon={SIDEBAR_VIDEO_LINKS_BY_ID.favorites.glyph}
        />

        <TreeItem
          level={2}
          href={SIDEBAR_VIDEO_LINKS_BY_ID.history.href}
          title={SIDEBAR_VIDEO_LINKS_BY_ID.history.title}
          count={counts?.history}
          isActive={activeId === "history"}
          icon={History}
        />

      </TreeItem>

      <ToolNavTree expandedSectionIds={expandedSectionIds} onToggleSection={toggleSection} />

      {/* Every docs page, collapsed until opened; on /docs the docs layout
          portals its own tree in below the column instead. */}
      <DocsNavTree />
    </nav>
  );
}
