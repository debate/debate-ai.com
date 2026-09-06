/**
 * @fileoverview The "Apps" + "Coaching / Research / Practice" + glossary/
 * rankings portion of the videos sidebar, factored out of
 * `VideoSidebarTree` so it can also render on the non-video tool pages those
 * sections link to (`/coach`, `/research`, `/practice-round`, etc.) — those
 * pages otherwise render no sidebar at all once you navigate off `/videos`,
 * which reads as the sidebar disappearing. `AppSidebarShell` (app-local)
 * mounts this on every page whose path matches one of the links below so the
 * nav stays visible everywhere it points to, not just on `/videos`.
 *
 * @module components/category-gallery/ToolNavTree
 */

"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { TreeItem } from "./TreeItem";
import { APP_DOCK_LINKS, SIDEBAR_TOOL_SECTIONS } from "./sidebar-tool-sections";
import { IconBook, IconLeaderboard } from "../../ui/icons";

export function ToolNavTree() {
  const pathname = usePathname();
  // Start with whichever section (if any) contains the page we're already
  // on expanded, so landing directly on e.g. `/practice-round` shows
  // "Practice" open with its active item highlighted instead of requiring an
  // extra click to see where you are.
  const [appsExpanded, setAppsExpanded] = useState(() =>
    APP_DOCK_LINKS.some((link) => link.href === pathname),
  );
  const [expandedToolSections, setExpandedToolSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      if (section.tools.some((tool) => tool.href === pathname)) initial[section.id] = true;
    }
    return initial;
  });

  const toggleToolSection = (id: string) =>
    setExpandedToolSections((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <TreeItem
        level={2}
        href="/tools"
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
      </TreeItem>

      {SIDEBAR_TOOL_SECTIONS.map((section) => (
        <TreeItem
          key={section.id}
          level={2}
          href={section.href}
          title={section.title}
          icon={section.icon}
          expanded={expandedToolSections[section.id] ?? false}
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
