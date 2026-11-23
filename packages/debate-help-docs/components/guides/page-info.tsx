"use client"
/**
 * @file page-info.tsx
 * @description The "Info" button at the end of every docs page's toolbar. It
 * opens a small panel of stats about the page: words, reading time,
 * sections, paragraphs, links, figures, citations and, where known, when it
 * was last updated. The counts are worked out on the server
 * (`lib/fumadocs/page-stats.ts`) from the page's processed Markdown, so the
 * button costs no work in the browser.
 */
import { useEffect, useRef, useState } from "react"
import { Info } from "lucide-react"
import { cn } from "../../lib/utils"
import type { PageStats } from "../../lib/fumadocs/page-stats"
import { buttonVariants } from "../ui/button"

export interface PageInfoButtonProps {
  stats: PageStats
  /** When the page was last edited, if known. */
  lastUpdated?: Date | string
  /** Show the highlight count (only the Synergy Slayer papers render highlights). */
  showHighlights?: boolean
}

const number = new Intl.NumberFormat("en-US")

/** The rows the panel shows, skipping counts that are zero (except words and reading time). */
export function pageInfoRows({ stats, lastUpdated, showHighlights }: PageInfoButtonProps): [string, string][] {
  const rows: [string, string][] = [
    ["Words", number.format(stats.words)],
    ["Reading time", stats.readingMinutes < 1 ? "under a minute" : `${stats.readingMinutes} min`],
    ["Characters", number.format(stats.characters)],
  ]
  const optional: [string, number][] = [
    ["Sections", stats.sections],
    ["Headings", stats.headings],
    ["Paragraphs", stats.paragraphs],
    ["Links", stats.links],
    ["Figures", stats.images],
    ["Tables", stats.tables],
    ["Code blocks", stats.codeBlocks],
    ["Citations", stats.citations],
  ]
  if (showHighlights) optional.push(["Highlights", stats.highlights])
  for (const [label, value] of optional) if (value > 0) rows.push([label, number.format(value)])
  if (lastUpdated) {
    const date = new Date(lastUpdated)
    if (!Number.isNaN(date.getTime())) {
      rows.push(["Last updated", date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })])
    }
  }
  return rows
}

/** The toolbar's Info button and its stats panel. */
export function PageInfoButton(props: PageInfoButtonProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const rows = pageInfoRows(props)
  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Stats for this page: words, reading time, sections, links and more"
        className={cn(buttonVariants({ size: "sm", className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground" }))}
        onClick={() => setOpen((value) => !value)}
      >
        <Info />
        Info
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Page stats"
          className="absolute right-0 top-full z-50 mt-1 w-60 rounded-lg border bg-fd-popover p-3 text-sm text-fd-popover-foreground shadow-lg"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">Page stats</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-fd-muted-foreground">{label}</dt>
                <dd className="text-right font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
