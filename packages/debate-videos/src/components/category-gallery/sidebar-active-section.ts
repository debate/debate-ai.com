/**
 * @fileoverview Which sidebar section holds a given route.
 *
 * The sidebar tree is an accordion: one section is open at a time, and a
 * closed section renders none of its links. That is what keeps the sidebar
 * to the content of wherever you actually are — clicking a dock button
 * navigates, and the section holding that destination is the one that opens.
 * Before this, every section rendered its links up front, so landing on
 * `/videos` mounted around fifty links and the router went and prefetched an
 * RSC payload for each of them while the video feed was still loading.
 *
 * @module components/category-gallery/sidebar-active-section
 */

import {
  APP_DOCK_LINKS,
  SIDEBAR_TOOL_SECTIONS,
  TOOLS_ROOT_HREF,
} from "./sidebar-tool-sections";

/** Id of the tree's "Videos" node — the one section not backed by tool data. */
export const VIDEOS_SECTION_ID = "videos";

/** Id of the tree's "Apps" node, which lists the app dock's destinations. */
export const APPS_SECTION_ID = "apps";

/** Matches a route against a link, counting nested paths as that link's. */
function matchesHref(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** One candidate destination and the section it opens. */
interface SectionHref {
  sectionId: string;
  href: string;
}

/**
 * Every route the tree covers, in tie-break order: Videos first, then the app
 * dock's destinations, then the tool sections. Order only decides ties —
 * a longer match always wins, so `/cards/library` resolves to the Research
 * tool that lists it rather than to the dock's `/cards`.
 */
const SECTION_HREFS: SectionHref[] = [
  { sectionId: VIDEOS_SECTION_ID, href: "/videos" },
  { sectionId: APPS_SECTION_ID, href: TOOLS_ROOT_HREF },
  ...APP_DOCK_LINKS.map((link) => ({ sectionId: APPS_SECTION_ID, href: link.href })),
  ...SIDEBAR_TOOL_SECTIONS.flatMap((section) =>
    section.tools.map((tool) => ({ sectionId: section.id, href: tool.href })),
  ),
];

/**
 * Returns the id of the sidebar section a route belongs to, or `null` when it
 * belongs to none.
 *
 * The longest matching link wins, so a tool nested under a dock destination
 * (`/cards/library` under `/cards`) opens the section that actually lists it.
 * Where two sections list the same href — `/doc` is both the dock's Docs
 * button and Research's "Debate Docs" — the dock wins, since it is the app's
 * primary navigation and the one the user just clicked.
 *
 * @param pathname - The current route.
 * @returns The section id, or `null` for a route outside the tree.
 */
export function sidebarSectionForPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;

  let bestSectionId: string | null = null;
  let bestLength = -1;
  for (const { sectionId, href } of SECTION_HREFS) {
    if (href.length > bestLength && matchesHref(href, pathname)) {
      bestSectionId = sectionId;
      bestLength = href.length;
    }
  }
  return bestSectionId;
}
