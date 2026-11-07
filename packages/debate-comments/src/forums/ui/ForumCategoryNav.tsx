"use client";

/**
 * @fileoverview The board picker and the order picker above the forum feed.
 *
 * Two rows of pills: every board (plus "All"), then Active / New / Top. Both
 * are plain buttons that report a choice; the hub owns the state and the URL.
 *
 * @module debate-comments/forums/ui/ForumCategoryNav
 */

import { cn } from "../../cn";
import { FORUM_CATEGORIES, type ForumCategoryId, type ForumSort } from "../types";

/** The labels the order picker shows, in the order it shows them. */
export const FORUM_SORT_OPTIONS: readonly { id: ForumSort; label: string; hint: string }[] = [
  { id: "active", label: "Recent activity", hint: "Most recently posted to first" },
  { id: "new", label: "New", hint: "Newest threads first" },
  { id: "top", label: "Top", hint: "Most liked first" },
];

export interface ForumCategoryNavProps {
  category: ForumCategoryId | null;
  sort: ForumSort;
  onCategoryChange: (category: ForumCategoryId | null) => void;
  onSortChange: (sort: ForumSort) => void;
}

function pillClass(active: boolean) {
  return cn(
    "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-foreground hover:bg-accent",
  );
}

export function ForumCategoryNav({
  category,
  sort,
  onCategoryChange,
  onSortChange,
}: ForumCategoryNavProps) {
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Forum categories" className="-mx-1 overflow-x-auto px-1 pb-1">
        <ul className="flex gap-1.5 sm:flex-wrap">
          <li>
            <button
              type="button"
              aria-pressed={category === null}
              onClick={() => onCategoryChange(null)}
              className={pillClass(category === null)}
            >
              All
            </button>
          </li>
          {FORUM_CATEGORIES.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                aria-pressed={category === entry.id}
                title={entry.description}
                onClick={() => onCategoryChange(entry.id)}
                className={pillClass(category === entry.id)}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div role="group" aria-label="Sort threads" className="flex items-center gap-1 text-xs">
        <span className="mr-1 text-muted-foreground">Sort:</span>
        {FORUM_SORT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={sort === option.id}
            title={option.hint}
            onClick={() => onSortChange(option.id)}
            className={cn(
              "h-7 rounded-md px-2 font-medium transition-colors",
              sort === option.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
