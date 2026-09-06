/**
 * @fileoverview Collapsible navigation tree shown in the persistent left
 * sidebar on the videos pages. Structure:
 *   College Debates (h2, expandable) -> Policy / PF / LD / Greatest of All-Time
 *   Favorites (h2, plain link)
 *   Lectures (h2, expandable) -> lecture categories (h3)
 *   Apps / Coaching / Research / Practice (h2, expandable) -> tool links (h3)
 *     — this trailing portion is `ToolNavTree`, shared with the non-video
 *       tool pages those links point to (see `ToolNavTree`'s file comment).
 */

"use client";

import React, { useEffect, useState } from "react";
import { IconTrophy, IconLectures } from "../../ui/icons";
import type { LectureCategoryFacet } from "../../types/videos";
import { TreeItem } from "./TreeItem";
import { ToolNavTree } from "./ToolNavTree";

const COLLEGE_CHILD_IDS = ["policy", "pf", "ld", "topPicks"];

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
  const [collegeExpanded, setCollegeExpanded] = useState(true);

  // Re-open the College Debates node if the user navigates straight to one
  // of its children (e.g. via URL) while it happens to be collapsed.
  useEffect(() => {
    if (activeId && COLLEGE_CHILD_IDS.includes(activeId)) {
      setCollegeExpanded(true);
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
      <div>
        <TreeItem
          level={2}
          href="/videos/college"
          title="College Debates"
          count={counts?.college}
          isActive={activeId === "college"}
          expanded={collegeExpanded}
          onToggleExpand={() => setCollegeExpanded((v) => !v)}
        >
          <TreeItem level={3} href="/videos/policy" title="Policy Debates" count={counts?.policy} isActive={activeId === "policy"} />
          <TreeItem level={3} href="/videos/pf" title="PF Debates" count={counts?.pf} isActive={activeId === "pf"} />
          <TreeItem level={3} href="/videos/ld" title="LD Debates" count={counts?.ld} isActive={activeId === "ld"} />
          <TreeItem level={3} href="/videos/topPicks" title="Greatest of All-Time" isActive={activeId === "topPicks"} />
        </TreeItem>
      </div>

      <TreeItem
        level={2}
        href="/videos/favorites"
        title="Favorites"
        count={counts?.favorites}
        isActive={activeId === "favorites"}
        icon={IconTrophy}
      />

      <TreeItem
        level={2}
        href="/videos/lectures"
        title="Lectures"
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

      <ToolNavTree />
    </nav>
  );
}
