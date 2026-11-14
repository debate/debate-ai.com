/**
 * @fileoverview Popular-search chips shown above the video grid.
 *
 * One wrapping row of one-click searches drawn from the library itself:
 * curated debate keywords that actually have matching videos, followed by the
 * tournament names the library carries the most rounds from. There are no
 * category headings; the chips wrap within the width of the results below
 * them. Clicking a chip runs it as a search.
 * @module components/video-search/VideoSearchSuggestions
 */

"use client";

import React from "react";
import type { VideoSuggestions } from "../../../types/videos";
import { cn } from "../../../ui/lib/utils";

/** Props for the {@link VideoSearchSuggestions} component. */
interface VideoSearchSuggestionsProps {
  /** Keyword and tournament chips from `/api/videos/meta`. */
  suggestions: VideoSuggestions;
  /** Active search term, so the matching chip can be highlighted. */
  searchTerm?: string;
  /** Runs the chip's label as a search. */
  onSelect: (term: string) => void;
  /** Extra classes for the wrapper. */
  className?: string;
  /** Inline styles for the wrapper, e.g. a `maxWidth` matching the rows. */
  style?: React.CSSProperties;
}

/**
 * Renders the popular keyword and tournament searches as one wrapping row.
 *
 * @param props - See {@link VideoSearchSuggestionsProps}.
 */
export function VideoSearchSuggestions({
  suggestions,
  searchTerm,
  onSelect,
  className,
  style,
}: VideoSearchSuggestionsProps) {
  const { keywords = [], tournaments = [] } = suggestions ?? {};
  const items = [...keywords, ...tournaments];
  if (items.length === 0) return null;

  const active = searchTerm?.trim().toLowerCase();

  return (
    <div
      role="group"
      aria-label="Suggested searches"
      className={cn("flex min-w-0 flex-wrap gap-1.5", className)}
      style={style}
    >
      {items.map((item) => {
        const isActive = active === item.label.toLowerCase();
        return (
          <button
            key={`${item.kind}-${item.label}`}
            type="button"
            onClick={() => onSelect(item.label)}
            aria-pressed={isActive}
            title={`Search ${item.label}`}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10",
              isActive && "border-primary/60 bg-primary/15",
            )}
          >
            <span className="truncate max-w-[14rem]">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
