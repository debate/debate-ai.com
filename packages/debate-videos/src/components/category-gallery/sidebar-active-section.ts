/**
 * @fileoverview Which sidebar section holds a given route.
 *
 * The tree's sections expand independently and all start open, so this is no
 * longer what decides which single section is visible — it is what a
 * navigation *re-opens*: following a link into a section you had collapsed
 * expands that section again rather than leaving you on a page whose nav is
 * shut. Nothing else collapses.
 *
 * @module components/category-gallery/sidebar-active-section
 */

import { SIDEBAR_TOOL_SECTIONS } from "./sidebar-tool-sections";

/** Id of the tree's "Round Videos" node — the one section not backed by tool
 *  data. (Lectures sits outside the accordion; see `VideoSidebarTree`.) */
export const VIDEOS_SECTION_ID = "videos";

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
 * Every route the tree covers, in tie-break order: Round Videos first, then
 * the tool sections. Order only decides ties — a longer match always wins, so
 * `/videos/pf` resolves to the video library rather than to a tool that
 * happens to sit at `/videos`.
 *
 * The app dock's destinations used to be listed here too, for an "Apps" node
 * the tree no longer renders. Dropping them is what lets `/doc` open the
 * Research section that actually lists it ("Debate Docs") instead of a
 * section with no links left to show.
 */
const SECTION_HREFS: SectionHref[] = [
  { sectionId: VIDEOS_SECTION_ID, href: "/videos" },
  ...SIDEBAR_TOOL_SECTIONS.flatMap((section) =>
    section.tools.map((tool) => ({ sectionId: section.id, href: tool.href })),
  ),
];

/**
 * Returns the id of the sidebar section a route belongs to, or `null` when it
 * belongs to none — a dock destination in no tool section (`/cards`,
 * `/debate`) lands there, and the tree simply opens nothing.
 *
 * The longest matching link wins, so a tool nested under another entry
 * (`/practice-round/setup` under `/practice-round`) opens the section that
 * actually lists it.
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
