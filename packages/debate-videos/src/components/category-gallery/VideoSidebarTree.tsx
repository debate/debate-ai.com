/**
 * @fileoverview Collapsible navigation tree shown in the persistent left
 * sidebar on the videos pages. Structure:
 *   Videos (h1, expandable, heading-only)
 *     -> All Videos / Lectures / College Policy / Policy / PF / LD / Greatest
 *        of All-Time / My Favorites / Watch History (h2, plain links, all peers)
 *   Apps / Coaching / Research / Practice (h1, expandable) -> tool links
 *     — this trailing portion is `ToolNavTree`, shared with the non-video
 *       tool pages those links point to (see `ToolNavTree`'s file comment).
 *   Docs (h1, starts collapsed) -> every help docs page (`DocsNavTree`)
 *
 * The round-archive links are one flat list. Policy / PF / LD / Greatest of
 * All-Time used to hang inside College Policy, which read as if they were
 * subsets of it — they are sibling collections of the same library, and the
 * extra level only bought an indent and a second chevron to fight with.
 *
 * Lectures is a single row in that list. Its categories used to be a section
 * of their own here; they now live only on the lectures page itself, as a
 * bar of category cards above the grid (`LectureCategoryGridGallery`), so
 * the sidebar stays a short list of destinations. The Lectures row lights up
 * on every lecture-library page (`browsingLectures`), category pages
 * included.
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
  VIDEO_ALL_LINK,
  VIDEO_COLLEGE_LINK,
  VIDEO_FORMAT_LINKS,
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
   * Whether the page is browsing the lecture library (`/lectures` or one of
   * its categories). Lights the Lectures row even when `activeId` is unset,
   * as it is on a category page.
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

  const lecturesLink = SIDEBAR_VIDEO_LINKS_BY_ID.lectures;

  return (
    <nav className="flex flex-col gap-3 text-sm" aria-label="Videos">
      <TreeItem
        level={1}
        title="Videos"
        icon={Clapperboard}
        sectionHref={VIDEO_COLLEGE_LINK.href}
        expanded={videosExpanded}
        onToggleExpand={() => toggleSection(VIDEOS_SECTION_ID)}
      >
        <TreeItem
          key={VIDEO_ALL_LINK.id}
          level={2}
          href={VIDEO_ALL_LINK.href}
          title={VIDEO_ALL_LINK.title}
          icon={VIDEO_ALL_LINK.glyph}
          count={counts?.[VIDEO_ALL_LINK.id]}
          exactCount={VIDEO_ALL_LINK.exactCount}
          isActive={activeId === VIDEO_ALL_LINK.id}
        />

        <TreeItem
          level={2}
          href={lecturesLink.href}
          title={lecturesLink.title}
          icon={lecturesLink.glyph}
          count={counts?.lectures}
          isActive={activeId === "lectures" || browsingLectures}
        />

        {[VIDEO_COLLEGE_LINK, ...VIDEO_FORMAT_LINKS].map((link) => (
          <TreeItem
            key={link.id}
            level={2}
            href={link.href}
            title={link.title}
            icon={link.glyph}
            count={counts?.[link.id]}
            exactCount={link.exactCount}
            isActive={activeId === link.id}
          />
        ))}

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

        {(["wsd", "acc", "speech"] as const).map((id) => {
          const link = SIDEBAR_VIDEO_LINKS_BY_ID[id];
          return (
            <TreeItem
              key={link.id}
              level={2}
              href={link.href}
              title={link.title}
              icon={link.glyph}
              count={counts?.[link.id]}
              isActive={activeId === link.id}
            />
          );
        })}
      </TreeItem>

      <ToolNavTree expandedSectionIds={expandedSectionIds} onToggleSection={toggleSection} />

      {/* Every docs page, collapsed until opened; on /docs the docs layout
          portals its own tree in below the column instead. */}
      <DocsNavTree />
    </nav>
  );
}
