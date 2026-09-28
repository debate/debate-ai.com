/**
 * @fileoverview A small pointer from `/settings` to `/tools`.
 *
 * `/settings` is CardMirror-editor settings only now (see
 * `routes/settings/page.tsx`'s own doc comment) — account-level tool
 * preferences and sync status moved to `ToolSyncStatusPanel` on `/tools` and
 * were never linked back from here, so a user looking for "my saved tools"
 * or "is my data synced" under Settings found nothing pointing them the
 * right way. This is the lightweight fix noted as a follow-up in TODO.md:
 * link `/settings` → `/tools` rather than re-duplicating the sync status UI
 * on both pages.
 *
 * @module components/settings/ToolsLinkCard
 */

import Link from "next/link"
import { ArrowRight, Wrench } from "lucide-react"

export function ToolsLinkCard() {
  return (
    <Link
      href="/tools"
      className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-4 text-sm transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-2.5">
        <Wrench className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Tools &amp; saved data</p>
          <p className="text-muted-foreground">
            Browse your saved flows, documents, and rounds, and check your account sync status.
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
