"use client"

/**
 * @fileoverview Drives the global loading overlay off the router.
 *
 * The overlay is armed the moment a page transition *starts* and dropped once
 * the new route has painted. `LoadingOverlay` only appears after the load has
 * run past its show delay (`DEFAULT_LOADING_SHOW_DELAY_MS`), so a quick hop
 * finishes without it ever showing, and a slow one gets the orb instead of a
 * page that looks stuck on the old route.
 *
 * What starts a transition:
 *
 * - **A link click** to another page of this app (see
 *   `route-loading-target`). Both client-side `<Link>` hops and hard
 *   navigations count — for a hard one the orb covers the wait until the
 *   document unloads.
 * - **Back / forward** landing on another pathname.
 * - **A framed document handing a navigation up** to the shell
 *   (`FrameNavigationHost` calls {@link startRouteLoading}).
 *
 * What ends it: `pathname` changing, two animation frames later — one full
 * paint cycle, so the DOM behind the overlay is the new route, not a
 * placeholder. A transition that never lands (a handler that cancels the
 * click, a failed fetch) is dropped by a safety timeout rather than leaving
 * the overlay up for good.
 *
 * Dock destinations change `pathname` the instant they are clicked, so the
 * hop itself clears straight away; the frame that is still loading behind it
 * holds the overlay on its own (see `AppFrameSurface`).
 */

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { opensElsewhere } from "../layout/frame-navigation"
import { beginLoading, finishLoading } from "./loading-store"
import { isSamePage, routeLoadingTarget } from "./route-loading-target"

/** Longest a transition may hold the overlay before it is dropped regardless,
 *  in ms. Also used by `AppFrameSurface` for a frame that never loads. */
export const ROUTE_LOADING_TIMEOUT_MS = 8000

/** Whether a transition currently holds one level of the overlay's depth. */
let pending = false
/** Bumped by every start, so a settle scheduled for an earlier transition
 *  cannot drop one that began after it. */
let generation = 0
let safetyTimer: number | undefined

/**
 * Arms the overlay for a transition that is starting now. Idempotent while one
 * is already pending — a second click just restarts the safety timeout.
 */
export function startRouteLoading() {
  if (typeof window === "undefined") return
  generation += 1
  if (!pending) {
    pending = true
    beginLoading()
  }
  window.clearTimeout(safetyTimer)
  const gen = generation
  safetyTimer = window.setTimeout(() => endRouteLoading(gen), ROUTE_LOADING_TIMEOUT_MS)
}

function endRouteLoading(gen: number) {
  if (!pending || gen !== generation) return
  pending = false
  window.clearTimeout(safetyTimer)
  finishLoading()
}

/** Drops the pending transition after the new route has painted once. */
function settleRouteLoading() {
  if (!pending) return
  const gen = generation
  requestAnimationFrame(() => requestAnimationFrame(() => endRouteLoading(gen)))
}

export function useRouteLoading() {
  const pathname = usePathname()
  const lastPathRef = useRef(pathname)

  useEffect(() => {
    // Bubble phase, after the page's own handlers: a framed document's
    // hand-off (`useFrameNavigationHandoff`) stops the click in the capture
    // phase, so it never reaches here and the frame does not arm an overlay
    // for a navigation the shell is about to run. `defaultPrevented` is not
    // checked — `<Link>` prevents every click it routes.
    const onClick = (event: MouseEvent) => {
      if (opensElsewhere(event)) return
      const anchor = (event.target as Element | null)?.closest?.("a")
      if (!anchor) return
      const target = routeLoadingTarget(
        {
          href: anchor.getAttribute("href"),
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
        },
        window.location.href,
      )
      if (target) startRouteLoading()
    }

    // The URL has already changed by the time `popstate` fires, so it is
    // compared against the last pathname the router rendered.
    const onPopState = () => {
      if (!isSamePage(window.location.pathname, lastPathRef.current)) startRouteLoading()
    }

    // A page restored from the back/forward cache comes back exactly as it
    // was left — including an overlay armed for the navigation that left it.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) endRouteLoading(generation)
    }

    document.addEventListener("click", onClick)
    window.addEventListener("popstate", onPopState)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("click", onClick)
      window.removeEventListener("popstate", onPopState)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  useEffect(() => {
    if (pathname === lastPathRef.current) return
    lastPathRef.current = pathname
    settleRouteLoading()
  }, [pathname])
}
