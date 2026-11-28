"use client"
/**
 * @file page-info.tsx
 * @description The "Info" button at the end of every docs page's toolbar. It
 * opens a small panel of stats about the page: words, reading time,
 * sections, paragraphs, links, figures, citations, readability (the Flesch
 * Reading Ease score out of 100 and its label) and, where known, when it was
 * last updated, each with an icon. The counts and score are worked out on the server
 * (`lib/fumadocs/page-stats.ts`, `lib/fumadocs/readability.ts`) from the page's
 * processed Markdown, so the button costs no work in the browser.
 */
import { useEffect, useRef, useState } from "react"
import {
  BookOpen,
  CaseSensitive,
  Clock,
  Code,
  Heading,
  History,
  Highlighter,
  Image,
  Info,
  Layers,
  Link,
  Pilcrow,
  Quote,
  Table,
  Type,
  type LucideIcon,
} from "lucide-react"
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

const DASH = "\u2014"

/** The rows the panel shows, skipping counts that are zero (except words and reading time). */
export function pageInfoRows({ stats, lastUpdated, showHighlights }: PageInfoButtonProps): [string, string][] {
  const rows: [string, string][] = [
    ["Words", number.format(stats.words)],
    ["Reading time", stats.readingMinutes < 1 ? "under a minute" : `${stats.readingMinutes} min`],
    ["Characters", number.format(stats.characters)],
    ["Readability", stats.readability.score == null ? DASH : `${stats.readability.score}% ${stats.readability.band}`],
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

const ROW_ICONS: Record<string, LucideIcon> = {
  Words: Type,
  "Reading time": Clock,
  Characters: CaseSensitive,
  Readability: BookOpen,
  Sections: Layers,
  Headings: Heading,
  Paragraphs: Pilcrow,
  Links: Link,
  Figures: Image,
  Tables: Table,
  "Code blocks": Code,
  Citations: Quote,
  Highlights: Highlighter,
  "Last updated": History,
}

/** The stats panel's contents (the popover body of {@link PageInfoButton}). */
export function PageInfoPanel(props: PageInfoButtonProps) {
  const rows = pageInfoRows(props)
  return (
    <>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">Doc Metrics</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {rows.map(([label, value]) => {
          const Icon = ROW_ICONS[label]
          return (
            <div key={label} className="contents">
              <dt className="flex items-center gap-2 text-fd-muted-foreground">
                {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0" />}
                {label}
              </dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          )
        })}
      </dl>
    </>
  )
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
        <Info aria-hidden="true" />
        <span>Info</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Doc Metrics"
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border bg-fd-popover p-3 text-sm text-fd-popover-foreground shadow-lg"
        >
          <PageInfoPanel {...props} />
        </div>
      )}
    </div>
  )
}
