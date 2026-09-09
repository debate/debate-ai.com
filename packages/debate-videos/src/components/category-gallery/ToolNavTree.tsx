/**
 * @fileoverview The "Coaching / Research / Practice" portion of the videos
 * sidebar — the h1 sections that follow "Round Videos" and "Lectures" in the
 * tree — factored out of `VideoSidebarTree` so it can also render on the
 * non-video tool pages those sections link to (`/coach`, `/research`,
 * `/practice-round`, etc.) — those pages otherwise render no sidebar at all
 * once you navigate off `/videos`, which reads as the sidebar disappearing.
 * `AppSidebarShell` (app-local) mounts this on every page whose path matches
 * one of the links below so the nav stays visible everywhere it points to,
 * not just on `/videos`.
 *
 * There is no "Apps" node above the sections any more: it was the app dock's
 * own five icons spelled out as text immediately below the dock, so the
 * column said everything twice. The dock is still right there, and its
 * Settings menu still carries the same list for phones.
 *
 * The glossary/rankings pair used to hang below the tree, outside every
 * section. It now sits at the end of Practice, which is where the rest of the
 * round-day reference material lives.
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
 * `sectionIds` narrows the tree to named sections: the `/cards` sidebar is
 * the document panels plus the Research tools, so it asks for that one
 * section rather than the whole nav (see the app's `AppSidebarShell`).
 *
 * @module components/category-gallery/ToolNavTree
 */

"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TreeItem } from "./TreeItem";
import type { TreeItemIcon } from "./tree-item-icon";
import {
  PRACTICE_SECTION_ID,
  SIDEBAR_TOOL_SECTIONS,
  type SidebarToolSection,
} from "./sidebar-tool-sections";
import { sidebarSectionForPath } from "./sidebar-active-section";
import { VIDEO_REFERENCE_LINKS } from "./sidebar-video-links";
import { IconBook, IconLeaderboard } from "../../ui/icons";

/** Per-id artwork for the reference pair at the end of Practice; the hrefs
 *  and titles come from `VIDEO_REFERENCE_LINKS`. */
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
   * Id of the open section, when a parent owns the accordion. `VideoSidebarTree`
   * passes this so its own "Round Videos" node takes part: opening a tool
   * section there closes Round Videos, and vice versa.
   */
  expandedSectionIds?: readonly string[];
  /** Present together with {@link ToolNavTreeProps.expandedSectionIds}. */
  onToggleSection?: (sectionId: string) => void;
  /**
   * Render only these tool sections, in this order, instead of all of
   * {@link SIDEBAR_TOOL_SECTIONS} — the `/cards` sidebar passes
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

  // On a filtered tree the route often sits in a section that isn't rendered
  // — `/cards` is a dock destination, in no tool section at all — which would
  // leave the column with a heading and no links. Fall back to the first
  // section shown, so the research list is open on arrival.
  const matchedSectionId = sidebarSectionForPath(pathname);
  const routeSectionId =
    showsWholeTree || sections.some((section) => section.id === matchedSectionId)
      ? matchedSectionId
      : sections[0]?.id ?? null;

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
          {/* The glossary and the rankings are round-day reference material,
              so they close out Practice rather than floating below the tree
              in a section of their own. They stay `VIDEO_REFERENCE_LINKS`
              rather than becoming Practice tools: `sidebar-tool-sections`
              feeds `sidebar-routes` and `sidebar-active-section`, and folding
              two `/videos/*` paths into a tool section would hand the video
              library's own pages the generic tool sidebar. */}
          {section.id === PRACTICE_SECTION_ID &&
            VIDEO_REFERENCE_LINKS.map((link) => (
              <TreeItem
                key={link.id}
                level={3}
                href={link.href}
                title={link.title}
                icon={REFERENCE_ICONS[link.id]}
                isActive={pathname === link.href}
              />
            ))}
        </TreeItem>
      ))}
    </>
  );
}
