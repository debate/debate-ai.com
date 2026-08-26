"use client"

/**
 * A client-side keyword filter for the (server-rendered) `/tools` grid.
 *
 * The grid itself stays a plain server component — passing ~50 Lucide icon
 * components as props across the server/client boundary would need every
 * `icon: Trophy` entry rewritten as a pre-rendered `<Trophy />` element, a
 * broad mechanical change to `TOOL_GROUPS` unrelated to search. Instead this
 * component filters the DOM directly: each tool card in `page.tsx` carries a
 * `data-tool-search` attribute (its label + description + highlights,
 * lowercased) and each section a `data-tool-section`; typing here just
 * toggles their `hidden` attribute, with no data passed as props at all.
 */

import { useRef } from "react"
import { Search } from "lucide-react"

export function ToolsSearch() {
  const inputRef = useRef<HTMLInputElement>(null)
  const emptyStateRef = useRef<HTMLParagraphElement>(null)

  const handleChange = () => {
    const grid = document.querySelector<HTMLElement>("[data-tools-grid]")
    if (!grid) return
    const tokens = (inputRef.current?.value ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)

    let visibleSections = 0
    for (const section of grid.querySelectorAll<HTMLElement>("[data-tool-section]")) {
      let visibleInSection = 0
      for (const card of section.querySelectorAll<HTMLElement>("[data-tool-search]")) {
        const haystack = card.dataset.toolSearch ?? ""
        const matches = tokens.every((t) => haystack.includes(t))
        card.hidden = !matches
        if (matches) visibleInSection++
      }
      section.hidden = visibleInSection === 0
      if (visibleInSection > 0) visibleSections++
    }
    if (emptyStateRef.current) emptyStateRef.current.hidden = visibleSections > 0
  }

  return (
    <div className="mb-6">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          placeholder="Filter tools…"
          aria-label="Filter tools"
          onChange={handleChange}
          className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <p ref={emptyStateRef} hidden className="mt-3 text-sm text-muted-foreground">
        No tools match that search.
      </p>
    </div>
  )
}
