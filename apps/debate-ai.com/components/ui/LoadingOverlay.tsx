"use client"

/**
 * @fileoverview The full-screen loading overlay shown on the app's first load
 * and on major page transitions.
 *
 * It renders on top of everything — the dock, the sidebar, the framed
 * destinations — so the user sees one animated loader rather than a half-
 * hydrated page. It is a layer mounted in the root layout: it owns the
 * viewport and the pointer, and the page underneath keeps rendering (and
 * hydrating) behind it, so when the overlay drops away the page is ready.
 *
 * The overlay is opt-in: a page that never asks for it renders bare. That
 * keeps the login/callback routes — which already render their own loader —
 * from stacking a second one on top.
 *
 * What sits in the middle is {@link LoadingVideo}: a looping clip that opens
 * on a random frame, so repeated transitions don't replay the same seconds.
 * It falls back to the orb until it can play, and permanently if it can't, so
 * the centre of the screen is never empty. The small inline loaders in panels
 * and sidebars keep using {@link AnimatedLoader} directly — a video belongs to
 * the full-screen moment, not to a spinner in the corner of a settings pane.
 */

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/ui/lib/utils"
import { LoadingVideo } from "@/components/ui/LoadingVideo"

interface LoadingOverlayProps {
  /** When true the overlay is visible; when false it fades out. */
  active: boolean
  /** Short line under the clip, e.g. the page the app is loading. */
  label?: ReactNode
  /**
   * How long to keep showing the loader after `active` flips to false, so the
   * fade-out is an animation, not a cut. Defaults to 400 ms.
   */
  fadeOutMs?: number
  /**
   * When true the overlay never receives pointer events, so the page behind
   * it is still clickable. Use this for transitions where the next page is
   * already mounted and interactive.
   */
  passthrough?: boolean
}

export function LoadingOverlay({
  active,
  label,
  fadeOutMs = 400,
  passthrough = false,
}: LoadingOverlayProps) {
  // Render the DOM node as soon as it is needed for the fade-in, but keep it
  // mounted until the fade-out completes so the exit animation plays.
  const [mounted, setMounted] = useState(active)
  const [visible, setVisible] = useState(active)

  useEffect(() => {
    if (active) {
      setMounted(true)
      setVisible(true)
      return
    }
    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), fadeOutMs)
    return () => window.clearTimeout(timer)
  }, [active, fadeOutMs])

  if (!mounted) return null

  return (
    <div
      data-loading-overlay
      aria-live="polite"
      aria-label={typeof label === "string" ? label : "Loading"}
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        passthrough && "pointer-events-auto",
      )}
    >
      {/* No role/aria-live here: the overlay root above is already the live
          region announcing this, and nesting a second one double-announces. */}
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <LoadingVideo />
        {typeof label === "string" && label && (
          <p className="max-w-xs text-sm font-medium text-muted-foreground">{label}</p>
        )}
      </div>
      {label && typeof label !== "string" && (
        <div className="absolute bottom-[15vh] text-center">{label}</div>
      )}
    </div>
  )
}