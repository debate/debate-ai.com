/**
 * @fileoverview Which sidebar sections are expanded, as pure set arithmetic.
 *
 * The tree used to be an accordion — exactly one section open, the one holding
 * the current route, every other section's links unmounted — so reaching a
 * tool in another section was always two clicks with the list you were reading
 * vanishing in between. Sections now start expanded and collapse
 * independently; these are the three operations that behaviour is made of,
 * kept out of `ToolNavTree`/`VideoSidebarTree` so both trees share one
 * definition of them and they can be tested without a DOM.
 *
 * @module components/category-gallery/sidebar-section-expansion
 */

import { VIDEOS_SECTION_ID } from "./sidebar-active-section";
import { SIDEBAR_TOOL_SECTIONS } from "./sidebar-tool-sections";

/**
 * Every h1 node `VideoSidebarTree` owns the expanded state of — "Videos" and
 * the tool sections — all of which start open. The "Apps" node is gone; the
 * dock renders those five destinations itself.
 */
export const ALL_SIDEBAR_SECTION_IDS: readonly string[] = [
  VIDEOS_SECTION_ID,
  ...SIDEBAR_TOOL_SECTIONS.map((section) => section.id),
];

/**
 * Flips one section between expanded and collapsed, leaving every other
 * section as it was — the accordion's "close whatever else was open" step is
 * exactly what this does not do.
 *
 * @param current - The currently expanded section ids.
 * @param sectionId - The section whose heading was clicked.
 * @returns The next expanded set (a new array; `current` is never mutated).
 */
export function toggleExpandedSection(
  current: readonly string[],
  sectionId: string,
): readonly string[] {
  return current.includes(sectionId)
    ? current.filter((id) => id !== sectionId)
    : [...current, sectionId];
}

/**
 * Expands one section if it isn't already, without collapsing anything —
 * what a navigation does, so following a link into a section you had
 * collapsed doesn't land you on a page whose nav is shut.
 *
 * Returns `current` itself when the section is already expanded, so a caller
 * passing this to a `useState` setter re-renders only on a real change.
 *
 * @param current - The currently expanded section ids.
 * @param sectionId - The section holding the route being navigated to.
 * @returns The next expanded set.
 */
export function withSectionExpanded(
  current: readonly string[],
  sectionId: string,
): readonly string[] {
  return current.includes(sectionId) ? current : [...current, sectionId];
}
