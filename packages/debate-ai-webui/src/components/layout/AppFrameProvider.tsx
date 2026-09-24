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
 * Visited frames stay mounted and hidden (see `lib/nav/frame-pool.ts`), so
 * hopping back to a destination is instant and its scroll position, editor
 * buffer and in-flight state survive the trip.
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

import { dockNavLabel, isDockNavPath, toFrameSrc } from "@/lib/nav/dock-nav-paths"
import { keepAlive } from "@/lib/nav/frame-pool"

interface AppFrameContextValue {
  /** The path currently shown in the frame, or `null` when not framing. */
  framedPath: string | null
  /** Path the dock should highlight — the framed one, else the route. */
  activePath: string
  /** Opens `href` in the frame. Returns false if it isn't a framed path. */
  openInFrame: (href: string) => boolean
  /**
   * Warms a destination before it is asked for — called when the pointer
   * lands on its dock icon. Once the frame stack is live this mounts the
   * document hidden; before that it can only warm the HTTP cache, since a
   * frame mounted outside the stack would have to be torn down and reloaded
   * to join it.
   */
  preloadFrame: (href: string) => void
}

const AppFrameContext = createContext<AppFrameContextValue | null>(null)

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
    if (!isDockNavPath(href)) return false

    setFramedPath(href)
    setMountedPaths((paths) => keepAlive(paths, href, href))

    if (typeof window !== "undefined" && window.location.pathname !== href) {
      // Next's app router patches pushState, so this updates `usePathname()`
      // and the address bar without refetching the route — which is the whole
      // point: no RSC round trip, no re-render of the shell, no dropped dock.
      window.history.pushState(null, "", href)
    }
    return true
  }, [])

  const prefetchedRef = useRef<Set<string>>(new Set())

  const preloadFrame = useCallback(
    (href: string) => {
      if (!isDockNavPath(href) || typeof document === "undefined") return

      if (framedPath) {
        setMountedPaths((paths) => keepAlive(paths, href, framedPath))
        return
      }

      if (prefetchedRef.current.has(href)) return
      prefetchedRef.current.add(href)
      const link = document.createElement("link")
      link.rel = "prefetch"
      link.as = "document"
      link.href = toFrameSrc(href)
      document.head.appendChild(link)
    },
    [framedPath],
  )

  // Any navigation we did not drive — a sidebar link, a redirect, the back
  // button landing outside the frame's history — hands the content column
  // back to the routed page.
  useEffect(() => {
    if (pathname === lastPathnameRef.current) return
    lastPathnameRef.current = pathname
    setFramedPath((current) => (current === pathname ? current : null))
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
 * The content column. Shows the frame stack once the dock has opened
 * something, and the ordinarily routed page (`children`) before that — so a
 * cold load of `/videos` still renders server-side, with no extra fetch, and
 * only later hops pay for a frame.
 */
export function AppFrameSurface({ children }: { children: ReactNode }) {
  const frame = useAppFrame()
  const mountedPaths = useContext(AppFrameSurfaceContext)

  if (!frame?.framedPath) return <>{children}</>

  return (
    <div className="relative h-[calc(100dvh-70px)] w-full md:h-screen">
      {mountedPaths.map((path) => (
        <iframe
          key={path}
          src={toFrameSrc(path)}
          title={dockNavLabel(path)}
          // Kept mounted but inert when hidden: `visibility` (not `display`)
          // so the document isn't torn down or re-laid-out on every switch,
          // and no pointer/tab access to a frame nobody can see.
          className="absolute inset-0 h-full w-full border-0"
          style={{
            visibility: path === frame.framedPath ? "visible" : "hidden",
            pointerEvents: path === frame.framedPath ? "auto" : "none",
          }}
          aria-hidden={path === frame.framedPath ? undefined : true}
          tabIndex={path === frame.framedPath ? undefined : -1}
          allow="autoplay; clipboard-read; clipboard-write; fullscreen; microphone; camera; encrypted-media"
          allowFullScreen
        />
      ))}
    </div>
  )
}
