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
 * The sections behave as an accordion: exactly one is open, and a closed
 * section renders none of its links. The open one follows the route, so
 * clicking an app dock button loads that destination's section into the
 * sidebar and nothing else — see `sidebar-active-section`.
 *
 * @module components/category-gallery/ToolNavTree
 */

"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { TreeItem } from "./TreeItem";
import type { TreeItemIcon } from "./tree-item-icon";
import { APP_DOCK_LINKS, SIDEBAR_TOOL_SECTIONS, TOOLS_ROOT_HREF } from "./sidebar-tool-sections";
import { APPS_SECTION_ID, sidebarSectionForPath } from "./sidebar-active-section";
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
   * Whether the section holding the current route starts open. `true` (the
   * sidebar's own default) opens it; the mobile mount below `md` passes
   * `false`, where the tree sits inline under the quick-link tiles and even
   * one expanded section would push the video grid off the screen.
   */
  defaultExpanded?: boolean;
  /**
   * Id of the open section, when a parent owns the accordion. `VideoSidebarTree`
   * passes this so its own "Videos" node takes part: opening a tool section
   * there closes Videos, and vice versa.
   */
  openSectionId?: string | null;
  /** Present together with {@link ToolNavTreeProps.openSectionId}. */
  onOpenSectionChange?: (sectionId: string | null) => void;
}

export function ToolNavTree({
  defaultExpanded = true,
  openSectionId,
  onOpenSectionChange,
}: ToolNavTreeProps = {}) {
  const pathname = usePathname();
  const routeSectionId = sidebarSectionForPath(pathname);
  const isControlled = onOpenSectionChange != null;

  // One section open at a time, and the open one follows the route: the tree
  // is the only nav on the tool pages, and rendering all forty-odd links up
  // front cost a prefetch apiece on the page that was already the slowest.
  const [ownSectionId, setOwnSectionId] = useState<string | null>(
    defaultExpanded ? routeSectionId : null,
  );

  useEffect(() => {
    if (isControlled || !defaultExpanded) return;
    setOwnSectionId(routeSectionId);
  }, [routeSectionId, isControlled, defaultExpanded]);

  const openId = isControlled ? openSectionId ?? null : ownSectionId;

  const toggleSection = (id: string) => {
    const next = openId === id ? null : id;
    if (isControlled) onOpenSectionChange?.(next);
    else setOwnSectionId(next);
  };

  return (
    <>
      <TreeItem
        level={1}
        title="Apps"
        icon={LayoutGrid}
        // Plain click toggles; ctrl/shift/middle-click opens the catalog.
        sectionHref={TOOLS_ROOT_HREF}
        expanded={openId === APPS_SECTION_ID}
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

      {SIDEBAR_TOOL_SECTIONS.map((section) => (
        <TreeItem
          key={section.id}
          level={1}
          title={section.title}
          icon={section.icon}
          // `section.href` is the section's flagship tool — where a
          // ctrl/shift/middle-click on the heading goes.
          sectionHref={section.href}
          expanded={openId === section.id}
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
    </>
  );
}
