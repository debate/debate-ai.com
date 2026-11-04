/**
 * @fileoverview The group rows of the list layout and the recursion that
 * draws a tree of them — a season opens onto its tournaments, a tournament
 * onto its rounds, a round onto the videos themselves.
 *
 * A group is open or closed on its own state, seeded from the table's
 * collapse level: a row at depth `d` starts open when `d + 1 < collapseDepth`.
 * The table remounts these rows when that level changes (the level is part of
 * their React key), which is what makes the header's `L1 … L4` control move
 * every group at once while still letting a single row be toggled afterwards.
 * @module components/video-grid/VideoTreeRows
 */

"use client"

import { useState } from "react"
import { CalendarRange, ChevronRight, Medal, Tag, Trophy, Tv } from "lucide-react"
import { cn } from "../../../ui/lib/utils"
import { DEBATE_STYLE_LABELS, formatVideoDate, TOC_TOURNAMENT_IMAGE } from "../card/videoCardUtils"
import { getTournamentBadge, getTournamentLogo } from "../card/tournamentLogos"
import { TournamentNameBadge } from "../card/TournamentNameBadge"
import { ViewCount } from "@debate-ai/rankings/src/view-count"
import { VideoListRow } from "./VideoListRow"
import { FormatBadge, videoFormat } from "./FormatBadge"
import type { VideoTeamRankingLookup } from "../../../hooks/useVideoTeamRankings"
import { treeIndentStyle } from "./tree-indent"
import type { VideoGroupKind, VideoTreeGroup, VideoTreeLeaf, VideoTreeNode } from "./video-tree"
import type { TopicType, VideoType } from "../../../types/videos"
import { isTopPickVideo } from "../../../lib/topPickBadges"
import { getSeasonTopicItems, shortTopicName, type TopicItem } from "@debate-ai/rankings/src/topics/debate-topics"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../ui/primitives/tooltip"

/** Icon per group level, so the depth reads without counting indents. */
const GROUP_ICONS: Record<VideoGroupKind, typeof Trophy> = {
  season: CalendarRange,
  tournament: Trophy,
  round: Medal,
  channel: Tv,
  category: Tag,
}

/** What the rows below a group are called, for its screen-reader label. */
const GROUP_KIND_LABELS: Record<VideoGroupKind, string> = {
  season: "season",
  tournament: "tournament",
  round: "round",
  channel: "channel",
  category: "category",
}

/** Everything the leaves need that the tree itself does not carry. */
export interface VideoTreeRowContext {
  isRoundMode: boolean
  /** Adds the history listing's "Last watched" cell to every row. */
  showWatched?: boolean
  showThumbnails: boolean
  favorites: Set<string>
  hiddenVideos: Set<string>
  topPicks?: Set<string>
  /** Which member of each stacked playlist its row is showing, by slot key. */
  stackSelection: Record<string, number>
  onStackSelect: (slotKey: string, index: number) => void
  onToggleFavorite: (videoId: string) => void
  onHideVideo: (videoId: string) => void
  onUnhideVideo: (videoId: string) => void
  /** Searches the library for a clicked team name. */
  onSearch?: (text: string) => void
  /** Badges each tournament name with its debate format, for listings that
   *  mix formats (Top Picks). */
  showFormat?: boolean
  /** The rankings row behind a team label, for the team-page link and rating. */
  teamRanking?: VideoTeamRankingLookup
  /** Debate topics by year, for the topic name beside each season. */
  topics?: TopicType[]
}

/** The distinct formats of every video below a group, in label order. */
function groupFormats(group: VideoTreeGroup): number[] {
  const formats = new Set<number>()
  const visit = (node: VideoTreeNode) => {
    if (node.type === "group") node.children.forEach(visit)
    else
      for (const video of node.slot.videos) {
        const format = videoFormat(video)
        if (format !== undefined) formats.add(format)
      }
  }
  visit(group)
  return [...formats].sort((a, b) => a - b)
}

/**
 * The school/tournament logo that rides on a tournament group row — the same
 * lookup the card grid uses, so a round-robin (e.g. "Greenhill RR") shows
 * Greenhill's logo for the school name it found after dropping the "RR".
 * When a logo exists it stands in for the name: it is drawn at the height of
 * the row's text, and the name moves to its alt text and tooltip.
 */
function TournamentLogo({
  logo,
  label,
}: {
  logo: NonNullable<ReturnType<typeof getTournamentLogo>>
  label: string
}) {
  const className = "h-5 w-auto max-w-[10rem] shrink-0 object-contain"
  if (typeof logo === "function") {
    const Logo = logo
    return (
      <span role="img" aria-label={label} title={label} className="inline-flex shrink-0">
        <Logo className={className} aria-hidden />
      </span>
    )
  }
  const src = typeof logo === "string" ? logo : logo.src
  return <img src={src} alt={label} title={label} className={className} />
}

/**
 * The formats a mixed listing (Greatest of All Time) lines up beside each
 * season: high school policy, college policy, PF and LD, in that order.
 */
const MIXED_SEASON_FORMATS = [1, 4, 2, 3] as const

/** A season's resolutions for one format, short names inline and every
 *  resolution in full on hover. */
function SeasonTopicLabel({
  items,
  style,
  className,
}: {
  items: TopicItem[]
  /** Draws the format chip in front, for a row that lists several formats. */
  style?: number
  className?: string
}) {
  const label = items.map((item) => shortTopicName(item)).join(" · ")
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("flex min-w-0 items-center gap-1", className)}
          data-testid={style === undefined ? undefined : "season-topic"}
        >
          {style !== undefined && <FormatBadge style={style} />}
          <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-sm">
        {style !== undefined && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
            {DEBATE_STYLE_LABELS[style as keyof typeof DEBATE_STYLE_LABELS]}
          </div>
        )}
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li key={index}>
              {(item.title || item.month) && (
                <div className="font-semibold">
                  {[item.month, item.title].filter(Boolean).join(": ")}
                </div>
              )}
              <div className="whitespace-pre-line">{item.text}</div>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The topic beside a season's "14-15" label. A season of one format names
 * that format's topic (LD and PF list each of theirs in order). A season
 * mixing formats (Greatest of All Time) lines up the season's high school
 * policy, college policy, PF and LD topics side by side, each behind its
 * format chip and cut short, with the full resolutions on hover.
 */
function SeasonTopic({ group, topics }: { group: VideoTreeGroup; topics?: TopicType[] }) {
  const formats = groupFormats(group)
  if (formats.length === 1) {
    const items = getSeasonTopicItems(topics, group.seasonYear, formats[0])
    if (items.length === 0) return null
    return <SeasonTopicLabel items={items} className="max-w-[18rem]" />
  }
  const columns = MIXED_SEASON_FORMATS.map((style) => ({
    style,
    items: getSeasonTopicItems(topics, group.seasonYear, style),
  })).filter((column) => column.items.length > 0)
  if (columns.length === 0) return null
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
      {columns.map(({ style, items }) => (
        <SeasonTopicLabel key={style} items={items} style={style} className="max-w-[11rem] shrink" />
      ))}
    </span>
  )
}


function GroupRows({
  group,
  depth,
  collapseDepth,
  context,
}: {
  group: VideoTreeGroup
  depth: number
  collapseDepth: number
  context: VideoTreeRowContext
}) {
  const [isOpen, setIsOpen] = useState(depth + 1 < collapseDepth)
  const Icon = GROUP_ICONS[group.kind]
  const tournamentLogo = group.kind === "tournament" ? getTournamentLogo(group.label) : null
  // A tournament drawn with its host school's logo (Shirley → Wake Forest)
  // names itself in a badge, so the logo isn't read as the school's own.
  const tournamentBadge = tournamentLogo ? getTournamentBadge(group.label) : null

  return (
    <>
      <tr
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "cursor-pointer select-none border-b border-border transition-colors",
          depth === 0 ? "bg-muted/60 hover:bg-muted" : "bg-muted/25 hover:bg-muted/50",
        )}
      >
        <td className="py-2 pr-3 align-middle" style={treeIndentStyle(depth)}>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${GROUP_KIND_LABELS[group.kind]} ${group.label}`}
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen((open) => !open)
            }}
            className="flex w-full items-center gap-2 text-left"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-90",
              )}
            />
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {group.kind === "tournament" && group.label === "TOC" ? (
              <img
                src={TOC_TOURNAMENT_IMAGE}
                alt="Tournament of Champions"
                className="h-4 w-auto object-contain shrink-0"
              />
            ) : group.kind === "tournament" ? (
              <span className="flex items-center gap-1.5">
                {tournamentLogo ? (
                  <TournamentLogo logo={tournamentLogo} label={group.label} />
                ) : (
                  <span
                    className={cn(
                      "truncate font-semibold",
                      depth === 0 ? "text-sm text-foreground" : "text-sm text-primary",
                    )}
                  >
                    {group.label}
                  </span>
                )}
                {tournamentBadge && <TournamentNameBadge label={tournamentBadge} />}
                {group.roundRobin && <TournamentNameBadge label="RR" />}
              </span>
            ) : (
              <span
                className={cn(
                  "truncate font-semibold",
                  depth === 0 ? "text-sm text-foreground" : "text-sm text-primary",
                )}
              >
                {group.label}
              </span>
            )}
            {group.kind === "season" && <SeasonTopic group={group} topics={context.topics} />}
            {context.showFormat &&
              group.kind === "tournament" &&
              groupFormats(group).map((format) => <FormatBadge key={format} style={format} />)}
            <span className="shrink-0 rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {group.videoCount}
            </span>
          </button>
        </td>

        {/* The matchup columns stay empty on a group row: a tournament has no
            Aff and no Neg. Spanned rather than split so every row in the
            table still has exactly as many cells as there are headers. */}
        {context.isRoundMode && <td colSpan={2} />}

        <td className="px-3 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">
          {group.latestDate ? formatVideoDate(group.latestDate, "full", "—") : "—"}
        </td>
        <td className="px-3 py-2 align-middle text-xs text-muted-foreground text-right tabular-nums whitespace-nowrap">
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
            <ViewCount views={group.viewCount} />
          </span>
        </td>
        {context.showWatched && <td />}
      </tr>

      {isOpen &&
        group.children.map((child) => (
          <VideoTreeRows
            key={`${collapseDepth}-${child.key}`}
            node={child}
            depth={depth + 1}
            collapseDepth={collapseDepth}
            context={context}
          />
        ))}
    </>
  )
}

/**
 * Draws one node of the tree — a group and, when it is open, everything
 * under it, or a single video row.
 */
export function VideoTreeRows({
  node,
  depth,
  collapseDepth,
  context,
}: {
  node: VideoTreeNode
  depth: number
  collapseDepth: number
  context: VideoTreeRowContext
}) {
  if (node.type === "group") {
    return (
      <GroupRows group={node} depth={depth} collapseDepth={collapseDepth} context={context} />
    )
  }

  const { slot } = node
  const leafWithIndex = node as { index: number } & VideoTreeLeaf
  const selected = context.stackSelection[slot.key] ?? slot.initialIndex
  const stackIndex = Math.min(Math.max(selected, 0), slot.videos.length - 1)
  const video: VideoType = slot.videos[stackIndex]

  return (
    <VideoListRow
      video={video}
      depth={depth}
      stackVideos={slot.videos}
      stackIndex={stackIndex}
      onStackSelect={(next) => context.onStackSelect(slot.key, next)}
      isFavorite={context.favorites.has(video[0])}
      isHidden={context.hiddenVideos.has(video[0])}
      isTopPick={isTopPickVideo(video, context.topPicks)}
      isRoundMode={context.isRoundMode}
      showWatched={context.showWatched}
      showThumbnails={context.showThumbnails}
      onToggleFavorite={context.onToggleFavorite}
      onHideVideo={context.onHideVideo}
      onUnhideVideo={context.onUnhideVideo}
      onSearch={context.onSearch}
      showFormat={context.showFormat}
      affRanking={context.teamRanking?.(video, video[9]) ?? null}
      negRanking={context.teamRanking?.(video, video[10]) ?? null}
    />
  )
}
