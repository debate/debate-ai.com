"use client"
import { GlowingEffect } from "@/components/ui/glowing-effect"

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

        <Card className={`overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full relative p-0 ${isPlaying ? "ring-2 ring-primary" : ""} ${isHidden ? "opacity-60 ring-2 ring-dashed ring-muted-foreground/50" : ""}`}>
          <GlowingEffect
            spread={80}
            glow={false}
            disabled={false}
            proximity={200}
            inactiveZone={0.3}
            borderWidth={3}
            blur={2}
            movementDuration={0.5}
          />

          {isHidden && (
            <div className="absolute top-1 left-1 z-10">
              <span className="text-[9px] bg-muted/90 text-muted-foreground py-0.5 rounded font-medium">Hidden</span>
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
                className="rounded object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />

              {/* Title overlay */}
              <div className="absolute inset-0 flex items-center justify-center p-3">
                <div className="max-w-[90%]">
                  {hasFullMetadata ? (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {isTopPick && <span className="text-xl">🎖️</span>}
                      {style && DEBATE_STYLE_LABELS[style] && (
                        <span className={`inline-flex items-center px-2 py-1 rounded text-sm [font-variant:small-caps] uppercase tracking-wide backdrop-blur-md ${STYLE_COLORS[style] ?? "bg-muted text-muted-foreground"}`}>
                          {DEBATE_STYLE_LABELS[style]}
                        </span>
                      )}
                      {cleanTournament && (
                        <span className="text-base font-bold text-purple-300 backdrop-blur-md bg-purple-900/80 border border-purple-400/90 px-2 py-1 rounded [font-variant:small-caps] tracking-wider shadow-lg">
                          {cleanTournament}
                        </span>
                      )}
                      {year && (
                        <span className="text-base font-bold text-orange-300 backdrop-blur-md bg-orange-900/80 border border-orange-400/90 px-2 py-1 rounded shadow-lg">
                          '{String(year).slice(-2)}
                        </span>
                      )}
                      {roundLevel && !/\d/.test(roundLevel) && (
                        <>
                          {(roundLevel.toLowerCase().trim() === "finals" || roundLevel.toLowerCase().trim() === "final") && <span className="text-base">🏆</span>}
                          <span className={cn(
                            "text-sm font-semibold px-2 py-1 rounded border backdrop-blur-md shadow-lg",
                            getRoundBadgeColor(roundLevel)
                          )}>
                            {roundLevel}
                          </span>
                        </>
                      )}
                      {hasTeams && (
                        <>
                          {affTeam && <span className="text-base font-bold text-blue-300 backdrop-blur-md bg-blue-900/80 border border-blue-400/90 px-2 py-1 rounded shadow-lg">{affTeam}</span>}
                          {negTeam && <span className="text-base font-bold text-red-300 backdrop-blur-md bg-red-900/80 border border-red-400/90 px-2 py-1 rounded shadow-lg">{negTeam}</span>}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      {isTopPick && <span className="text-2xl">🎖️</span>}
                      <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="group/link block text-center"
                        title={`Watch "${title}" on YouTube`}
                      >
                        <div className="backdrop-blur-md bg-white/90 border border-white px-3 py-2 rounded-lg shadow-lg">
                          <h3 className="text-base font-semibold text-blue-600 line-clamp-3 group-hover/link:text-blue-800 transition-colors">
                            {title}
                          </h3>
                        </div>
                      </a>
                    </div>
                  )}
                </div>
              </div>

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

          <div className="px-2 pb-1.5 pt-0 flex-1 flex flex-col">
            {/* Badges now displayed on thumbnail - removed from here */}

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
    </TooltipProvider >
  )
}