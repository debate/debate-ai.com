/**
 * @fileoverview Collapsible navigation tree shown in the persistent left
 * sidebar on the videos pages. Structure:
 *   Videos (h1 section label)
 *     College Debates (h2, expandable) -> Policy / PF / LD / Greatest of All-Time
 *   Favorites (h1, plain link)
 *   Lectures (h1, expandable) -> lecture categories (h2)
 */

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image, { StaticImageData } from "next/image";
import { ChevronRight } from "lucide-react";
import { cn } from "../../ui/lib/utils";
import { IconTrophy, IconLectures, IconBook, IconLeaderboard } from "../../ui/icons";
import type { LectureCategoryFacet } from "../../types/videos";

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

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
        <h1 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Videos
        </h1>
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
        level={1}
        href="/videos/favorites"
        title="Favorites"
        count={counts?.favorites}
        isActive={activeId === "favorites"}
        icon={IconTrophy}
      />

      <TreeItem
        level={1}
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
            level={2}
            href={buildLectureCategoryHref(item.id)}
            title={item.title}
            count={item.count}
            isActive={selectedCategory === item.id || (item.id === "all" && !selectedCategory)}
          />
        ))}
      </TreeItem>

      <div className="mt-1 flex flex-col gap-0.5 border-t border-border/60 pt-2">
        <TreeItem level={3} href="/videos/dictionary" title="Glossary of Terms" icon={IconBook} muted />
        <TreeItem level={3} href="/videos/rankings" title="Rankings" icon={IconLeaderboard} muted />
      </div>
    </nav>
  );
}

interface TreeItemProps {
  /** Heading level: 1 = top-level section (Videos/Favorites/Lectures), 2 = expandable subgroup or lecture category, 3 = leaf child. */
  level: 1 | 2 | 3;
  href: string;
  title: string;
  count?: number;
  isActive?: boolean;
  icon?: string | StaticImageData;
  /** Present together with `onToggleExpand` to make this item expandable. */
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** De-emphasizes leaf items (used for the Glossary/Rankings links). */
  muted?: boolean;
  children?: React.ReactNode;
}

function TreeItem({ level, href, title, count, isActive, icon, expanded, onToggleExpand, muted, children }: TreeItemProps) {
  const expandable = children != null && onToggleExpand != null;
  const Heading = level === 1 ? "h1" : level === 2 ? "h2" : "span";

  return (
    <div>
      <div
        className={cn(
          "flex items-stretch gap-0.5 rounded-md",
          isActive && "bg-primary/5 ring-1 ring-primary/40",
        )}
      >
        <Link
          href={href}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-2 transition-colors hover:bg-muted/60",
            level === 3 ? "pl-7" : "pl-2",
          )}
        >
          {icon && <Image src={icon} alt="" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" unoptimized />}
          <Heading
            className={cn(
              "min-w-0 flex-1 truncate",
              level === 1 && "font-semibold text-foreground",
              level === 2 && "font-medium text-foreground",
              level === 3 && (muted ? "text-xs text-muted-foreground" : "text-sm text-foreground"),
              isActive && "text-primary",
            )}
          >
            {title}
          </Heading>
          {count != null && count > 0 && (
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatCount(count)}</span>
          )}
        </Link>
        {expandable && (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
            className="flex w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        )}
      </div>
      {expandable && expanded && (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {React.Children.map(children, (child) => (
            <li className="list-none">{child}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
