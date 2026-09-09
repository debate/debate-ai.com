/**
 * @fileoverview Collapsible navigation tree shown in the persistent left
 * sidebar on the videos pages. Structure:
 *   Round Videos (h1, expandable, heading-only)
 *     -> College Debates (h2, expandable) -> Policy / PF / LD / Greatest of All-Time
 *     -> My Favorites (h2, plain link)
 *   Lectures (h1, expandable, heading-only) -> lecture categories (h2)
 *   Apps / Coaching / Research / Practice (h1, expandable) -> tool links
 *     — this trailing portion is `ToolNavTree`, shared with the non-video
 *       tool pages those links point to (see `ToolNavTree`'s file comment).
 *
 * Lectures is a top-level section rather than a node inside the video tree:
 * the two libraries are peers — rounds recorded at tournaments on one side,
 * teaching videos on the other — and burying one two levels inside the other
 * made the lecture categories read as a sub-filter of the round archive.
 *
 * The h1 sections are groupings, not destinations: a plain click on one only
 * toggles it (a ctrl/shift/middle-click still opens its flagship page in a
 * new tab, via `TreeItem`'s `sectionHref`). "Round Videos" and the
 * `ToolNavTree` sections form one accordion — exactly one is open and a
 * closed section renders none of its links. The open one follows the route,
 * which is what makes clicking an app dock button load that destination's
 * section and nothing else (see `sidebar-active-section`). Lectures sits
 * outside that accordion: its expanded state is the page's own
 * `showLectureCategories`, the same flag that shows the category gallery
 * above the grid, so the sidebar and the page agree on whether you are
 * browsing lectures.
 */

"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { IconTrophy, IconLectures } from "../../ui/icons";
import type { LectureCategoryFacet } from "../../types/videos";
import { TreeItem } from "./TreeItem";
import { ToolNavTree } from "./ToolNavTree";
import {
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

const COLLEGE_CHILD_IDS = VIDEO_FORMAT_LINKS.map((link) => link.id);

interface VideoSidebarTreeProps {
  /** Per-category video counts, keyed by quick-link id. */
  counts?: Record<string, number>;
  /** Lecture category facets (label, slug, count) from `/api/videos/meta`. */
  lectureCategories: LectureCategoryFacet[];
  /** Slug of the lecture category currently being browsed, or `"all"`. */
  selectedCategory?: string;
  /** Id of the currently active nav item, used for highlighting. */
  activeId?: string;
  /** Whether the "Lectures" section is expanded. */
  lecturesExpanded: boolean;
  /** Toggles the "Lectures" section's expanded state. */
  onToggleLectures: () => void;
}

export function VideoSidebarTree({
  counts,
  lectureCategories,
  selectedCategory,
  activeId,
  lecturesExpanded,
  onToggleLectures,
}: VideoSidebarTreeProps) {
  const pathname = usePathname();
  // "Round Videos" and the tool sections are one accordion: this component
  // owns which of them is open and hands the same state down to `ToolNavTree`,
  // so opening a tool section closes Round Videos rather than stacking on top
  // of it. Lectures is not part of it — see the file comment.
  const routeSectionId = sidebarSectionForPath(pathname);
  const [expandedSectionIds, setExpandedSectionIds] =
    useState<readonly string[]>(ALL_SIDEBAR_SECTION_IDS);
  const [collegeExpanded, setCollegeExpanded] = useState(true);

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

  // Re-open the College Debates node if the user navigates straight to one
  // of its children (e.g. via URL) while it happens to be collapsed.
  useEffect(() => {
    if (activeId && COLLEGE_CHILD_IDS.includes(activeId)) {
      setCollegeExpanded(true);
      expandSection(VIDEOS_SECTION_ID);
    }
  }, [activeId, expandSection]);

  const lectureCategoryItems = React.useMemo(() => {
    if (lectureCategories.length === 0) return [];
    const totalCount = lectureCategories.reduce((sum, c) => sum + c.count, 0);
    return [
      { id: "all", title: "All Lectures", count: totalCount },
      ...lectureCategories.map((c) => ({ id: c.key, title: c.label, count: c.count })),
    ];
  }, [lectureCategories]);

  const buildLectureCategoryHref = (categoryId: string) => {
    if (categoryId === "all") return "/videos";
    const isSame = selectedCategory === categoryId;
    return isSame ? "/videos" : `/videos/${encodeURIComponent(categoryId)}`;
  };

  const lecturesLink = SIDEBAR_VIDEO_LINKS_BY_ID.lectures;
  const lecturesActive = activeId === "lectures";

  return (
    <nav className="flex flex-col gap-3 text-sm" aria-label="Videos">
      <TreeItem
        level={1}
        title="Round Videos"
        icon={Clapperboard}
        // The heading toggles on a plain click; ctrl/shift/middle-click opens
        // the library itself, so every row in the tree can be opened in a new
        // tab rather than only the leaves. `/videos` is the lectures view, so
        // the round archive's own flagship is College Debates.
        sectionHref={VIDEO_COLLEGE_LINK.href}
        expanded={videosExpanded}
        onToggleExpand={() => toggleSection(VIDEOS_SECTION_ID)}
      >
        <TreeItem
          level={2}
          href={VIDEO_COLLEGE_LINK.href}
          title={VIDEO_COLLEGE_LINK.title}
          count={counts?.[VIDEO_COLLEGE_LINK.id]}
          isActive={activeId === VIDEO_COLLEGE_LINK.id}
          expanded={collegeExpanded}
          onToggleExpand={() => setCollegeExpanded((v) => !v)}
        >
          {VIDEO_FORMAT_LINKS.map((link) => (
            <TreeItem
              key={link.id}
              level={3}
              href={link.href}
              title={link.title}
              count={counts?.[link.id]}
              isActive={activeId === link.id}
            />
          ))}
        </TreeItem>

        <TreeItem
          level={2}
          href={SIDEBAR_VIDEO_LINKS_BY_ID.favorites.href}
          title={SIDEBAR_VIDEO_LINKS_BY_ID.favorites.title}
          count={counts?.favorites}
          isActive={activeId === "favorites"}
          icon={IconTrophy}
        />
      </TreeItem>

      {lectureCategoryItems.length > 0 ? (
        <TreeItem
          level={1}
          title={lecturesLink.title}
          icon={IconLectures}
          // Same deal as the Round Videos heading: a plain click toggles the
          // section, a modifier click opens the lecture library itself.
          sectionHref={lecturesLink.href}
          count={counts?.lectures}
          isActive={lecturesActive}
          expanded={lecturesExpanded}
          onToggleExpand={onToggleLectures}
        >
          {lectureCategoryItems.map((item) => (
            <TreeItem
              key={item.id}
              level={2}
              href={buildLectureCategoryHref(item.id)}
              title={item.title}
              count={item.count}
              isActive={selectedCategory === item.id || (item.id === "all" && !selectedCategory)}
            />
          ))}
        </TreeItem>
      ) : (
        // No categories to expand into (they arrive with `/api/videos/meta`).
        // A heading-only row would toggle nothing and read as a dead click, so
        // the section is a plain link until its children exist.
        <TreeItem
          level={1}
          href={lecturesLink.href}
          title={lecturesLink.title}
          icon={IconLectures}
          count={counts?.lectures}
          isActive={lecturesActive}
        />
      )}

      <ToolNavTree expandedSectionIds={expandedSectionIds} onToggleSection={toggleSection} />
    </nav>
  );
}
