"use client"

/**
 * @fileoverview State and pacing for the top-of-page navigation progress bar
 * (`RouteProgressBar`), the app's page-transition indicator.
 *
 * `use-route-loading` flips `pending` on when a transition starts and off
 * once the new route has painted; the bar reads it. Real route progress can't
 * be measured — the chunk download, server render and paint overlap — so the
 * bar advances optimistically with {@link nextRouteProgress} and only reaches
 * 100% when the transition actually lands.
 */

import { create } from "zustand"

/** How long a transition must run before the bar shows, in ms. Cached hops
 *  land inside it and never flash the bar. */
export const ROUTE_PROGRESS_SHOW_DELAY_MS = 150

/** Where the bar starts once it shows, in percent. */
export const ROUTE_PROGRESS_START = 12

/** The ceiling the optimistic trickle approaches but never reaches, in
 *  percent. The rest is reserved for the transition really finishing. */
export const ROUTE_PROGRESS_CEILING = 90

/** How often the bar trickles forward, in ms. */
export const ROUTE_PROGRESS_TRICKLE_MS = 250

/** How long the bar stays at 100% before fading, and how long the fade takes,
 *  in ms. */
export const ROUTE_PROGRESS_FINISH_MS = 200

interface RouteProgressState {
  /** Whether a page transition is in flight. */
  pending: boolean
}

export const useRouteProgressStore = create<RouteProgressState>(() => ({ pending: false }))

export function setRouteProgressPending(pending: boolean) {
  useRouteProgressStore.setState({ pending })
}

/**
 * The bar's next width: a step that closes a share of the gap to
 * {@link ROUTE_PROGRESS_CEILING}, so it moves quickly at first and slows as it
 * nears the ceiling without ever reaching it.
 *
 * @param value - The current width, in percent.
 * @param random - A number in [0, 1), `Math.random()` by default.
 */
export function nextRouteProgress(value: number, random = Math.random()): number {
  const gap = ROUTE_PROGRESS_CEILING - value
  if (gap <= 0) return Math.min(value, ROUTE_PROGRESS_CEILING)
  return value + gap * (0.05 + 0.15 * random)
}
