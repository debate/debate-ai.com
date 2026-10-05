/**
 * @fileoverview Warms the dock's destinations once the current page is idle.
 *
 * Every dock destination is an ordinary client-router route rendered as React
 * in this document, and hovering an icon already calls `router.prefetch` for
 * it. A touch screen never hovers, though, and a quick click beats the hover
 * prefetch, so the first switch to a destination still waited on its code.
 * This prefetches the rest of the dock's routes one at a time, in idle time
 * after the page has loaded, so a switch is a render from cache.
 *
 * Skipped on a data-saver or 2G connection, and never for `/research/docs`: its
 * workspace is several megabytes (see the docs page `internals/performance`),
 * which only someone heading there should pay for. Hover still warms it.
 *
 * @module lib/nav/dock-idle-prefetch
 */

/** Dock routes too heavy to fetch for someone who may never open them. */
export const IDLE_PREFETCH_EXCLUDED: ReadonlySet<string> = new Set(["/research/docs"])

/** Wait after `load` before the first prefetch, so it never competes with it. */
const START_DELAY_MS = 1_500

/**
 * The dock routes to warm from `currentPath`: every destination except the one
 * on screen and the excluded ones, in dock order.
 */
export function dockIdlePrefetchTargets(
  hrefs: readonly string[],
  currentPath: string | null | undefined,
): string[] {
  const current = currentPath ?? ""
  return hrefs.filter(
    (href) =>
      !IDLE_PREFETCH_EXCLUDED.has(href) && current !== href && !current.startsWith(`${href}/`),
  )
}

interface ConnectionHints {
  saveData?: boolean
  effectiveType?: string
}

/** Whether this connection can afford to fetch pages nobody asked for yet. */
export function canIdlePrefetch(nav: { connection?: ConnectionHints } | undefined): boolean {
  const connection = nav?.connection
  if (!connection) return true
  if (connection.saveData) return false
  return connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g"
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

/** One idle warm-up per page load, however many docks are mounted. */
let started = false

/**
 * Prefetches `targets` one per idle period, starting after the page's `load`.
 *
 * @returns A cancel function for the pending steps.
 */
export function scheduleDockIdlePrefetch(
  prefetch: (href: string) => void,
  targets: readonly string[],
  win: IdleWindow = window,
): () => void {
  if (started || targets.length === 0) return () => {}
  if (!canIdlePrefetch(win.navigator as { connection?: ConnectionHints })) return () => {}
  started = true

  const queue = [...targets]
  let timer = 0
  let idle = 0
  let cancelled = false

  const step = () => {
    if (cancelled) return
    const href = queue.shift()
    if (!href) return
    try {
      prefetch(href)
    } catch {
      // A failed prefetch only means that switch is not pre-warmed.
    }
    next()
  }
  const next = () => {
    if (cancelled || queue.length === 0) return
    if (typeof win.requestIdleCallback === "function") idle = win.requestIdleCallback(step, { timeout: 5_000 })
    else timer = win.setTimeout(step, 300)
  }
  const begin = () => {
    timer = win.setTimeout(next, START_DELAY_MS)
  }

  if (win.document.readyState === "complete") begin()
  else win.addEventListener("load", begin, { once: true })

  return () => {
    cancelled = true
    started = false
    win.removeEventListener("load", begin)
    win.clearTimeout(timer)
    if (idle && typeof win.cancelIdleCallback === "function") win.cancelIdleCallback(idle)
  }
}
