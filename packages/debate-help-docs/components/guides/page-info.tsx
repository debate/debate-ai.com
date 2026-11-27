"use client"
/**
 * @file page-info.tsx
 * @description The "Info" button at the end of every docs page's toolbar. It
 * opens a small panel of stats about the page: words, reading time,
 * sections, paragraphs, links, figures, citations and, where known, when it
 * was last updated, each with an icon, then a readability score out of 100
 * (Flesch Reading Ease) with the other grade-level formulas folded below it.
 * The counts and scores are worked out on the server
 * (`lib/fumadocs/page-stats.ts`, `lib/fumadocs/readability.ts`) from the page's
 * processed Markdown, so the button costs no work in the browser.
 */
import { useEffect, useId, useRef, useState } from "react"
import {
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
import type { Readability, ReadabilityScores } from "../../lib/fumadocs/readability"
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

const ROW_ICONS: Record<string, LucideIcon> = {
  Words: Type,
  "Reading time": Clock,
  Characters: CaseSensitive,
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

const DASH = "\u2014"

const formatScore = (value: number | null | undefined) => (value == null ? DASH : value.toFixed(1))

/** The grade-level formulas under the readability bar, as label and value (an em dash when not computable). */
export function readabilityRows(readability: Readability): [string, string][] {
  const { scores } = readability
  const rows: [keyof ReadabilityScores | "textStandard", string][] = [
    ["fleschReadingEase", "Flesch Reading Ease"],
    ["fleschKincaidGrade", "Flesch-Kincaid Grade"],
    ["gunningFog", "Gunning Fog"],
    ["smog", "SMOG Index"],
    ["automatedReadability", "Automated Readability Index"],
    ["colemanLiau", "Coleman-Liau Index"],
    ["linsearWrite", "Linsear Write"],
    ["textStandard", "Text standard (grade)"],
  ]
  return rows.map(([key, label]) => [
    label,
    key === "textStandard"
      ? readability.textStandard == null
        ? DASH
        : String(readability.textStandard)
      : formatScore(scores[key]),
  ])
}

const BAR_COLORS: Record<string, string> = {
  "Very Easy": "bg-emerald-500",
  Easy: "bg-emerald-500",
  "Fairly Easy": "bg-lime-500",
  Standard: "bg-lime-500",
  "Fairly Difficult": "bg-amber-500",
  Difficult: "bg-orange-500",
  "Very Confusing": "bg-red-500",
}

/** The headline readability score as a labelled progress bar, with the other formulas in a collapsed list. */
export function ReadabilitySummary({ readability }: { readability: Readability }) {
  const { score, band } = readability
  const labelId = useId()
  return (
    <div className="mt-3 border-t pt-3" data-testid="readability">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span id={labelId} className="text-fd-muted-foreground">
          Readability
        </span>
        <span className="font-medium tabular-nums">
          {score == null ? DASH : `${score}/100 ${band}`}
        </span>
      </div>
      {score == null ? (
        <p className="text-xs text-fd-muted-foreground">Not enough text to score.</p>
      ) : (
        <div
          role="progressbar"
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          aria-valuetext={`${score} out of 100, ${band}`}
          className="h-2 w-full overflow-hidden rounded-full bg-fd-muted"
        >
          <div
            className={cn("h-full rounded-full", BAR_COLORS[band ?? ""] ?? "bg-fd-primary")}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
      <details className="mt-2 group">
        <summary className="cursor-pointer select-none text-xs text-fd-muted-foreground hover:text-fd-foreground">
          Grade levels
        </summary>
        <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs">
          {readabilityRows(readability).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-fd-muted-foreground">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {readability.scores.smog == null && readability.score != null && (
          <p className="mt-1 text-xs text-fd-muted-foreground">SMOG needs at least 3 sentences.</p>
        )}
      </details>
    </div>
  )
}

/** The stats panel's contents (the popover body of {@link PageInfoButton}). */
export function PageInfoPanel(props: PageInfoButtonProps) {
  const rows = pageInfoRows(props)
  return (
    <>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">Page stats</p>
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
      <ReadabilitySummary readability={props.stats.readability} />
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
          aria-label="Page stats"
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border bg-fd-popover p-3 text-sm text-fd-popover-foreground shadow-lg"
        >
          <PageInfoPanel {...props} />
        </div>
      )}
    </div>
  )
}
