"use client"

/**
 * @fileoverview Drives the global loading overlay off the router.
 *
 * Two call sites, both answered here rather than by individual pages:
 *
 * 1. **First load.** The moment this hook mounts it arms the orb, because the
 *    server-rendered HTML is the page itself and the client bundle still has
 *    to hydrate it. The orb stays up until the document has settled — a couple
 *    of animation frames past `window.load`, and never less than a floor — so
 *    a slow hydrate can't be flashed at the user.
 *
 * 2. **Major transitions.** A pathname change that is *not* a dock destination
 *    (the dock frames its own pages, which load inside an iframe and own
 *    their own loading state) arms the orb again and drops it once the new
 *    route has painted. A hard top-level load — a sidebar link, a redirect,
 *    the back button landing outside the frame — is just another first load,
 *    so it is covered by case 1.
 *
 * The overlay is opt-in and depth-counted (see `loading-store`), so a page
 * that never calls `beginLoading` renders bare and two pages loading at once
 * cannot stack two orbs.
 */

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { isDockNavPath } from "../nav/dock-nav-paths"
import { beginLoading, finishLoading } from "./loading-store"

/** Minimum time the orb stays up on a transition, in ms. Short hops still
 *  read as intentional loading rather than a flicker. */
const TRANSITION_MIN_MS = 250

/** Minimum time the orb stays up on the app's first load, in ms. Hydration
 *  for this app usually finishes well under it; the floor exists so a slow
 *  cold start never flashes a half-hydrated page. */
const FIRST_LOAD_MIN_MS = 600

/**
 * How many animation frames to wait, at minimum, before dropping the orb.
 * Two frames is one full paint cycle: the new route has rendered at least
 * once, so the DOM behind the overlay is not a placeholder.
 */
function runAfterSettled(minMs: number, cb: () => void) {
  const start = performance.now()
  let done = false

  const finish = () => {
    if (done) return
    done = true
    cb()
  }

  // Wait for a real paint after the change lands.
  const frame = () => {
    requestAnimationFrame(() => {
      const elapsed = performance.now() - start
      const remaining = minMs - elapsed
      if (remaining > 0) {
        window.setTimeout(finish, remaining)
      } else {
        finish()
      }
    })
  }
  frame()
}

export function useRouteLoading() {
  const pathname = usePathname()
  const lastPathRef = useRef<string | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      lastPathRef.current = pathname
      // First load: arm the orb and drop it once the document has settled.
      beginLoading()
      runAfterSettled(FIRST_LOAD_MIN_MS, finishLoading)
      return
    }

    if (pathname === lastPathRef.current) return
    lastPathRef.current = pathname

    // A client-side transition to a non-dock route. Dock destinations are
    // framed (see AppFrameSurface) and own their own loading state, so they
    // are not armed here.
    if (isDockNavPath(pathname)) return

    beginLoading()
    runAfterSettled(TRANSITION_MIN_MS, finishLoading)
  }, [pathname])
}