"use client"

/**
 * @fileoverview The slim bar across the top of the viewport that shows a page
 * transition is under way — the YouTube-style navigation progress bar, and
 * the app's standard route-transition indicator.
 *
 * It appears once a transition has run past
 * {@link ROUTE_PROGRESS_SHOW_DELAY_MS}, trickles toward
 * {@link ROUTE_PROGRESS_CEILING}, then jumps to 100% and fades out when the
 * new route has painted. It takes the theme's `--primary` colour and never
 * catches the pointer. Mounted once, by `LoadingProvider`.
 */

import { useEffect, useRef, useState } from "react"
import { cn } from "../../lib/ui/lib/utils"
import {
  nextRouteProgress,
  ROUTE_PROGRESS_FINISH_MS,
  ROUTE_PROGRESS_SHOW_DELAY_MS,
  ROUTE_PROGRESS_START,
  ROUTE_PROGRESS_TRICKLE_MS,
  useRouteProgressStore,
} from "../../lib/ui/route-progress"

export function RouteProgressBar() {
  const pending = useRouteProgressStore((s) => s.pending)
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const shownRef = useRef(false)

  useEffect(() => {
    const timers: number[] = []
    let trickle: number | undefined

    if (pending) {
      // A transition that starts while the last one is still fading takes the
      // bar over from where it is.
      timers.push(
        window.setTimeout(() => {
          shownRef.current = true
          setVisible(true)
          setWidth((w) => (w > ROUTE_PROGRESS_START && w < 100 ? w : ROUTE_PROGRESS_START))
          trickle = window.setInterval(
            () => setWidth((w) => nextRouteProgress(w)),
            ROUTE_PROGRESS_TRICKLE_MS,
          )
        }, ROUTE_PROGRESS_SHOW_DELAY_MS),
      )
    } else if (shownRef.current) {
      // `shownRef` stays set until the fade is over, so a transition that
      // interrupts the fade and ends inside the show delay still finishes it.
      setWidth(100)
      timers.push(window.setTimeout(() => setVisible(false), ROUTE_PROGRESS_FINISH_MS))
      timers.push(
        window.setTimeout(() => {
          shownRef.current = false
          setWidth(0)
        }, ROUTE_PROGRESS_FINISH_MS * 2),
      )
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      window.clearInterval(trickle)
    }
  }, [pending])

  return (
    <div
      aria-hidden="true"
      data-route-progress=""
      className={cn(
        "pointer-events-none fixed left-0 top-0 z-[10000] h-[3px] bg-primary",
        "shadow-[0_0_10px_var(--primary)] transition-[width,opacity] duration-200 ease-out",
        "motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ width: `${width}%` }}
    />
  )
}
