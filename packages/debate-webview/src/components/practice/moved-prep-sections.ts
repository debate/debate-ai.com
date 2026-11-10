/**
 * Old Prep Workspace tab ids that now have their own pages, and where each one
 * lives. A plain module (not the `"use client"` workspace) so the Next app's
 * server page can read it to redirect `?section=drills` / `?section=partners`.
 *
 * @module components/practice/moved-prep-sections
 */
export const MOVED_PREP_SECTIONS: Readonly<Record<string, string>> = {
  drills: "/practice/drills",
  partners: "/practice/partners",
}
