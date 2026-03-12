/**
 * @fileoverview Video grid display component
 * @module components/debate/videos/components/VideoGrid
 */

"use client"

import { Card, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import React, { useState } from "react"
import Image from "next/image"
import { Play, Star, Calendar, Eye, Volume2, MoreHorizontal, ListVideo, Flag, EyeOff, Eye as EyeIcon, ExternalLink, Medal } from "lucide-react"
import type { VideoType, TopicType } from "@/lib/types/videos"
import { DEBATE_STYLE_LABELS } from "@/lib/types/videos"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * Props for the VideoGrid component.
 */
interface VideoGridProps {
  /** Ordered list of video tuples to render. */
  videos: VideoType[]
  /** Whether thumbnail images should be displayed on each card. */
  showThumbnails: boolean
  /** Topics data to display year tooltips */
  topics?: TopicType[]
  /** Ref attached to the grid wrapper element for scroll targeting. */
  videoContainerRef: React.RefObject<HTMLDivElement | null>
  /** Set of favorited video IDs. */
  favorites: Set<string>
  /** Callback to toggle a video as favorite. */
  onToggleFavorite: (videoId: string) => void
  /** Callback when a badge, channel, or team is clicked to filter by that text. */
  onBadgeClick: (text: string) => void
  /** Callback to hide a video. */
  onHideVideo: (videoId: string) => void
  /** Callback to unhide a video. */
  onUnhideVideo: (videoId: string) => void
  /** Set of hidden video IDs. */
  hiddenVideos: Set<string>
  /** Set of top pick video IDs. */
  topPicks?: Set<string>
}

/**
 * Renders a responsive grid of video cards.
 */
export function VideoGrid({ videos, showThumbnails, topics, videoContainerRef, favorites, onToggleFavorite, onBadgeClick, onHideVideo, onUnhideVideo, hiddenVideos, topPicks }: VideoGridProps) {
  return (
    <div
      ref={videoContainerRef}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"
    >
      {videos.map((video, index) => (
        <VideoCard
          key={`${video[0]}-${index}`}
          video={video}
          showThumbnails={showThumbnails}
          topics={topics}
          isFavorite={favorites.has(video[0])}
          onToggleFavorite={onToggleFavorite}
          onBadgeClick={onBadgeClick}
          onHideVideo={onHideVideo}
          onUnhideVideo={onUnhideVideo}
          isHidden={hiddenVideos.has(video[0])}
          isTopPick={topPicks?.has(video[0]) || false}
        />
      ))}
    </div>
  )
}

/**
 * Props for the VideoCard component.
 */
interface VideoCardProps {
  video: VideoType
  showThumbnails: boolean
  topics?: TopicType[]
  isFavorite: boolean
  onToggleFavorite: (videoId: string) => void
  onBadgeClick: (text: string) => void
  onHideVideo: (videoId: string) => void
  onUnhideVideo: (videoId: string) => void
  isHidden: boolean
  isTopPick: boolean
}

const STYLE_COLORS: Record<number, string> = {
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  3: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  1: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  4: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
}

/**
 * Renders a single linked video card with thumbnail, title, channel, metadata,
 * a style/format badge, and an ellipsis menu with queue, report, and hide actions.
 */
function VideoCard({ video, showThumbnails, topics, isFavorite, onToggleFavorite, onBadgeClick, onHideVideo, onUnhideVideo, isHidden, isTopPick }: VideoCardProps) {
  const [videoId, title, date, channel, viewCount, description, style, tournament, roundLevel, affTeam, negTeam] = video
  const { activeVideoId, setActiveVideo, addToQueue, queue } = useVideoPlayerStore()
  const isPlaying = activeVideoId === videoId
  const isInQueue = queue.some((q) => q.videoId === videoId)

  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportText, setReportText] = useState("")
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [showHideConfirm, setShowHideConfirm] = useState(false)

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

  const handleReport = () => {
    // Store report in localStorage for now
    try {
      const existing = JSON.parse(localStorage.getItem("debateVideoReports") || "[]")
      existing.push({ videoId, title, report: reportText, date: new Date().toISOString() })
      localStorage.setItem("debateVideoReports", JSON.stringify(existing))
    } catch { }
    setReportSubmitted(true)
    setTimeout(() => {
      setShowReportDialog(false)
      setReportText("")
      setReportSubmitted(false)
    }, 1500)
  }

  const styleBadge = style && DEBATE_STYLE_LABELS[style] ? (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${STYLE_COLORS[style] ?? "bg-muted text-muted-foreground"}`}>
      {DEBATE_STYLE_LABELS[style]}
    </span>
  ) : null

  const actionsDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => onToggleFavorite(videoId)}
          className={`gap-2 ${isFavorite ? "text-amber-600 dark:text-amber-400" : ""}`}
        >
          <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
          {isFavorite ? "Remove from favorites" : "Save to favorites"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => addToQueue(videoId, title)}
          disabled={isInQueue}
          className="gap-2"
        >
          <ListVideo className="h-4 w-4" />
          {isInQueue ? "In queue" : "Add to queue"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setShowReportDialog(true)}
          className="gap-2 text-orange-600 dark:text-orange-400"
        >
          <Flag className="h-4 w-4" />
          Report issue
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isHidden ? (
          <DropdownMenuItem
            onClick={() => onUnhideVideo(videoId)}
            className="gap-2"
          >
            <EyeIcon className="h-4 w-4" />
            Unhide
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => setShowHideConfirm(true)}
            className="gap-2 text-destructive"
          >
            <EyeOff className="h-4 w-4" />
            Hide video
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );


  const hasTeams = affTeam || negTeam;
  const hasFullMetadata = Boolean(tournament && affTeam && negTeam);

  const getRoundBadgeColor = (roundLevel: string) => {
    const round = roundLevel.toLowerCase().trim();
    if (round === "finals" || round === "final" || round === "champ" || round === "1st") {
      // Golden - Finals
      return "border-amber-400 bg-amber-400 text-amber-950 dark:border-amber-500 dark:bg-amber-600 dark:text-amber-50 hover:bg-amber-500 dark:hover:bg-amber-500";
    }
    if (round.includes("semi")) {
      // Warm Yellow - Semis
      return "border-yellow-400 bg-yellow-400 text-yellow-950 dark:border-yellow-500 dark:bg-yellow-500 dark:text-yellow-50 hover:bg-yellow-500 dark:hover:bg-yellow-400";
    }
    if (round.includes("quarter")) {
      // Bright Yellow - Quarters
      return "border-yellow-300 bg-yellow-300 text-yellow-900 dark:border-yellow-400 dark:bg-yellow-400 dark:text-yellow-950 hover:bg-yellow-400 dark:hover:bg-yellow-300";
    }
    if (round.includes("octo")) {
      // Soft Yellow - Octos
      return "border-yellow-200 bg-yellow-200 text-yellow-800 dark:border-yellow-300 dark:bg-yellow-300 dark:text-yellow-900 hover:bg-yellow-300 dark:hover:bg-yellow-200";
    }
    if (round.includes("double") || round.includes("triple")) {
      // Very Light Yellow - Other Elims
      return "border-yellow-100 bg-yellow-50 text-yellow-700 dark:border-yellow-200 dark:bg-yellow-100 dark:text-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-50";
    }
    // Default (Round 1, 2, etc): Lightest amber/yellow
    return "border-amber-100 bg-amber-50/50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40";
  }

  const year = new Date(date).getFullYear();
  const cleanTournament = tournament?.replace(/\d+/g, '').trim();
  let yearTopic: string | undefined = undefined;
  if (year && topics) {
    const topicEntry = topics.find((t) => Number(t.year) === year);
    if (topicEntry) {
      if (style === 1) yearTopic = topicEntry.policy_topic;
      else if (style === 2) yearTopic = topicEntry.ld_topic;
      else if (style === 3) yearTopic = topicEntry.pf_topic;
      else if (style === 4) yearTopic = topicEntry.ndt_topic;
    }
  }

  return (
    <TooltipProvider>
      <div className="block h-full relative group/card">

        <Card className={`overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full relative ${isPlaying ? "ring-2 ring-primary" : ""} ${isHidden ? "opacity-60 ring-2 ring-dashed ring-muted-foreground/50" : ""}`}>
          {isHidden && (
            <div className="absolute top-1 left-1 z-10">
              <span className="text-[9px] bg-muted/90 text-muted-foreground px-1.5 py-0.5 rounded font-medium">Hidden</span>
            </div>
          )}
          {showThumbnails && (
            <div
              className="relative w-full pt-[56.25%] bg-muted cursor-pointer"
              onClick={() => !isPlaying && setActiveVideo(videoId, title)}
            >
              <Image
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
              {isPlaying ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="flex items-center gap-2 text-white text-sm font-medium">
                    <Volume2 className="h-5 w-5 animate-pulse" />
                    <span>Now playing</span>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity bg-black/30">
                  <div className="bg-black/70 rounded-full p-3">
                    <Play className="h-6 w-6 text-white fill-white" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-4 flex-1 flex flex-col">

            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium leading-tight">
              {isTopPick && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xl cursor-default" role="img" aria-label="Top Pick">🎖️</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Top Pick</TooltipContent>
                </Tooltip>
              )}
              {hasFullMetadata && (
                <>
                  {cleanTournament && (
                    <span
                      className="text-[11px] font-bold text-purple-600 dark:text-purple-400 cursor-pointer hover:underline uppercase tracking-wider"
                      onClick={(e) => { e.stopPropagation(); onBadgeClick(cleanTournament); }}
                    >
                      {cleanTournament}
                    </span>
                  )}

                  {year && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-900/40 dark:text-orange-300 text-[10px] px-1.5 py-0 font-bold cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
                          onClick={(e) => { e.stopPropagation(); onBadgeClick(String(year)); }}
                        >
                          '{String(year).slice(-2)}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {yearTopic || `${year} Season`}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {roundLevel && !/\d/.test(roundLevel) && (
                    <>
                      {(roundLevel.toLowerCase().trim() === "finals" || roundLevel.toLowerCase().trim() === "final") && <span className="text-sm mr-[-4px]">🏆</span>}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold cursor-pointer transition-colors flex items-center gap-1 px-1.5 py-0",
                          getRoundBadgeColor(roundLevel)
                        )}
                        onClick={(e) => { e.stopPropagation(); onBadgeClick(roundLevel); }}
                      >
                        {roundLevel}
                      </Badge>
                    </>
                  )}

                  {hasTeams && (
                    <div className="flex items-center text-[11px] gap-2 font-semibold">
                      {affTeam && <span className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onBadgeClick(affTeam); }}>{affTeam}</span>}
                      {negTeam && <span className="text-red-600 dark:text-red-400 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onBadgeClick(negTeam); }}>{negTeam}</span>}
                    </div>
                  )}
                </>
              )}
              {styleBadge}
            </div>

            <div className="flex items-start justify-between gap-2 mb-2">
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="group/link flex-1 min-w-0"
                title={`Watch "${title}" on YouTube`}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <h3 className="text-base font-semibold text-foreground line-clamp-2 group-hover/link:text-primary transition-colors">
                    {title}
                  </h3>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover/link:text-primary transition-colors shrink-0" />
                </div>
              </a>
              <div className="flex items-center gap-1 shrink-0">
                {actionsDropdown}
              </div>
            </div>
            <CardDescription className="text-xs line-clamp-2 mb-3 flex-1">{description}</CardDescription>

            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <button
                onClick={(e) => { e.stopPropagation(); onBadgeClick(channel); }}
                className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[140px] text-left"
                title={`Filter by ${channel}`}
              >
                {channel}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <Eye className="h-3 w-3" />
                <span>{viewCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Calendar className="h-3 w-3" />
                <span>{new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Report issue dialog */}
        <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-orange-500" />
                Report issue
              </DialogTitle>
            </DialogHeader>
            {reportSubmitted ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Thanks — report submitted.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Describe the issue with <span className="font-medium text-foreground">{title}</span>:
                </p>
                <Textarea
                  placeholder="Wrong category, broken link, inappropriate content..."
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="min-h-[80px]"
                />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowReportDialog(false)}>Cancel</Button>
                  <Button onClick={handleReport} disabled={!reportText.trim()}>Submit</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Hide confirm dialog */}
        <Dialog open={showHideConfirm} onOpenChange={setShowHideConfirm}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Hide this video?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This video will be hidden from the list. You can still find it by searching, and unhide it from the menu.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowHideConfirm(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onHideVideo(videoId)
                  setShowHideConfirm(false)
                }}
              >
                Hide
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
