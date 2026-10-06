/**
 * @fileoverview Slim status row above the `/research/cards` search workspace:
 * the shared account-sync badge (with "Save now") for the evidence stores the
 * search screen writes to, which has no `ToolPageHeader` because its three
 * columns fill the viewport.
 *
 * `empty:hidden` collapses the row while the badge has nothing to show.
 *
 * @module components/tools/CardsSearchStatusRow
 */

import { ToolSyncBadge } from "./ToolSyncBadge"

export function CardsSearchStatusRow() {
  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5 border-b px-4 py-1.5 empty:hidden">
      <ToolSyncBadge href="/research/cards" />
    </div>
  )
}
