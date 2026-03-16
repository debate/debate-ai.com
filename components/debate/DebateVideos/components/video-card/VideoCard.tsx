"use client"
import { GlowingEffect } from "@/components/ui/glowing-effect"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import React, { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Play, Star, Calendar, Eye, Volume2, ListVideo, EyeOff, Eye as EyeIcon, ExternalLink, Scale } from "lucide-react"
import type { TopicType } from "@/lib/types/videos"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"
import { cn } from "@/lib/utils"
import { STYLE_COLORS, DEBATE_STYLE_LABELS, TOURNAMENT_COLORS, getRoundBadgeColor, getYearTopic } from "./videoCardUtils"
import { HideConfirmDialog } from "./VideoCardDialogs"
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
  showFullDate?: boolean
  showDescription?: boolean
}

export function VideoCard({ video, showThumbnails, topics, isFavorite, onToggleFavorite, onBadgeClick, onHideVideo, onUnhideVideo, isHidden, isTopPick, showFullDate = false, showDescription = false }: VideoCardProps) {
  const [videoId, title, date, channel, viewCount, description, style, tournament, roundLevel, affTeam, negTeam, affWin, judgeDecision, arg1AC, arg2NR] = video
  const { activeVideoId, setActiveVideo, addToQueue, queue } = useVideoPlayerStore()
  const isPlaying = activeVideoId === videoId
  const isInQueue = queue.some((q) => q.videoId === videoId)

  const year = new Date(date).getFullYear();
  const videoMeta = { style, tournament, year, affTeam, negTeam }

  const [showHideConfirm, setShowHideConfirm] = useState(false)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const thumbnailContainerRef = useRef<HTMLDivElement>(null)

  // Mutation observer to detect failed image loads
  useEffect(() => {
    if (!showThumbnails || !thumbnailContainerRef.current) return

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          const target = mutation.target as HTMLImageElement
          // Check if image has error state or broken src
          if (target.tagName === 'IMG') {
            const checkImage = () => {
              if (target.complete && target.naturalHeight === 0) {
                setThumbnailFailed(true)
              }
            }
            checkImage()
            target.addEventListener('error', () => setThumbnailFailed(true), { once: true })
          }
        }
      })
    })

    // Also observe child additions to catch Next.js Image component loading
    const imgObserver = new MutationObserver(() => {
      const imgs = thumbnailContainerRef.current?.querySelectorAll('img')
      imgs?.forEach((img) => {
        if (img.complete && img.naturalHeight === 0) {
          setThumbnailFailed(true)
        }
        img.addEventListener('error', () => setThumbnailFailed(true), { once: true })
      })
    })

    observer.observe(thumbnailContainerRef.current, {
      attributes: true,
      subtree: true,
      attributeFilter: ['src']
    })

    imgObserver.observe(thumbnailContainerRef.current, {
      childList: true,
      subtree: true
    })

    // Initial check for images that might already be loaded
    const imgs = thumbnailContainerRef.current.querySelectorAll('img')
    imgs.forEach((img) => {
      if (img.complete && img.naturalHeight === 0) {
        setThumbnailFailed(true)
      }
      img.addEventListener('error', () => setThumbnailFailed(true), { once: true })
    })

    return () => {
      observer.disconnect()
      imgObserver.disconnect()
    }
  }, [showThumbnails])

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

  const styleBadge = style && DEBATE_STYLE_LABELS[style] ? (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] [font-variant:small-caps]  uppercase tracking-wide ${STYLE_COLORS[style] ?? "bg-muted text-muted-foreground"}`}>
      {DEBATE_STYLE_LABELS[style]}
    </span>
  ) : null


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
              ref={thumbnailContainerRef}
              className="relative w-full pt-[56.25%] bg-muted cursor-pointer"
              onClick={() => !isPlaying && setActiveVideo(videoId, title, videoMeta)}
            >
              <Image
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt={title}
                fill
                className={`rounded object-cover transition-opacity ${thumbnailFailed ? 'opacity-0' : 'opacity-100'}`}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />

              {/* Title overlay */}
              <div className="absolute inset-0 flex items-center justify-center p-3">
                <div className="max-w-[90%]">
                  {hasFullMetadata ? (
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      {/* First row: Tournament, Year, Round Level */}
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {isTopPick && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-base backdrop-blur-md bg-amber-500/80 border border-amber-300/90 shadow-lg">
                            🎖️
                          </span>
                        )}
                        {cleanTournament && (
                          <span className={cn(
                            "text-sm font-bold backdrop-blur-md border px-2 py-1 rounded [font-variant:small-caps] tracking-wider shadow-lg",
                            style && TOURNAMENT_COLORS[style] ? TOURNAMENT_COLORS[style] : "text-purple-300 bg-purple-900/80 border-purple-400/90"
                          )}>
                            {cleanTournament}
                          </span>
                        )}
                        {year && (
                          <span className="text-sm font-bold text-orange-300 backdrop-blur-md bg-orange-900/80 border border-orange-400/90 px-2 py-1 rounded shadow-lg">
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
                      </div>

                      {/* Second row: Teams */}
                      {hasTeams && (
                        <div className="flex flex-wrap items-start justify-center gap-2">
                          {affTeam && (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={cn(
                                "text-base font-bold backdrop-blur-md bg-blue-900/80 px-2 py-1 rounded",
                                affWin === true
                                  ? "border-[3px] border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] text-blue-100"
                                  : "border border-blue-400/90 shadow-lg text-blue-300"
                              )}>
                                {affTeam}
                              </span>
                              {arg1AC && (
                                <span className="text-xs font-medium text-blue-100 backdrop-blur-md bg-blue-950/90 px-2 py-0.5 rounded border border-blue-800/50 shadow-sm text-center max-w-[120px] leading-tight">
                                  {arg1AC}
                                </span>
                              )}
                            </div>
                          )}
                          {negTeam && (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={cn(
                                "text-base font-bold backdrop-blur-md bg-red-900/80 px-2 py-1 rounded",
                                affWin === false
                                  ? "border-[3px] border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] text-red-100"
                                  : "border border-red-400/90 shadow-lg text-red-300"
                              )}>
                                {negTeam}
                              </span>
                              {arg2NR && (
                                <span className="text-xs font-medium text-red-100 backdrop-blur-md bg-red-950/90 px-2 py-0.5 rounded border border-red-800/50 shadow-sm text-center max-w-[120px] leading-tight">
                                  {arg2NR}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      {isTopPick && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xl backdrop-blur-md bg-amber-500/80 border border-amber-300/90 shadow-lg">
                          🎖️
                        </span>
                      )}
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

            <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs text-muted-foreground flex-wrap">

              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:text-primary transition-colors"
                title={`Watch "${title}" on YouTube`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(videoId); }}
                    className={`p-0.5 rounded transition-colors ${isFavorite ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300" : "text-muted-foreground hover:text-foreground"}`}
                    aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
                  >
                    <Star className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFavorite ? "Remove from favorites" : "Save to favorites"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); !isInQueue && addToQueue(videoId, title, videoMeta); }}
                    disabled={isInQueue}
                    className={`p-0.5 rounded transition-colors ${isInQueue ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"}`}
                    aria-label={isInQueue ? "In queue" : "Add to queue"}
                  >
                    <ListVideo className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isInQueue ? "In queue" : "Add to queue"}</p>
                </TooltipContent>
              </Tooltip>



              {yearTopic && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors font-semibold text-xs"
                      aria-label="View topic"
                    >
                      T
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="text-sm whitespace-pre-line space-y-2">
                      {description ? (
                        <>
                          <p className="font-semibold text-primary">{yearTopic.replace(/<br\s*\/?>/gi, '\n')}</p>
                          <p>{description.split('\n').slice(2).join('\n').trim()}</p>
                        </>
                      ) : (
                        <p>{yearTopic.replace(/<br\s*\/?>/gi, '\n')}</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}

              {isHidden ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); onUnhideVideo(videoId); }}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Unhide video"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Unhide video</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowHideConfirm(true); }}
                      className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Hide video"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Hide video</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onBadgeClick(channel); }}
                    className="flex items-center gap-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Calendar className="h-3 w-3" />
                    <span>{showFullDate
                      ? new Date(date).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })
                      : new Date(date).toLocaleDateString("en-US", { month: "short" })
                    }</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{channel}</p>
                    <p className="text-orange-400">{new Date(date).toLocaleDateString("en-US", {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}</p>
                  </div>
                </TooltipContent>
              </Tooltip>


              <div className="flex items-center gap-1 shrink-0">
                <Eye className="h-3 w-3" />
                <span>{viewCount.toLocaleString()}</span>
              </div>



              {judgeDecision && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 shrink-0 cursor-help">
                      <Scale className="h-3.5 w-3.5" />
                      <span>{judgeDecision}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">{description}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {showDescription && description && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground line-clamp-3">{description}</p>
              </div>
            )}

          </div>

        </Card>

        <HideConfirmDialog
          open={showHideConfirm}
          onOpenChange={setShowHideConfirm}
          onConfirm={() => onHideVideo(videoId)}
          videoId={videoId}
          title={title}
        />
      </div>
    </TooltipProvider >
  )
}