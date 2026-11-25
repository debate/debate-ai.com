"use client"

/**
 * @fileoverview The fade between pages, and the orbital loader for a slow one.
 *
 * Nothing here holds a page back. A link click starts the router as before;
 * the old page only dims if the next one hasn't arrived within a beat, the
 * new page renders the instant the router commits it and then fades in over
 * {@link PAGE_FADE_MS}, and the orbital "quantum sphere" appears only when
 * the reader has already waited {@link SLOW_NAVIGATION_MS}.
 *
 * The wrapper is `display: contents`, so it adds no box: the page's elements
 * lay out against the same parent as before, and the fade is a Web Animation
 * on each of them (opacity only — no transform, which would trap the page's
 * `position: fixed` bits). Mounted once by `AppShell` around the routed page,
 * so the dock, the sidebar and the persistent player never fade.
 *
 * Navigations are seen two ways: a click on a same-origin link to another
 * page (`navigationTargetOf`) starts one, and a change of pathname ends it —
 * or, for a link that only changes the query string, the address bar
 * reaching the link's target.
 */

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import { OrbitalLoader } from "../../ui/loaders/OrbitalLoader"
import {
  NAVIGATION_GIVE_UP_MS,
  PAGE_FADE_MS,
  PENDING_OPACITY,
  SLOW_NAVIGATION_MS,
  navigationTargetOf,
} from "../../lib/nav/page-transition"

/** A beat before dimming, so a navigation that arrives at once never flickers. */
const DIM_DELAY_MS = 100

interface PendingNavigation {
  target: string
  timers: number[]
  poll: number
  dims: Animation[]
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function pageElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && typeof el.animate === "function",
  )
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const rootRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<PendingNavigation | null>(null)
  const lastPathname = useRef(pathname)
  const [slow, setSlow] = useState(false)

  const finish = useCallback(() => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    for (const timer of pending.timers) window.clearTimeout(timer)
    window.clearInterval(pending.poll)
    for (const dim of pending.dims) dim.cancel()
    setSlow(false)
  }, [])

  const start = useCallback(
    (target: string) => {
      finish()
      const pending: PendingNavigation = { target, timers: [], poll: 0, dims: [] }
      pendingRef.current = pending

      if (!prefersReducedMotion()) {
        for (const el of pageElements(rootRef.current)) {
          pending.dims.push(
            el.animate([{ opacity: 1 }, { opacity: PENDING_OPACITY }], {
              duration: 150,
              delay: DIM_DELAY_MS,
              easing: "ease-out",
              fill: "forwards",
            }),
          )
        }
      }

      pending.timers.push(
        window.setTimeout(() => {
          if (pendingRef.current === pending) setSlow(true)
        }, SLOW_NAVIGATION_MS),
        window.setTimeout(() => {
          if (pendingRef.current === pending) finish()
        }, NAVIGATION_GIVE_UP_MS),
      )

      // A query-string-only link keeps the pathname, so watch the address bar
      // for the link's target instead.
      pending.poll = window.setInterval(() => {
        const { pathname: path, search } = window.location
        if (`${path}${search}` === pending.target) finish()
      }, 100)
    },
    [finish],
  )

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = navigationTargetOf(event, window.location)
      if (target) start(target)
    }
    // Capture, so a handler that stops propagation can't hide the click.
    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      finish()
    }
  }, [start, finish])

  // The new page has committed: end the wait and fade it in before it paints.
  useLayoutEffect(() => {
    if (lastPathname.current === pathname) return
    lastPathname.current = pathname
    finish()
    if (prefersReducedMotion()) return
    for (const el of pageElements(rootRef.current)) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: PAGE_FADE_MS, easing: "ease-out" })
    }
  }, [pathname, finish])

  return (
    <>
      <div ref={rootRef} data-page-transition style={{ display: "contents" }}>
        {children}
      </div>
      {slow && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading page"
          data-testid="page-transition-loader"
          className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center animate-in fade-in-0 duration-200"
        >
          <OrbitalLoader size="md" />
        </div>
      )}
    </>
  )
}
