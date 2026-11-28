/**
 * @fileoverview The wrapper a video's team name sits in wherever it is
 * clickable outside the list rows (cards, the watch page's header badges, the
 * player's title bar): a link to the team's page, resolved by
 * {@link videoTeamHref}.
 *
 * A label that cannot be resolved to a team page (no team code, like a bare
 * school) falls back to what these places did before: with `onSearch` a button
 * that searches the library for the name, else the children in a plain span.
 * The link is a real anchor, so it is keyboard-focusable and opens in a new
 * tab with a modifier-click; it must therefore never be rendered inside
 * another anchor (a card's thumbnail overlay link is a sibling, so the
 * wrapper lifts itself above it with `raised`).
 * @module components/videos/card/TeamNameLink
 */

"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "../../../ui/lib/utils"
import type { VideoTeamRanking } from "../../../hooks/useVideoTeamRankings"
import { videoTeamHref } from "../../../lib/video-team-href"

export interface TeamNameLinkProps {
  /** The team as the video names it, e.g. `"Harker LL"`. */
  team: string
  /** The team's rankings row, when known. */
  ranking?: VideoTeamRanking | null
  /** Fallback for a team with no team page: searches the library for it. */
  onSearch?: (text: string) => void
  /** Hover text for the link; the search fallback gets its own. */
  title?: string
  /**
   * Lifts the wrapper above an overlay link that covers its container (the
   * card thumbnail's watch link), so the team name is the click target.
   */
  raised?: boolean
  className?: string
  children: ReactNode
}

export function TeamNameLink({ team, ranking, onSearch, title, raised, className, children }: TeamNameLinkProps) {
  const href = videoTeamHref(team, ranking)
  const classes = cn(raised && "relative z-20", className)
  if (href) {
    return (
      <Link
        href={href}
        title={title ?? `${team} — team page`}
        data-team-link=""
        className={classes}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </Link>
    )
  }
  if (onSearch) {
    return (
      <button
        type="button"
        title={`Search for ${team}`}
        className={classes}
        onClick={(e) => {
          e.stopPropagation()
          onSearch(team)
        }}
      >
        {children}
      </button>
    )
  }
  return <span className={className}>{children}</span>
}
