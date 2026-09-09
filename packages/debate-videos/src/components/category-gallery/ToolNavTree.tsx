/**
 * @fileoverview The "Apps" + "Coaching / Research / Practice" + glossary/
 * rankings portion of the videos sidebar — the h1 sections that follow
 * "Videos" in the tree — factored out of `VideoSidebarTree` so it can also
 * render on the non-video tool pages those sections link to (`/coach`,
 * `/research`, `/practice-round`, etc.) — those
 * pages otherwise render no sidebar at all once you navigate off `/videos`,
 * which reads as the sidebar disappearing. `AppSidebarShell` (app-local)
 * mounts this on every page whose path matches one of the links below so the
 * nav stays visible everywhere it points to, not just on `/videos`.
 *
 * Each section heading is a grouping rather than a destination: it renders
 * without an `href`, so clicking it does nothing but toggle the section. Its
 * flagship tool is still reachable — it is also listed as the first link
 * inside the section.
 *
 * Every section starts expanded and they collapse independently: opening one
 * no longer closes the others. The tree is the only nav on the tool pages, and
 * an accordion meant that reaching a tool in another section was always two
 * clicks (open the section, then the link) with the list you were reading
 * disappearing in between. Collapsing is still per-section and sticky for the
 * session, so anyone who wants a short column can still have one.
 *
 * `sectionIds` narrows the tree to named sections and drops the Apps node and
 * the reference pair with it: the `/cards` sidebar is the document panels plus
 * the Research tools, so it asks for that one section rather than the whole
 * nav (see the app's `AppSidebarShell`).
 *
 * @module components/category-gallery/ToolNavTree
 */

"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { TreeItem } from "./TreeItem";
import type { TreeItemIcon } from "./tree-item-icon";
import {
  APP_DOCK_LINKS,
  SIDEBAR_TOOL_SECTIONS,
  TOOLS_ROOT_HREF,
  type SidebarToolSection,
} from "./sidebar-tool-sections";
import { APPS_SECTION_ID, sidebarSectionForPath } from "./sidebar-active-section";
import { toggleExpandedSection, withSectionExpanded } from "./sidebar-section-expansion";
import { VIDEO_REFERENCE_LINKS } from "./sidebar-video-links";
import { IconBook, IconLeaderboard } from "../../ui/icons";

/** Per-id artwork for the reference pair below the tree; the hrefs and
 *  titles come from `VIDEO_REFERENCE_LINKS`. */
const REFERENCE_ICONS: Record<string, TreeItemIcon> = {
  dictionary: IconBook,
  rankings: IconLeaderboard,
};

export interface ToolNavTreeProps {
  /**
   * Whether the sections start expanded. `true` (the sidebar's own default)
   * opens every one of them; the mobile mount below `md` passes `false`,
   * where the tree sits inline under the quick-link tiles and even one
   * expanded section would push the video grid off the screen.
   */
  defaultExpanded?: boolean;
  /**
   * Ids of the expanded sections, when a parent owns the expanded state.
   * `VideoSidebarTree` passes this so its own "Videos" node is toggled by the
   * same state these sections are.
   */
  expandedSectionIds?: readonly string[];
  /** Present together with {@link ToolNavTreeProps.expandedSectionIds}. */
  onToggleSection?: (sectionId: string) => void;
  /**
   * Render only these tool sections, in this order, instead of all of
   * {@link SIDEBAR_TOOL_SECTIONS}. It also drops the "Apps" node above the
   * sections and the glossary/rankings pair below them, so the tree is the
   * named sections and nothing else — the `/cards` sidebar passes
   * `[RESEARCH_SECTION_ID]` to be exactly the research tools next to its
   * document panels. Omit for the whole tree.
   */
  sectionIds?: readonly string[];
}

export function ToolNavTree({
  defaultExpanded = true,
  expandedSectionIds,
  onToggleSection,
  sectionIds,
}: ToolNavTreeProps = {}) {
  const pathname = usePathname();
  const isControlled = onToggleSection != null;

  const sections = React.useMemo(
    () =>
      sectionIds
        ? sectionIds
            .map((id) => SIDEBAR_TOOL_SECTIONS.find((section) => section.id === id))
            .filter((section): section is SidebarToolSection => section != null)
        : SIDEBAR_TOOL_SECTIONS,
    [sectionIds],
  );
  const showsWholeTree = sectionIds == null;

  // Every section the tree renders, Apps included — the expanded-by-default
  // set, and what "collapse all/expand all" would mean here.
  const allSectionIds = React.useMemo(
    () => (showsWholeTree ? [APPS_SECTION_ID, ...sections.map((s) => s.id)] : sections.map((s) => s.id)),
    [sections, showsWholeTree],
  );

  const [ownExpanded, setOwnExpanded] = useState<readonly string[]>(() =>
    defaultExpanded ? allSectionIds : [],
  );

  // The route's own section is opened on navigation even if it was collapsed
  // by hand, so following a link never lands you on a page whose section is
  // shut. Nothing else is closed — sections are independent now.
  const routeSectionId = sidebarSectionForPath(pathname);
  useEffect(() => {
    if (isControlled || !defaultExpanded || routeSectionId == null) return;
    setOwnExpanded((current) => withSectionExpanded(current, routeSectionId));
  }, [routeSectionId, isControlled, defaultExpanded]);

  const expanded = isControlled ? expandedSectionIds ?? [] : ownExpanded;
  const isExpanded = (id: string) => expanded.includes(id);

  const toggleSection = (id: string) => {
    if (isControlled) {
      onToggleSection?.(id);
      return;
    }
    setOwnExpanded((current) => toggleExpandedSection(current, id));
  };

  return (
    <>
      {showsWholeTree && (
        <TreeItem
          level={1}
          title="Apps"
          icon={LayoutGrid}
          // Plain click toggles; ctrl/shift/middle-click opens the catalog.
          sectionHref={TOOLS_ROOT_HREF}
          expanded={isExpanded(APPS_SECTION_ID)}
          onToggleExpand={() => toggleSection(APPS_SECTION_ID)}
        >
          {APP_DOCK_LINKS.map((link) => (
            <TreeItem
              key={link.href}
              level={3}
              href={link.href}
              title={link.title}
              isActive={pathname === link.href}
            />
          ))}
          {/* The tools catalog has no dock icon of its own (see
              `TOOLS_ROOT_HREF`), and the "Apps" heading above is a toggle
              rather than a link, so this is how the catalog is reached. */}
          <TreeItem
            level={3}
            href={TOOLS_ROOT_HREF}
            title="All Tools"
            isActive={pathname === TOOLS_ROOT_HREF}
          />
        </TreeItem>
      )}

      {sections.map((section) => (
        <TreeItem
          key={section.id}
          level={1}
          title={section.title}
          icon={section.icon}
          // `section.href` is the section's flagship tool — where a
          // ctrl/shift/middle-click on the heading goes.
          sectionHref={section.href}
          expanded={isExpanded(section.id)}
          onToggleExpand={() => toggleSection(section.id)}
        >
          {section.tools.map((tool) => (
            <TreeItem
              key={tool.href}
              level={3}
              href={tool.href}
              title={tool.title}
              isActive={pathname === tool.href}
            />
          ))}
        </TreeItem>
      ))}

      {showsWholeTree && (
        <div className="mt-1 flex flex-col gap-0.5 border-t border-border/60 pt-2">
          {VIDEO_REFERENCE_LINKS.map((link) => (
            <TreeItem
              key={link.id}
              level={3}
              href={link.href}
              title={link.title}
              icon={REFERENCE_ICONS[link.id]}
              isActive={pathname === link.href}
              muted
            />
          ))}
        </div>
      )}
    </>
  );
}
