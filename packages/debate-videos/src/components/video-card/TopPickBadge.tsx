/**
 * @fileoverview Top Pick badge component with Greatest of All Time (GOAT) Hall of Fame tooltip.
 * @module components/debate/DebateVideos/components/video-card/TopPickBadge
 */

"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import { getTopPickBadgeInfo, type TopPickBadgeInfo } from "../../lib/topPickBadges"
import { cn } from "../../ui/lib/utils"

export interface TopPickBadgeProps {
  /** YouTube video ID used for badge lookup. */
  videoId: string
  /** Affirmative team name override. */
  affTeam?: string | null
  /** Negative team name override. */
  negTeam?: string | null
  /** Video title override. */
  title?: string | null
  /** Tournament name override. */
  tournament?: string | null
  /** Publication or event year override. */
  year?: number | null
  /** Round level (e.g. "Finals") override. */
  roundLevel?: string | null
  /** Visual size variant for the trigger badge. */
  size?: "sm" | "md" | "lg"
  /** Additional CSS class names for the trigger element. */
  className?: string
  /** Optional custom trigger content (defaults to 🎖️ emoji). */
  children?: React.ReactNode
}

/**
 * Top Pick badge that renders a medal icon and shows a rich tooltip on hover
 * declaring the video as "Greatest of All Time" and listing its teams as
 * "Hall of Fame Debaters" with their chronological badge number (#001 onwards).
 */
export function TopPickBadge({
  videoId,
  affTeam,
  negTeam,
  title,
  tournament,
  year,
  roundLevel,
  size = "md",
  className,
  children,
}: TopPickBadgeProps) {
  const badgeInfo: TopPickBadgeInfo = React.useMemo(() => {
    return getTopPickBadgeInfo(videoId, {
      affTeam,
      negTeam,
      title,
      tournament,
      year,
      roundLevel,
    })
  }, [videoId, affTeam, negTeam, title, tournament, year, roundLevel])

  const effectiveAff = badgeInfo.affTeam || affTeam
  const effectiveNeg = badgeInfo.negTeam || negTeam
  const effectiveTournament = badgeInfo.tournament || tournament
  const effectiveYear = badgeInfo.year || year
  const effectiveRound = badgeInfo.roundLevel || roundLevel

  // Clean tournament year prefix if present
  const cleanTournament = effectiveTournament
    ? effectiveTournament.replace(/^\s*(19|20)\d{2}\s+/, "").trim()
    : null

  const sizeClasses = {
    sm: "p-1 text-sm rounded hover:bg-amber-500/20",
    md: "px-2 py-1 rounded text-base backdrop-blur-md bg-amber-500/80 border border-amber-300/90 shadow-lg hover:scale-105",
    lg: "px-2.5 py-1.5 rounded text-xl backdrop-blur-md bg-amber-500/80 border border-amber-300/90 shadow-lg hover:scale-105",
  }

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center justify-center cursor-help select-none transition-transform",
            sizeClasses[size],
            className,
          )}
          aria-label={`Top pick ${badgeInfo.badgeNumber}: Greatest of All Time`}
          onClick={(e) => {
            // Prevent parent card playback click when interacting with badge
            e.stopPropagation()
          }}
        >
          {children ?? "🎖️"}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="z-50 w-72 p-3 bg-slate-950/95 text-slate-100 border border-amber-500/40 rounded-lg shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
      >
        <div className="flex flex-col gap-2">
          {/* Header row: Badge Number & Greatest of All Time */}
          <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
            <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-full shadow-sm">
              🎖️ {badgeInfo.badgeNumber}
            </span>
            <span className="text-xs font-bold tracking-tight text-amber-200">
              Greatest of All Time
            </span>
          </div>

          {/* Hall of Fame Debaters Section */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider">
              <span>🏆</span>
              <span>Hall of Fame Debaters</span>
            </div>

            {effectiveAff || effectiveNeg ? (
              <div className="flex flex-col gap-1 text-xs">
                {effectiveAff && (
                  <div className="flex items-center justify-between gap-2 bg-blue-950/70 border border-blue-700/50 rounded px-2 py-1">
                    <span className="font-semibold text-blue-100 truncate">
                      {effectiveAff}
                    </span>
                    <span className="text-[10px] font-bold text-blue-300 bg-blue-900/80 px-1.5 py-0.2 rounded shrink-0">
                      AFF
                    </span>
                  </div>
                )}
                {effectiveNeg && (
                  <div className="flex items-center justify-between gap-2 bg-red-950/70 border border-red-700/50 rounded px-2 py-1">
                    <span className="font-semibold text-red-100 truncate">
                      {effectiveNeg}
                    </span>
                    <span className="text-[10px] font-bold text-red-300 bg-red-900/80 px-1.5 py-0.2 rounded shrink-0">
                      NEG
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-300 line-clamp-2 italic">
                {badgeInfo.title || title || "Curated Top Pick Round"}
              </div>
            )}
          </div>

          {/* Context footer: tournament, round, year */}
          {(cleanTournament || effectiveYear || effectiveRound) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
              {effectiveYear && (
                <span className="text-amber-300/90 font-medium">'{String(effectiveYear).slice(-2)}</span>
              )}
              {cleanTournament && (
                <span>• {cleanTournament}</span>
              )}
              {effectiveRound && (
                <span>• {effectiveRound}</span>
              )}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
