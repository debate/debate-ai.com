"use client"

/**
 * @fileoverview The two halves of the frame → shell navigation handoff
 * described in `lib/layout/frame-navigation.ts`: what a framed document does
 * with a link the frame does not own, and what the shell does when one
 * arrives.
 *
 * The point of both is that the sidebar and dock never unmount. A tool link
 * in the sidebar of a framed page used to navigate the frame, which rendered
 * that tool bare inside it and then reloaded the entire tab to recover. Now
 * the click never reaches the frame's router: the shell routes to it, the
 * frame stack comes down, and `AppSidebarShell` picks the page up with the
 * same sidebar already on screen.
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { dockNavRootFor, isDockOwnedPath } from "@/lib/nav/dock-nav-paths"
import { useAppFrame } from "@/components/layout/AppFrameProvider"
import {
  FRAME_NAV_ACK,
  FRAME_NAV_REQUEST,
  isFrameNavAck,
  isFrameNavRequest,
  opensElsewhere,
  topNavigationTarget,
} from "@/lib/layout/frame-navigation"

/** How long a framed document waits for the shell before giving up and doing
 *  the old hard top-level load. Long enough to cover the round trip and a
 *  slow shell, short enough not to read as a hang. */
const ACK_TIMEOUT_MS = 1200

/** Sends the whole tab to `path`. The fallback when no shell answers. */
function loadAtTop(path: string) {
  try {
    window.top?.location.assign(path)
  } catch {
    // Same-origin by construction (the shell only ever frames this app's own
    // paths), so this cannot normally throw — and there is nothing to do.
    window.location.assign(path)
  }
}

/**
 * Asks the shell to route to `path`, falling back to a top-level load if it
 * does not acknowledge. Returns a cleanup for the pending fallback.
 */
function handOffToShell(path: string): () => void {
  const top = window.top
  if (!top || top === window) {
    loadAtTop(path)
    return () => {}
  }

  let settled = false
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    if (!isFrameNavAck(event.data) || event.data.path !== path) return
    settled = true
    window.clearTimeout(timer)
    window.removeEventListener("message", onMessage)
  }
  window.addEventListener("message", onMessage)

  const timer = window.setTimeout(() => {
    if (settled) return
    window.removeEventListener("message", onMessage)
    loadAtTop(path)
  }, ACK_TIMEOUT_MS)

  try {
    top.postMessage({ type: FRAME_NAV_REQUEST, path }, window.location.origin)
  } catch {
    window.clearTimeout(timer)
    window.removeEventListener("message", onMessage)
    loadAtTop(path)
  }

  return () => {
    window.clearTimeout(timer)
    window.removeEventListener("message", onMessage)
  }
}

/**
 * Mounted in a framed document. Two layers, because a navigation can start
 * either way:
 *
 * 1. **Before it starts.** A capture-phase click on any anchor pointing at a
 *    path this frame does not own is taken off the router entirely and handed
 *    to the shell. Nothing loads in the frame, so there is no flash of a
 *    chrome-less page on the way out — this is the path every sidebar tool
 *    link takes.
 * 2. **After it has happened.** Anything that navigated the frame some other
 *    way (a `router.push` in page code, a redirect, the frame's own back
 *    button) is caught by `pathname` and handed over the same way, which is
 *    the case the shell used to answer with a full top-level reload.
 */
export function useFrameNavigationHandoff(embedded: boolean, pathname: string) {
  useEffect(() => {
    if (!embedded || typeof window === "undefined") return

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || opensElsewhere(event)) return
      const anchor = (event.target as Element | null)?.closest?.("a")
      if (!anchor) return

      const path = topNavigationTarget(
        {
          href: anchor.getAttribute("href"),
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
        },
        window.location.origin,
        window.location.pathname,
        dockNavRootFor,
      )
      if (!path) return

      // Capture phase, so this runs before the router's own listener and the
      // frame never starts the navigation it would have to be pulled out of.
      event.preventDefault()
      event.stopPropagation()
      handOffToShell(path)
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
    // `window.location` is read at click time rather than captured here, so
    // the listener does not need re-binding as the frame navigates itself.
  }, [embedded])

  useEffect(() => {
    if (!embedded || typeof window === "undefined") return
    if (isDockOwnedPath(pathname)) return
    return handOffToShell(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    )
  }, [embedded, pathname])
}

/**
 * Mounted once in the shell document. Routes to whatever a framed document
 * hands up, with the client router — so the shell, its dock and its sidebar
 * stay mounted across the hop. `AppFrameProvider` sees the pathname change
 * and takes the frame stack down on its own.
 */
export function FrameNavigationHost() {
  const router = useRouter()
  const frame = useAppFrame()

  useEffect(() => {
    if (typeof window === "undefined") return

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (!isFrameNavRequest(event.data)) return

      const { path } = event.data
      // Root-relative only: a frame never gets to send this document to
      // another origin, and `//host` is one of those in URL clothing.
      if (!path.startsWith("/") || path.startsWith("//")) return

      // Acknowledged before routing, so the frame cancels its fallback
      // top-level load rather than racing the router's fetch.
      try {
        ;(event.source as Window | null)?.postMessage(
          { type: FRAME_NAV_ACK, path },
          window.location.origin,
        )
      } catch {
        // A frame that has already gone away. Route anyway.
      }

      // A dock destination goes back into the frame stack, so hopping to one
      // from inside another frame behaves exactly like clicking its icon —
      // including the keep-alive pool. Everything else is a route change.
      if (frame?.openInFrame(path)) return
      router.push(path)
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [frame, router])

  return null
}
