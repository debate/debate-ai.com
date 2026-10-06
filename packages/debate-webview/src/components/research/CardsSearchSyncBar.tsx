/**
 * @fileoverview Slim status row above the `/research/cards` search workspace:
 * the shared account-sync badge (with "Save now") for the collections filed
 * under that route. The search screen is a viewport-bounded three-column
 * workspace with no `ToolPageHeader`, so the badge gets its own row instead.
 *
 * @module components/research/CardsSearchSyncBar
 */

import { ToolSyncBadge } from "../tools/ToolSyncBadge"

export function CardsSearchSyncBar() {
  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5 border-b px-3 py-1" data-cards-sync-bar>
      <ToolSyncBadge href="/research/cards" />
    </div>
  )
}
