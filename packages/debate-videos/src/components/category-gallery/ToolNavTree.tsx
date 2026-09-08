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
 * without an `href`, so clicking it does nothing but toggle the section, and
 * every section starts expanded. Its flagship tool is still reachable — it is
 * also listed as the first link inside the section.
 *
 * @module components/category-gallery/ToolNavTree
 */

"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { TreeItem } from "./TreeItem";
import { APP_DOCK_LINKS, SIDEBAR_TOOL_SECTIONS, TOOLS_ROOT_HREF } from "./sidebar-tool-sections";
import { IconBook, IconLeaderboard } from "../../ui/icons";

export function ToolNavTree() {
  const pathname = usePathname();
  // Every section starts open: the tree is the only nav on the tool pages,
  // so showing all of it up front beats making people hunt for the section
  // that holds the page they want. Collapsing is still available per section.
  const [appsExpanded, setAppsExpanded] = useState(true);
  const [collapsedToolSections, setCollapsedToolSections] = useState<Record<string, boolean>>({});

  const toggleToolSection = (id: string) =>
    setCollapsedToolSections((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <TreeItem
        level={1}
        title="Apps"
        icon={LayoutGrid}
        expanded={appsExpanded}
        onToggleExpand={() => setAppsExpanded((v) => !v)}
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
          expanded={!collapsedToolSections[section.id]}
          onToggleExpand={() => toggleToolSection(section.id)}
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
        <TreeItem level={3} href="/videos/dictionary" title="Glossary of Terms" icon={IconBook} muted />
        <TreeItem level={3} href="/videos/rankings" title="Rankings" icon={IconLeaderboard} muted />
      </div>
    </>
  );
}
