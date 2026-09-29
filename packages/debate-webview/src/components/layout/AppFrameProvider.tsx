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
 * back button and `usePathname()`-driven UI all keep working. Navigation a
 * frame does within its own destination (`/videos` → `/videos/lectures`,
 * `/doc` → `/doc/<name>`, a `?view=`) is reported up by the frame and mirrored
 * into the address bar too — see {@link AppFrameContextValue.syncFrameLocation}.
 *
 * A destination's frame is mounted only when it is first needed — opened,
 * landed on, or hovered in the dock — never all up front, so a page load
 * fetches the one page on screen rather than every dock destination at once.
 * Once mounted, no frame is ever unmounted (see `lib/nav/frame-pool.ts`) —
 * not when switching between destinations, and not while a non-dock route is
 * on screen. Switching is just toggling which frame
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

import { dockNavLabel, dockNavRootFor, isDockNavPath, toFrameSrc } from "../../lib/nav/dock-nav-paths"
import { isMirrorableFrameLocation } from "../../lib/layout/frame-navigation"
import { keepAlive } from "../../lib/nav/frame-pool"
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
   * lands on its dock icon. Mounts its frame hidden right away, so the click
   * that usually follows finds it already loading.
   */
  preloadFrame: (href: string) => void
  /**
   * Records where the frame for dock destination `root` now is, and — when
   * that frame is the one on screen — puts it in the address bar with
   * `history.replaceState` (the frame's own navigation already added the
   * history entry). Called by `FrameNavigationHost` for each location a frame
   * reports.
   */
  syncFrameLocation: (root: string, path: string) => void
}

const AppFrameContext = createContext<AppFrameContextValue | null>(null)

interface AppFrameSurfaceValue {
  /** The keep-alive pool, oldest first. */
  mountedPaths: string[]
  /** The location each frame was first loaded at (see `firstSrcRef`). */
  frameSrcFor: (root: string) => string
}

/** Read only by {@link AppFrameSurface}. */
const AppFrameSurfaceContext = createContext<AppFrameSurfaceValue>({
  mountedPaths: [],
  frameSrcFor: (root) => root,
})

export function useAppFrame() {
  return useContext(AppFrameContext)
}

export function AppFrameProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [framedPath, setFramedPath] = useState<string | null>(null)
  // Insertion-ordered: the keep-alive pool, oldest first.
  const [mountedPaths, setMountedPaths] = useState<string[]>([])
  // Where each mounted frame last reported itself (`/videos` →
  // `/videos/lectures?q=x`). A frame keeps its page when hidden, so coming back
  // to it has to put that page — not the bare dock path — in the address bar.
  const frameLocationsRef = useRef(new Map<string, string>())
  const framedPathRef = useRef<string | null>(null)
  framedPathRef.current = framedPath
  // The location each frame is first loaded at — `/videos?view=lectures` for
  // a cold load of that URL, not just `/videos`. Written once per frame and
  // never changed, because a new `src` would reload a frame that is meant to
  // be kept alive; the frame navigates itself from there.
  const firstSrcRef = useRef(new Map<string, string>())
  const frameSrcFor = useCallback((root: string) => firstSrcRef.current.get(root) ?? root, [])

  const openInFrame = useCallback((href: string) => {
    // A host with no server behind its origin has nothing to frame; the
    // caller falls back to an ordinary route change.
    if (!getHostConfig().framing || !isDockNavPath(href)) return false

    const root = dockNavRootFor(href) ?? href
    setFramedPath(root)
    setMountedPaths((paths) => keepAlive(paths, root))

    const target = frameLocationsRef.current.get(root) ?? href
    rememberFirstSrc(firstSrcRef.current, root, href)
    if (typeof window !== "undefined" && currentLocation() !== target) {
      // Next's app router patches pushState, so this updates `usePathname()`
      // and the address bar without refetching the route — which is the whole
      // point: no RSC round trip, no re-render of the shell, no dropped dock.
      window.history.pushState(null, "", target)
    }
    return true
  }, [])

  const syncFrameLocation = useCallback((root: string, path: string) => {
    if (!isMirrorableFrameLocation(path, root, dockNavRootFor)) return
    frameLocationsRef.current.set(root, path)
    // A hidden frame (preloaded, or parked behind another destination) is
    // remembered but never takes over the address bar.
    if (framedPathRef.current !== root || typeof window === "undefined") return
    if (currentLocation() !== path) window.history.replaceState(null, "", path)
  }, [])

  const preloadFrame = useCallback((href: string) => {
    if (!getHostConfig().framing || !isDockNavPath(href)) return
    rememberFirstSrc(firstSrcRef.current, dockNavRootFor(href) ?? href, href)
    setMountedPaths((paths) => keepAlive(paths, dockNavRootFor(href) ?? href))
  }, [])

  // On mount and whenever pathname changes, frame dock destinations (/debate,
  // /cards, /videos, etc.) so they load embedded inside same-origin iframes,
  // while non-dock routes render as standard top-level routed pages.
  useEffect(() => {
    if (!getHostConfig().framing) return

    // A dock destination itself, or a page under one that its frame reported
    // (the address bar is showing where the frame went, and the back button
    // can return to it) — both are that destination's frame.
    const root = dockNavRootFor(pathname)
    const reported = root ? frameLocationsRef.current.get(root) : undefined
    const framedHere = isDockNavPath(pathname) || (reported != null && pathOf(reported) === pathname)
    if (root && framedHere) {
      rememberFirstSrc(
        firstSrcRef.current,
        root,
        window.location.pathname === pathname ? currentLocation() : pathname,
      )
      setFramedPath(root)
      setMountedPaths((paths) => keepAlive(paths, root))
    } else {
      setFramedPath(null)
    }
  }, [pathname])

  const value = useMemo<AppFrameContextValue>(
    () => ({ framedPath, activePath: framedPath ?? pathname, openInFrame, preloadFrame, syncFrameLocation }),
    [framedPath, openInFrame, pathname, preloadFrame, syncFrameLocation],
  )

  const surface = useMemo<AppFrameSurfaceValue>(
    () => ({ mountedPaths, frameSrcFor }),
    [mountedPaths, frameSrcFor],
  )

  return (
    <AppFrameContext.Provider value={value}>
      <AppFrameSurfaceContext.Provider value={surface}>{children}</AppFrameSurfaceContext.Provider>
    </AppFrameContext.Provider>
  )
}

/** The top document's path, query and hash. */
function currentLocation(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

/** Records where `root`'s frame first loads, unless it already has. */
function rememberFirstSrc(srcs: Map<string, string>, root: string, location: string) {
  if (!srcs.has(root)) srcs.set(root, location)
}

/** `path` without its query or hash. */
function pathOf(path: string): string {
  return path.split(/[?#]/)[0] ?? path
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
  const { mountedPaths, frameSrcFor } = useContext(AppFrameSurfaceContext)
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
              src={toFrameSrc(frameSrcFor(path))}
              // Lets the shell tell which destination a message came from.
              data-frame-path={path}
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
