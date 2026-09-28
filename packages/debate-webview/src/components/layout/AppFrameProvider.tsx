"use client"

/**
 * @fileoverview Runs the dock's destinations inside a same-origin `<iframe>`
 * while the dock itself stays in the top document.
 *
 * Why: clicking a dock icon used to hand the whole app over to a route
 * change. The dock unmounted with the rest of the tree, the new page's
 * client bundle blocked the main thread while it hydrated, and for that
 * whole stretch nothing on screen responded — the dock read as frozen and
 * clicks on it did nothing. Loading each destination into a frame instead
 * keeps the dock's own React tree (and its event loop work) out of the
 * page's: the icon lights up on the click, and whatever the destination does
 * to itself while loading happens inside the frame's document.
 *
 * The top document's URL still changes with each hop (`history.pushState`,
 * which Next's app router tracks without refetching), so deep links, the
 * back button and `usePathname()`-driven UI all keep working.
 *
 * Every dock destination is preloaded into its own hidden frame shortly
 * after the shell mounts, and no frame is ever unmounted after that (see
 * `lib/nav/frame-pool.ts`) — not when switching between destinations, and not
 * while a non-dock route is on screen. Switching is just toggling which frame
 * is visible, so it is instant and each page's scroll position, editor buffer
 * and in-flight state survive the trip.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"

import { DOCK_NAV_HREFS, dockNavLabel, isDockNavPath, toFrameSrc } from "../../lib/nav/dock-nav-paths"
import { keepAlive, keepAllAlive } from "../../lib/nav/frame-pool"
import { getHostConfig } from "../../host/config"
import { beginLoading, finishLoading } from "../../lib/ui/loading-store"
import { ROUTE_LOADING_TIMEOUT_MS } from "../../lib/ui/use-route-loading"

interface AppFrameContextValue {
  /** The path currently shown in the frame, or `null` when not framing. */
  framedPath: string | null
  /** Path the dock should highlight — the framed one, else the route. */
  activePath: string
  /** Opens `href` in the frame. Returns false if it isn't a framed path. */
  openInFrame: (href: string) => boolean
  /**
   * Warms a destination before it is asked for — called when the pointer
   * lands on its dock icon. Mounts its frame hidden right away, ahead of the
   * idle-time preload of the whole dock.
   */
  preloadFrame: (href: string) => void
}

const AppFrameContext = createContext<AppFrameContextValue | null>(null)

/**
 * How long after mount the rest of the dock is preloaded. The page on screen
 * gets the network and main thread first; the hidden frames follow once the
 * browser is idle, or after this long at the latest.
 */
export const PRELOAD_ALL_FRAMES_DELAY_MS = 1500

/** The keep-alive pool, oldest first — read only by {@link AppFrameSurface}. */
const AppFrameSurfaceContext = createContext<string[]>([])

export function useAppFrame() {
  return useContext(AppFrameContext)
}

export function AppFrameProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [framedPath, setFramedPath] = useState<string | null>(null)
  // Insertion-ordered: the keep-alive pool, oldest first.
  const [mountedPaths, setMountedPaths] = useState<string[]>([])
  const lastPathnameRef = useRef(pathname)

  const openInFrame = useCallback((href: string) => {
    // A host with no server behind its origin has nothing to frame; the
    // caller falls back to an ordinary route change.
    if (!getHostConfig().framing || !isDockNavPath(href)) return false

    setFramedPath(href)
    setMountedPaths((paths) => keepAlive(paths, href))

    if (typeof window !== "undefined" && window.location.pathname !== href) {
      // Next's app router patches pushState, so this updates `usePathname()`
      // and the address bar without refetching the route — which is the whole
      // point: no RSC round trip, no re-render of the shell, no dropped dock.
      window.history.pushState(null, "", href)
    }
    return true
  }, [])

  const preloadFrame = useCallback((href: string) => {
    if (!getHostConfig().framing || !isDockNavPath(href)) return
    setMountedPaths((paths) => keepAlive(paths, href))
  }, [])

  // Preload every dock destination into the hidden frame stack once the
  // browser is idle, so the first click on any dock icon is already instant.
  useEffect(() => {
    if (!getHostConfig().framing || typeof window === "undefined") return
    const preloadAll = () => setMountedPaths((paths) => keepAllAlive(paths, DOCK_NAV_HREFS))

    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(preloadAll, { timeout: PRELOAD_ALL_FRAMES_DELAY_MS })
      return () => window.cancelIdleCallback(handle)
    }
    const timer = window.setTimeout(preloadAll, PRELOAD_ALL_FRAMES_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  // On mount and whenever pathname changes, frame dock destinations (/debate,
  // /cards, /videos, etc.) so they load embedded inside same-origin iframes,
  // while non-dock routes render as standard top-level routed pages.
  useEffect(() => {
    if (!getHostConfig().framing) return

    if (isDockNavPath(pathname)) {
      setFramedPath(pathname)
      setMountedPaths((paths) => keepAlive(paths, pathname))
    } else {
      setFramedPath(null)
    }
  }, [pathname])

  const value = useMemo<AppFrameContextValue>(
    () => ({ framedPath, activePath: framedPath ?? pathname, openInFrame, preloadFrame }),
    [framedPath, openInFrame, pathname, preloadFrame],
  )

  return (
    <AppFrameContext.Provider value={value}>
      <AppFrameSurfaceContext.Provider value={mountedPaths}>{children}</AppFrameSurfaceContext.Provider>
    </AppFrameContext.Provider>
  )
}

/**
 * The content column. Shows the visible dock frame when a dock destination is
 * active, and the ordinarily routed page (`children`) otherwise.
 *
 * The frame stack is rendered in both cases, in the same slot of the tree, so
 * React never unmounts it: on a non-dock route every frame is simply hidden,
 * and coming back to the dock shows the frame exactly as it was left.
 */
export function AppFrameSurface({ children }: { children: ReactNode }) {
  const frame = useAppFrame()
  const mountedPaths = useContext(AppFrameSurfaceContext)
  // Frames whose document has fired `load` — a preloaded one included, so
  // switching to it later is instant and never arms the overlay.
  const [loadedPaths, setLoadedPaths] = useState<ReadonlySet<string>>(() => new Set())
  const markLoaded = useCallback((path: string) => {
    setLoadedPaths((paths) => (paths.has(path) ? paths : new Set(paths).add(path)))
  }, [])

  // The dock's click changes `pathname` at once, which clears the router's
  // transition, but the frame it opened may still be blank. Hold the global
  // loading overlay for as long as the visible frame is still loading; it only
  // shows if that runs past the overlay's show delay.
  const waitingOnFrame = frame?.framedPath != null && !loadedPaths.has(frame.framedPath)
  useEffect(() => {
    if (!waitingOnFrame) return
    beginLoading()
    let released = false
    const release = () => {
      if (released) return
      released = true
      finishLoading()
    }
    const timer = window.setTimeout(release, ROUTE_LOADING_TIMEOUT_MS)
    return () => {
      window.clearTimeout(timer)
      release()
    }
  }, [waitingOnFrame])

  const framedPath = frame?.framedPath ?? null

  return (
    <>
      {framedPath ? null : children}
      <div
        className={
          framedPath
            ? "relative h-[calc(100dvh-70px)] w-full md:h-screen"
            : // Parked off-screen at full size: the hidden frames keep their
              // layout (no reflow when they come back) but take no space and
              // no input while the routed page is shown.
              "pointer-events-none fixed left-0 top-0 -z-10 h-screen w-screen"
        }
        style={framedPath ? undefined : { visibility: "hidden" }}
        aria-hidden={framedPath ? undefined : true}
      >
        {mountedPaths.map((path) => {
          const visible = path === framedPath
          return (
            <iframe
              key={path}
              src={toFrameSrc(path)}
              title={dockNavLabel(path)}
              // Kept mounted but inert when hidden: `visibility` (not `display`)
              // so the document isn't torn down or re-laid-out on every switch,
              // and no pointer/tab access to a frame nobody can see.
              className="absolute inset-0 h-full w-full border-0"
              style={{
                visibility: visible ? "visible" : "hidden",
                pointerEvents: visible ? "auto" : "none",
              }}
              aria-hidden={visible ? undefined : true}
              tabIndex={visible ? undefined : -1}
              allow="autoplay; clipboard-read; clipboard-write; fullscreen; microphone; camera; encrypted-media"
              allowFullScreen
              onLoad={() => markLoaded(path)}
            />
          )
        })}
      </div>
    </>
  )
}
