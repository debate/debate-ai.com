"use client"

/**
 * @fileoverview The clip {@link LoadingOverlay} plays in the middle of the
 * screen while a page loads.
 *
 * Three things it has to get right:
 *
 * 1. **A random start.** Every load opens on a different moment of the loop,
 *    so a user who sits through a lot of transitions doesn't see the same two
 *    seconds every time. Where to start is `pickLoadingStartTime`; *getting*
 *    there is the fiddly half, see {@link seekToStart} below.
 * 2. **Never a blank hole.** The clip is ~1 MB and the overlay is often up for
 *    well under a second, so on a cold cache it cannot be the only thing in
 *    the middle of the screen. The orb renders underneath and hands over only
 *    once the video can actually play — and stays put for good if it can't
 *    (offline, a blocked request, a codec the browser won't take).
 * 3. **No second React.** Same rule as {@link AnimatedLoader}: this is a plain
 *    `<video>` drawn here, not a component out of a package that bundles its
 *    own React. See that file for what that cost last time.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/ui/lib/utils"
import { OrbitalLoader } from "@/components/ui/OrbitalLoader"
import {
  LOADING_VIDEO_SRC,
  pickLoadingStartTime,
  prefersReducedMotion,
  seekLanded,
} from "@/lib/ui/loading-video"

/**
 * How many media events may attempt the seek before it is left alone.
 *
 * A source that never becomes seekable (no byte-range support in front of it,
 * a container without an index) would otherwise be yanked back to the start on
 * every event for as long as the overlay is up, which looks far worse than
 * simply playing from 0. Three attempts covers the ordinary case — the
 * seekable range is usually empty at `loadedmetadata` and populated by
 * `canplay` — without turning into a fight.
 */
const MAX_SEEK_ATTEMPTS = 3

interface LoadingVideoProps {
  className?: string
}

export function LoadingVideo({ className }: LoadingVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // The chosen start, held across the media events that retry the seek, so
  // every attempt aims at the same frame rather than re-rolling the dice.
  const startRef = useRef<number | null>(null)
  const seekAttemptsRef = useRef(0)
  const seekedRef = useRef(false)

  /**
   * Put the element on its random frame, and check that it got there.
   *
   * Assigning `currentTime` is a request that quietly clamps to 0 while the
   * element has no seekable range yet — which is the normal state at
   * `loadedmetadata`, the first event with a duration to pick from. So this
   * runs again on the later events and stops as soon as the position sticks.
   */
  const seekToStart = useCallback(() => {
    const video = videoRef.current
    if (!video || seekedRef.current) return
    if (seekAttemptsRef.current >= MAX_SEEK_ATTEMPTS) return
    seekAttemptsRef.current += 1

    if (startRef.current === null) {
      startRef.current = pickLoadingStartTime(video.duration)
    }
    const start = startRef.current

    // Nothing to seek to: an unresolved duration, or the roll landed on the
    // opening frame anyway.
    if (start === 0) {
      seekedRef.current = true
      return
    }

    try {
      video.currentTime = start
    } catch {
      // Some browsers throw rather than clamp when the media isn't ready.
      // Either way the next event tries again.
      return
    }
    if (seekLanded(video.currentTime, start)) seekedRef.current = true
  }, [])

  // `autoPlay` is a request, not a guarantee: a muted inline video is allowed
  // to start on every current browser, but the promise still rejects if the
  // element is torn down mid-start (a fast overlay) or the tab is hidden.
  // Nothing to recover from — the orb is already underneath — so swallow it
  // rather than let an unhandled rejection surface in the console.
  useEffect(() => {
    const video = videoRef.current
    if (!video || failed) return
    if (prefersReducedMotion()) return
    void video.play().catch(() => {})
  }, [failed])

  const handleCanPlay = () => {
    seekToStart()
    setReady(true)
    // Reduced motion still gets the clip, held on its random frame rather
    // than animating.
    if (prefersReducedMotion()) videoRef.current?.pause()
  }

  return (
    <div
      className={cn(
        "relative flex aspect-video w-[min(70vw,32rem)] items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
    >
      {/* Under the video until it can play, and for good if it never can. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          ready ? "opacity-0" : "opacity-100",
        )}
      >
        <OrbitalLoader size="lg" className="pointer-events-none" />
      </div>

      {!failed && (
        <video
          ref={videoRef}
          src={LOADING_VIDEO_SRC}
          // Muted + inline is what makes autoplay permissible at all; the clip
          // carries no audio track, so there is nothing to unmute.
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          // The label on the overlay already announces the loading state, and
          // a decorative loop has nothing to add to it.
          aria-hidden="true"
          tabIndex={-1}
          // Three shots at the seek, earliest first: `loadedmetadata` is the
          // first event with a duration, `loadeddata` and `canplay` are the
          // first that usually have a seekable range to land in.
          onLoadedMetadata={seekToStart}
          onLoadedData={seekToStart}
          onCanPlay={handleCanPlay}
          onError={() => {
            setFailed(true)
            setReady(false)
          }}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  )
}
