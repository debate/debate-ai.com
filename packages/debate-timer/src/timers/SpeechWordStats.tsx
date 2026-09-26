"use client"

/**
 * @fileoverview Word-count widget for the speech timer bar: the words read
 * from the speech doc at a glance, with a popover breaking that down into
 * read / underlined / highlighted / orally spoken.
 *
 * Presentational only — the caller computes the doc counts with
 * `formats/speech-doc-word-stats.ts` (from whichever doc is linked to the
 * speech) and the spoken count from `recorder/spoken-words-store.ts`.
 *
 * @module timers/SpeechWordStats
 */

import { useState } from "react"
import { BookOpen } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/primitives/popover"
import { cn } from "../ui/lib/utils"
import type { SpeechDocWordStats } from "../formats/speech-doc-word-stats"

export interface SpeechWordStatsProps {
  speechName: string
  stats: SpeechDocWordStats
  /** Words transcribed from the recording of this speech. */
  spoken: number
  /** Where `stats` came from, e.g. the linked document's title. */
  sourceLabel?: string
  /** Inline text for list rows instead of a button with a popover. */
  variant?: "badge" | "inline"
  className?: string
}

const rows: { key: keyof SpeechDocWordStats | "spoken"; label: string; swatch: string }[] = [
  { key: "read", label: "Read", swatch: "bg-primary" },
  { key: "underlined", label: "Underlined", swatch: "bg-sky-500" },
  { key: "highlighted", label: "Highlighted", swatch: "bg-yellow-400" },
  { key: "spoken", label: "Orally spoken", swatch: "bg-green-500" },
]

export function SpeechWordStats({
  speechName,
  stats,
  spoken,
  sourceLabel,
  variant = "badge",
  className,
}: SpeechWordStatsProps) {
  const [open, setOpen] = useState(false)
  const value = (key: (typeof rows)[number]["key"]) => (key === "spoken" ? spoken : stats[key])
  const summary = `${speechName}: ${stats.read} read, ${stats.underlined} underlined, ${stats.highlighted} highlighted, ${spoken} spoken`

  if (variant === "inline") {
    if (stats.total === 0 && spoken === 0) return null
    return (
      <span className={cn("tabular-nums text-[10px] text-muted-foreground", className)} title={summary}>
        {stats.read} read · {spoken} spoken
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn("h-6 shrink-0 gap-1 px-1.5 text-[11px] font-semibold tabular-nums", className)}
          aria-label={summary}
          title={summary}
        >
          <BookOpen className="h-3 w-3" />
          <span>{stats.read}</span>
          {spoken > 0 && <span className="font-normal text-green-600 dark:text-green-400">/{spoken}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 space-y-2 p-3" align="end">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold">{speechName} words</span>
          <span className="text-xs text-muted-foreground tabular-nums">{stats.total} in doc</span>
        </div>
        <dl className="space-y-1 text-xs">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", row.swatch)} aria-hidden="true" />
              <dt className="flex-1 text-muted-foreground">{row.label}</dt>
              <dd className="font-semibold tabular-nums">{value(row.key)}</dd>
            </div>
          ))}
        </dl>
        {stats.read > 0 && spoken > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Spoke {Math.round((spoken / stats.read) * 100)}% of the words read from the doc.
          </p>
        )}
        <p className="truncate text-[10px] text-muted-foreground" title={sourceLabel}>
          Source: {sourceLabel || "flow speech doc"}
        </p>
      </PopoverContent>
    </Popover>
  )
}
