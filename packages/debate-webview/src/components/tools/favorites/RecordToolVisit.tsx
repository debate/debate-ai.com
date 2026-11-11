"use client"

/**
 * @fileoverview Renders nothing; records a visit to the current tool in the
 * "Recent" store (`lib/hooks/useRecentTools.ts`) when its page mounts.
 *
 * Mounted by `ToolPageHeader`, which nearly every cataloged tool page uses
 * (`tool-page-header-coverage.test.ts`), so a tool opened from the sidebar,
 * a bookmark, a typed URL or another page's link shows up in the command
 * palette's "Recent" group, not only one launched from the palette itself.
 *
 * @module components/tools/favorites/RecordToolVisit
 */

import { useRecordToolVisit } from "../../../lib/hooks/useRecentTools"

/** Props for {@link RecordToolVisit}. */
export interface RecordToolVisitProps {
  /** The tool's catalog href (an `ALL_TOOLS` entry). */
  href: string
}

/** Records `href` as the most recently opened tool, once per mount. */
export function RecordToolVisit({ href }: RecordToolVisitProps) {
  useRecordToolVisit(href)
  return null
}
