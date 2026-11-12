/**
 * Tab ids and URLs of the Practice Debates page (`/practice/debates`). A plain
 * module (not the `"use client"` page) so the Next app's server pages can read
 * it to redirect the old `/practice/challenges`, `/practice/drills` and
 * `/practice/partners` addresses.
 *
 * @module components/practice/practice-debates-sections
 */

/** The page's own route. */
export const PRACTICE_DEBATES_HREF = "/practice/debates"

/** One tab per tool. Also the `?section=` values. */
export type PracticeDebatesSectionId = "challenges" | "drills" | "partners"

/**
 * The Practice Debates URL for one tab. Online Challenges is the default tab,
 * so it gets the bare route.
 *
 * @param section - The tab to open.
 */
export function practiceDebatesHref(section: PracticeDebatesSectionId): string {
  return section === "challenges" ? PRACTICE_DEBATES_HREF : `${PRACTICE_DEBATES_HREF}?section=${section}`
}
