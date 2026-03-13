"use client"

import { Card, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import React, { useState } from "react"
import Image from "next/image"
import { Play, Star, Calendar, Eye, Volume2, MoreHorizontal, ListVideo, Flag, EyeOff, Eye as EyeIcon, ExternalLink } from "lucide-react"
import type { TopicType } from "@/lib/types/videos"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { STYLE_COLORS, DEBATE_STYLE_LABELS, getRoundBadgeColor, getYearTopic } from "./videoCardUtils"
import { ReportDialog, HideConfirmDialog } from "./VideoCardDialogs"
import type { VideoType } from "@/lib/types/videos"

export interface VideoCardProps {
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

export function VideoCard({ video, showThumbnails, topics, isFavorite, onToggleFavorite, onBadgeClick, onHideVideo, onUnhideVideo, isHidden, isTopPick }: VideoCardProps) {
  const [videoId, title, date, channel, viewCount, description, style, tournament, roundLevel, affTeam, negTeam] = video
  const { activeVideoId, setActiveVideo, addToQueue, queue } = useVideoPlayerStore()
  const isPlaying = activeVideoId === videoId
  const isInQueue = queue.some((q) => q.videoId === videoId)

  const year = new Date(date).getFullYear();
  const videoMeta = { style, tournament, year, affTeam, negTeam }

  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showHideConfirm, setShowHideConfirm] = useState(false)

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

  const styleBadge = style && DEBATE_STYLE_LABELS[style] ? (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] [font-variant:small-caps]  uppercase tracking-wide ${STYLE_COLORS[style] ?? "bg-muted text-muted-foreground"}`}>
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
          onClick={() => addToQueue(videoId, title, videoMeta)}
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

  const cleanTournament = tournament?.replace(/\d+/g, '').trim();
  const yearTopic = getYearTopic(year, style, topics);

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
              onClick={() => !isPlaying && setActiveVideo(videoId, title, videoMeta)}
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
                  {styleBadge}

                  {cleanTournament && (
                    <span
                      className="text-sm font-bold text-purple-600 dark:text-purple-400 cursor-pointer hover:underline [font-variant:small-caps] tracking-wider"
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
                          className="border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-900/40 dark:text-orange-300 text-sm px-1.5 py-0 font-bold cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
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
                          "text-sm font-semibold cursor-pointer transition-colors flex items-center gap-1 px-1.5 py-0",
                          getRoundBadgeColor(roundLevel)
                        )}
                        onClick={(e) => { e.stopPropagation(); onBadgeClick(roundLevel); }}
                      >
                        {roundLevel}
                      </Badge>
                    </>
                  )}

                  {hasTeams && (
                    <div className="flex items-center text-sm gap-2 font-semibold">
                      {affTeam && <span className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onBadgeClick(affTeam); }}>{affTeam}</span>}
                      {negTeam && <span className="text-red-600 dark:text-red-400 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onBadgeClick(negTeam); }}>{negTeam}</span>}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-start justify-between gap-2 mb-2">
              {!hasFullMetadata ? (
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
              ) : (
                <div className="flex-1" />
              )}

            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <button
                onClick={(e) => { e.stopPropagation(); onBadgeClick(channel); }}
                className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[100px] text-left"
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
                <span>{new Date(date).toLocaleDateString("en-US", { month: "short" })}</span>
              </div>

              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:text-primary transition-colors"
                title={`Watch "${title}" on YouTube`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              {actionsDropdown}
            </div>
            <CardDescription className="text-xs line-clamp-2 mb-3 flex-1">{description}</CardDescription>

          </div>
        </Card>

        <ReportDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          videoId={videoId}
          title={title}
        />

        <HideConfirmDialog
          open={showHideConfirm}
          onOpenChange={setShowHideConfirm}
          onConfirm={() => onHideVideo(videoId)}
        />
      </div>
    </TooltipProvider>
  )
}