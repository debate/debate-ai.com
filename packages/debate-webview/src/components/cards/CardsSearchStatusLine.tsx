"use client"

/**
 * @fileoverview Slim status strip above the CARDS search workspace.
 *
 * `/research/cards` is a bounded three-column workspace with no
 * `ToolPageHeader`, so without this the evidence library, card scores and
 * assessments it writes to the account gave no sign of whether they had
 * synced. Mirrors `ReasonEditorStatusLine`.
 *
 * @module components/cards/CardsSearchStatusLine
 */

import { ToolSyncBadge } from "../tools/ToolSyncBadge"

export function CardsSearchStatusLine() {
  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5 border-b px-4 py-1.5">
      <ToolSyncBadge href="/research/cards" />
    </div>
  )
}
