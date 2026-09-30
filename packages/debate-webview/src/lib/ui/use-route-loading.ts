"use client"

/**
 * @fileoverview Drives the navigation progress bar (`RouteProgressBar`) off
 * the router.
 *
 * The bar is armed the moment a page transition *starts* and finished once
 * the new route has painted. It only appears after the transition has run
 * past its show delay (`ROUTE_PROGRESS_SHOW_DELAY_MS`), so a cached hop
 * finishes without it ever showing, and a slow one gets the bar instead of a
 * page that looks stuck on the old route.
 *
 * What starts a transition:
 *
 * - **A link click** to another page of this app (see
 *   `route-loading-target`), dock items included. Both client-side `<Link>`
 *   hops and hard navigations count — for a hard one the bar covers the wait until the
 *   document unloads.
 * - **Back / forward** landing on another pathname.
 *
 * What ends it: `pathname` changing, two animation frames later — one full
 * paint cycle, so the page under the bar is the new route, not a
 * placeholder. A transition that never lands (a handler that cancels the
 * click, a failed fetch) is dropped by a safety timeout rather than leaving
 * the bar up for good.
 */

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { opensElsewhere } from "../layout/frame-navigation"
import { setRouteProgressPending } from "./route-progress"
import { isSamePage, routeLoadingTarget } from "./route-loading-target"

/** Longest a transition may hold the bar before it is dropped regardless,
 *  in ms. */
export const ROUTE_LOADING_TIMEOUT_MS = 8000

/** Whether a transition is in flight. */
let pending = false
/** Bumped by every start, so a settle scheduled for an earlier transition
 *  cannot drop one that began after it. */
let generation = 0
let safetyTimer: number | undefined

/**
 * Arms the bar for a transition that is starting now. Idempotent while one
 * is already pending — a second click just restarts the safety timeout.
 */
export function startRouteLoading() {
  if (typeof window === "undefined") return
  generation += 1
  if (!pending) {
    pending = true
    setRouteProgressPending(true)
  }
  window.clearTimeout(safetyTimer)
  const gen = generation
  safetyTimer = window.setTimeout(() => endRouteLoading(gen), ROUTE_LOADING_TIMEOUT_MS)
}

function endRouteLoading(gen: number) {
  if (!pending || gen !== generation) return
  pending = false
  window.clearTimeout(safetyTimer)
  setRouteProgressPending(false)
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
    // Bubble phase, after the page's own handlers. `defaultPrevented` is not
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
    // was left — including a bar armed for the navigation that left it.
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
