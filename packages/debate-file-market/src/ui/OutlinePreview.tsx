"use client"

/**
 * @fileoverview A file's table of contents — the free preview of a file for
 * sale. Indented by heading level: pocket, hat, block, tag.
 *
 * @module debate-file-market/ui/OutlinePreview
 */

import type { OutlineEntry } from "../index"
import { cn } from "./cn"

const LEVEL_STYLES: Record<OutlineEntry["level"], string> = {
  1: "pl-0 font-semibold uppercase tracking-wide",
  2: "pl-3 font-semibold",
  3: "pl-6 font-medium",
  4: "pl-9 text-muted-foreground",
}

export function OutlinePreview({ outline, className }: { outline: OutlineEntry[]; className?: string }) {
  if (outline.length === 0) {
    return <p className="text-xs text-muted-foreground">This file has no headings, so the preview is empty.</p>
  }
  return (
    <ol
      aria-label="Table of contents"
      className={cn("overflow-y-auto rounded-md border border-border bg-muted/30 p-2 text-xs", className)}
    >
      {outline.map((entry, index) => (
        <li key={index} className={cn("truncate py-0.5", LEVEL_STYLES[entry.level])} title={entry.text}>
          {entry.text}
        </li>
      ))}
    </ol>
  )
}
