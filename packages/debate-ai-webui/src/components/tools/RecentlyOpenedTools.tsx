"use client"

/**
 * @fileoverview "Recently opened" strip on `/tools` — the grid-side half of
 * `command-palette.mdx`'s "Recent" group, reading the same
 * `lib/hooks/useRecentTools.ts` store rather than a separate list. Renders
 * nothing until there is at least one entry (a fresh browser, or one where
 * every recorded tool was since renamed/removed from the catalog), so there
 * is no empty heading to flash before hydration — the same reasoning
 * `MySavedItems.tsx` and `FavoritesController.tsx` document for their own
 * empty states.
 *
 * @module components/tools/RecentlyOpenedTools
 */

import { Clock } from "lucide-react"
import { useRecentTools } from "@/lib/hooks/useRecentTools"
import { resolveRecentTools } from "@/lib/recentTools"
import { ALL_TOOLS } from "@/app/tools/tool-groups"
import { RecordVisitLink } from "./RecordVisitLink"

export function RecentlyOpenedTools() {
  const { recent } = useRecentTools()
  const tools = resolveRecentTools(recent, ALL_TOOLS)

  if (tools.length === 0) return null

  return (
    <section className="mb-8" data-recently-opened-section>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Recently opened
      </h2>
      <div className="flex flex-wrap gap-2">
        {tools.map((tool) => (
          <RecordVisitLink
            key={tool.href}
            href={tool.href}
            className="flex items-center gap-2 rounded-full border border-border bg-background py-1.5 px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:border-accent-foreground/20"
          >
            <tool.icon className="h-4 w-4 shrink-0" />
            {tool.label}
          </RecordVisitLink>
        ))}
      </div>
    </section>
  )
}
