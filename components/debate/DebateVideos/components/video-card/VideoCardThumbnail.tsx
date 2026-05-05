/**
 * @fileoverview Thumbnail section for a video card with metadata overlay badges and play state.
 * @module components/debate/DebateVideos/components/video-card/VideoCardThumbnail
 */

"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Play, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TOURNAMENT_COLORS, getRoundBadgeColor } from "./videoCardUtils"

/** Shape of the video metadata forwarded to the player store on play. */
interface VideoMeta {
  style?: number
  tournament?: string | null
  year: number
  affTeam?: string | null
  negTeam?: string | null
}

/** Props for the {@link VideoCardThumbnail} component. */
interface VideoCardThumbnailProps {
  /** YouTube video ID used to build the thumbnail URL. */
  videoId: string
  /** Video title shown in the overlay when full metadata is unavailable. */
  title: string
  /** When `false` the entire thumbnail section is omitted. */
  showThumbnails: boolean
  /** Whether this video is currently playing in the persistent player. */
  isPlaying: boolean
  /** Whether this card is tagged as a top pick (shows medal badge). */
  isTopPick: boolean
  /** Whether all structured metadata fields are populated. */
  hasFullMetadata: boolean
  /** Whether affirmative/negative team names are present. */
  hasTeams: boolean
  /** Tournament name with year digits stripped, shown as an overlay badge. */
  cleanTournament?: string
  /** Publication year of the video. */
  year: number
  /** Round level string (e.g. `"Finals"`, `"Quarterfinals"`). */
  roundLevel?: string | null
  /** Affirmative team name. */
  affTeam?: string | null
  /** Negative team name. */
  negTeam?: string | null
  /** Whether the affirmative team won (`true`), neg won (`false`), or unknown. */
  affWin?: boolean | null
  /** Affirmative 1AC argument label. */
  arg1AC?: string | null
  /** Negative 2NR argument label. */
  arg2NR?: string | null
  /** Full YouTube watch URL for the external-link fallback. */
  youtubeUrl: string
  /** Metadata forwarded to the player store when the user starts playback. */
  videoMeta: VideoMeta
  /** Style number used for tournament badge colour lookup. */
  styleNumber?: number
  /**
   * Callback invoked to start playback.
   * Matches the signature of `useVideoPlayerStore().setActiveVideo`.
   */
  setActiveVideo: (
    videoId: string,
    title: string,
    meta: VideoMeta,
  ) => void
}

/**
 * Renders the 16:9 thumbnail area of a video card.
 *
 * Features:
 * - Lazy-loads the YouTube `mqdefault` thumbnail via `next/image`.
 * - Detects image load failures via `MutationObserver` + error events and
 *   fades the broken image out, falling back to the metadata overlay alone.
 * - Overlays tournament, year, round-level, and team badges when full metadata
 *   is available, otherwise shows the video title as a pill link.
 * - Dims and shows a "Now playing" indicator when `isPlaying` is `true`.
 * - Shows a hover play button when the card is not playing.
 *
 * @param props - See {@link VideoCardThumbnailProps}.
 */
export function VideoCardThumbnail({
  videoId,
  title,
  showThumbnails,
  isPlaying,
  isTopPick,
  hasFullMetadata,
  hasTeams,
  cleanTournament,
  year,
  roundLevel,
  affTeam,
  negTeam,
  affWin,
  arg1AC,
  arg2NR,
  youtubeUrl,
  videoMeta,
  styleNumber,
  setActiveVideo,
}: VideoCardThumbnailProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  /** Watches for failed image loads via mutation observer + error events. */
  useEffect(() => {
    if (!showThumbnails || !containerRef.current) return

    const attrObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "src"
        ) {
          const target = mutation.target as HTMLImageElement
          if (target.tagName === "IMG") {
            if (target.complete && target.naturalHeight === 0) {
              setThumbnailFailed(true)
            }
            target.addEventListener(
              "error",
              () => setThumbnailFailed(true),
              { once: true },
            )
          }
        }
      })
    })

    const childObserver = new MutationObserver(() => {
      const imgs = containerRef.current?.querySelectorAll("img")
      imgs?.forEach((img) => {
        if (img.complete && img.naturalHeight === 0) setThumbnailFailed(true)
        img.addEventListener("error", () => setThumbnailFailed(true), {
          once: true,
        })
      })
    })

    attrObserver.observe(containerRef.current, {
      attributes: true,
      subtree: true,
      attributeFilter: ["src"],
    })
    childObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
    })

    // Initial check for images already in a broken state.
    containerRef.current.querySelectorAll("img").forEach((img) => {
      if (img.complete && img.naturalHeight === 0) setThumbnailFailed(true)
      img.addEventListener("error", () => setThumbnailFailed(true), {
        once: true,
      })
    })

    return () => {
      attrObserver.disconnect()
      childObserver.disconnect()
    }
  }, [showThumbnails])

  if (!showThumbnails) return null

  return (
    <div
      ref={containerRef}
      className="relative w-full pt-[56.25%] bg-muted cursor-pointer"
      onClick={() => !isPlaying && setActiveVideo(videoId, title, videoMeta)}
    >
      <Image
        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
        alt={title}
        fill
        className={`rounded object-cover transition-opacity ${
          thumbnailFailed ? "opacity-0" : "opacity-100"
        }`}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
      />

      {/* Metadata overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div className="max-w-[90%]">
          {hasFullMetadata ? (
            <div className="flex flex-col items-center justify-center gap-1.5">
              {/* Row 1: tournament · year · round */}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {isTopPick && (
                  <span className="inline-flex items-center px-2 py-1 rounded text-base backdrop-blur-md bg-amber-500/80 border border-amber-300/90 shadow-lg">
                    🎖️
                  </span>
                )}
                {cleanTournament && (
                  <span
                    className={cn(
                      "text-sm font-bold backdrop-blur-md border px-2 py-1 rounded [font-variant:small-caps] tracking-wider shadow-lg",
                      styleNumber && TOURNAMENT_COLORS[styleNumber]
                        ? TOURNAMENT_COLORS[styleNumber]
                        : "text-purple-300 bg-purple-900/80 border-purple-400/90",
                    )}
                  >
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
                    {(roundLevel.toLowerCase().trim() === "finals" ||
                      roundLevel.toLowerCase().trim() === "final") && (
                      <span className="text-base">🏆</span>
                    )}
                    <span
                      className={cn(
                        "text-sm font-semibold px-2 py-1 rounded border backdrop-blur-md shadow-lg",
                        getRoundBadgeColor(roundLevel),
                      )}
                    >
                      {roundLevel}
                    </span>
                  </>
                )}
              </div>

              {/* Row 2: aff vs neg team badges */}
              {hasTeams && (
                <div className="flex flex-wrap items-start justify-center gap-2">
                  {affTeam && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={cn(
                          "text-base font-bold backdrop-blur-md bg-blue-900/80 px-2 py-1 rounded",
                          affWin === true
                            ? "border-[3px] border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] text-blue-100"
                            : "border border-blue-400/90 shadow-lg text-blue-300",
                        )}
                      >
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
                      <span
                        className={cn(
                          "text-base font-bold backdrop-blur-md bg-red-900/80 px-2 py-1 rounded",
                          affWin === false
                            ? "border-[3px] border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] text-red-100"
                            : "border border-red-400/90 shadow-lg text-red-300",
                        )}
                      >
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
            /* Fallback: title pill link when metadata is sparse */
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

      {/* Play state overlay */}
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
  )
}
