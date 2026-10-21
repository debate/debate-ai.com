/**
 * @fileoverview The library search box under the player on a watch page,
 * above the related videos — so a viewer who has finished a round can look
 * for the next one without going back to the library first.
 *
 * Submitting hands the text to `onSearch`. The watch page uses it to swap
 * the related videos underneath for the library's matches in place — the
 * video above keeps playing — and `onClear` (shown while `activeQuery` is
 * set) brings the related videos back.
 */

"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Search, X } from "lucide-react"
import { Input } from "../../ui/primitives/input"
import { cn } from "../../ui/lib/utils"

/** Props for {@link WatchSearchBox}. */
export interface WatchSearchBoxProps {
  /** Runs the search; called with the trimmed text, never with an empty one. */
  onSearch: (text: string) => void
  /** Drops the active search; the clear control shows only when given. */
  onClear?: () => void
  /**
   * The search currently applied, when the caller tracks one — mirrored into
   * the field, so a search started elsewhere (a team name in a row) shows here.
   */
  activeQuery?: string
  className?: string
}

/** A search input that runs a library search on Enter or the Search button. */
export function WatchSearchBox({ onSearch, onClear, activeQuery, className }: WatchSearchBoxProps) {
  const [text, setText] = useState(activeQuery ?? "")

  useEffect(() => {
    if (activeQuery !== undefined) setText(activeQuery)
  }, [activeQuery])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const query = text.trim()
    if (query) onSearch(query)
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={cn("flex items-center gap-2", className)}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search videos, teams, tournaments…"
          aria-label="Search videos"
          className="h-9 pl-9"
        />
      </div>
      <button
        type="submit"
        disabled={!text.trim()}
        className="h-9 shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        Search
      </button>
      {onClear && activeQuery && (
        <button
          type="button"
          onClick={() => {
            setText("")
            onClear()
          }}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      )}
    </form>
  )
}
