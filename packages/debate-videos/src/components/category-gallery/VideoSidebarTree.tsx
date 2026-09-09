/**
 * @fileoverview Collapsible navigation tree shown in the persistent left
 * sidebar on the videos pages. Structure:
 *   Videos (h1, expandable, heading-only)
 *     -> College Debates (h2, expandable) -> Policy / PF / LD / Greatest of All-Time
 *     -> My Favorites (h2, plain link)
 *     -> Lectures (h2, expandable) -> lecture categories
 *   Apps / Coaching / Research / Practice (h1, expandable) -> tool links
 *     — this trailing portion is `ToolNavTree`, shared with the non-video
 *       tool pages those links point to (see `ToolNavTree`'s file comment).
 *
 * The h1 sections are groupings, not destinations: a plain click on one only
 * toggles it (a ctrl/shift/middle-click still opens its flagship page in a
 * new tab, via `TreeItem`'s `sectionHref`). They form one accordion — "Videos" and the
 * `ToolNavTree` sections together — so exactly one is open and a closed
 * section renders none of its links. The open one follows the route, which
 * is what makes clicking an app dock button load that destination's section
 * and nothing else (see `sidebar-active-section`).
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
  /** Whether the "Lectures" node is expanded. */
  lecturesExpanded: boolean;
  /** Toggles the "Lectures" node's expanded state. */
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
  // The whole tree is one accordion, "Videos" included: this component owns
  // which section is open and hands the same state down to `ToolNavTree`, so
  // opening a tool section closes Videos rather than stacking on top of it.
  const routeSectionId = sidebarSectionForPath(pathname);
  const [openSectionId, setOpenSectionId] = useState<string | null>(
    routeSectionId ?? VIDEOS_SECTION_ID,
  );
  const [collegeExpanded, setCollegeExpanded] = useState(true);

  useEffect(() => {
    setOpenSectionId(routeSectionId ?? VIDEOS_SECTION_ID);
  }, [routeSectionId]);

  const videosExpanded = openSectionId === VIDEOS_SECTION_ID;

  // Re-open the College Debates node if the user navigates straight to one
  // of its children (e.g. via URL) while it happens to be collapsed.
  useEffect(() => {
    if (activeId && COLLEGE_CHILD_IDS.includes(activeId)) {
      setCollegeExpanded(true);
      setOpenSectionId(VIDEOS_SECTION_ID);
    }
  }, [activeId]);

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

  return (
    <nav className="flex flex-col gap-3 text-sm" aria-label="Videos">
      <TreeItem
        level={1}
        title="Videos"
        icon={Clapperboard}
        // The heading toggles on a plain click; ctrl/shift/middle-click opens
        // the library itself, so every row in the tree can be opened in a new
        // tab rather than only the leaves.
        sectionHref="/videos"
        expanded={videosExpanded}
        onToggleExpand={() =>
          setOpenSectionId((current) => (current === VIDEOS_SECTION_ID ? null : VIDEOS_SECTION_ID))
        }
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

        <TreeItem
          level={2}
          href={SIDEBAR_VIDEO_LINKS_BY_ID.lectures.href}
          title={SIDEBAR_VIDEO_LINKS_BY_ID.lectures.title}
          count={counts?.lectures}
          isActive={activeId === "lectures"}
          expanded={lecturesExpanded}
          onToggleExpand={onToggleLectures}
          icon={IconLectures}
        >
          {lectureCategoryItems.map((item) => (
            <TreeItem
              key={item.id}
              level={3}
              href={buildLectureCategoryHref(item.id)}
              title={item.title}
              count={item.count}
              isActive={selectedCategory === item.id || (item.id === "all" && !selectedCategory)}
            />
          ))}
        </TreeItem>
      </TreeItem>

      <ToolNavTree openSectionId={openSectionId} onOpenSectionChange={setOpenSectionId} />
    </nav>
  );
}
