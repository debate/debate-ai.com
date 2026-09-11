"use client"

/**
 * @fileoverview The one client component that decides whether this document
 * is the app shell or a page running inside it.
 *
 * The shell owns the chrome — the dock, the tool sidebar, the persistent
 * video player, toasts — and hands the content column to
 * {@link AppFrameSurface}, which runs each dock destination in a same-origin
 * frame. A framed document renders its page and nothing else: no second dock,
 * no nested sidebar, and no nested frame surface.
 */

import type React from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

import { CategoryDockProvider, PersistentVideoPlayer, SlowSpreadButton, VideoPlayerFrameBridge } from "debate-videos"
import { CategoryDock } from "@/components/layout/CategoryDock"
import { AppSidebarShell } from "@/components/layout/AppSidebarShell"
import { AppFrameProvider, AppFrameSurface } from "@/components/layout/AppFrameProvider"
import { ReasonDocsProvider } from "@/components/reason-docs/ReasonDocsProvider"
import { OneTap } from "@/components/layout/OneTap"
import { ToolRecordSyncProvider } from "@/components/layout/ToolRecordSyncProvider"
import { GlobalCommandPalette } from "@/components/layout/GlobalCommandPalette"
import { ServiceWorkerRegistrar } from "@/components/layout/ServiceWorkerRegistrar"
import { useIsFramedDocument } from "@/lib/layout/use-framed-document"
import { isDockOwnedPath } from "@/lib/nav/dock-nav-paths"
import { ChromeErrorBoundary } from "@/lib/ui/layout/chrome-error-boundary"
import { Toaster } from "sonner"

export function AppShell({ children }: { children: React.ReactNode }) {
  const embedded = useIsFramedDocument()
  const pathname = usePathname()

  // A framed dock destination (e.g. /videos) can navigate itself somewhere
  // the dock never framed — a tool-tree link to /coach, /drills, etc. That
  // page is still "embedded" by every check here (same iframe, same origin),
  // so without this it would render bare below with no dock, no sidebar, and
  // no way back, while the top document's address bar and history stay on
  // whatever the dock last pushed. Send the whole tab there instead: a normal
  // top-level load of just that tool, with its own chrome, is what clicking
  // it is supposed to do.
  useEffect(() => {
    if (!embedded || isDockOwnedPath(pathname)) return
    try {
      window.top?.location.assign(`${window.location.pathname}${window.location.search}${window.location.hash}`)
    } catch {
      // Same-origin only by construction (AppFrameProvider only ever frames
      // this app's own paths) — nothing to do if that ever isn't true.
    }
  }, [embedded, pathname])

  if (embedded) {
    return (
      <CategoryDockProvider>
        <ReasonDocsProvider>
          {/* The frame is the viewport here, so the page scrolls itself. */}
          <div className="min-h-screen w-full overflow-x-hidden">{children}</div>
          {/* Mirrors picks made in this frame (a video card, the queue) back
              to the player mounted in the shell. */}
          <ChromeErrorBoundary label="VideoPlayerFrameBridge">
            <VideoPlayerFrameBridge />
          </ChromeErrorBoundary>
          {/* The tool panels run in this document, so the account mirror for
              their localStorage stores has to be switched on here too. */}
          <ChromeErrorBoundary label="ToolRecordSyncProvider">
            <ToolRecordSyncProvider />
          </ChromeErrorBoundary>
          {/* Same reason: a framed document owns its own keyboard focus, so
              the Ctrl/Cmd-Shift-Space listener has to live here too, not
              just in the top-level shell below. */}
          <ChromeErrorBoundary label="GlobalCommandPalette">
            <GlobalCommandPalette />
          </ChromeErrorBoundary>
          <Toaster position="top-center" richColors closeButton />
        </ReasonDocsProvider>
      </CategoryDockProvider>
    )
  }

  return (
    <CategoryDockProvider>
      {/* The REASON docs tree/tabs live in the sidebar (rendered by
          AppSidebarShell) while the editor that opens them is a page below
          it, so their shared state has to be owned above both. Both stay in
          this document — /reason-editor is not a dock destination and so is
          never framed away from its sidebar. */}
      <ReasonDocsProvider>
        <AppFrameProvider>
          <div className="w-screen h-screen overflow-auto pb-[70px] md:pb-0">
            <ChromeErrorBoundary label="CategoryDock">
              <CategoryDock />
            </ChromeErrorBoundary>
            <AppSidebarShell>
              <AppFrameSurface>{children}</AppFrameSurface>
            </AppSidebarShell>
          </div>
        </AppFrameProvider>
      </ReasonDocsProvider>
      {/* None of the chrome below is what the reader came for, so each piece
          is bounded on its own: a crash in the player, the sign-in prompt or
          the shortcut listener leaves that one piece out rather than taking
          the page and sidebar down with it (see `chrome-error-boundary.tsx`). */}
      <div data-app-chrome>
        {/* The slow-the-spread toggle is debate chrome, not part of the player. */}
        <ChromeErrorBoundary label="PersistentVideoPlayer">
          <PersistentVideoPlayer extraControls={<SlowSpreadButton />} />
        </ChromeErrorBoundary>
        <ChromeErrorBoundary label="OneTap">
          <OneTap />
        </ChromeErrorBoundary>
      </div>
      <ChromeErrorBoundary label="VideoPlayerFrameBridge">
        <VideoPlayerFrameBridge />
      </ChromeErrorBoundary>
      <ChromeErrorBoundary label="ToolRecordSyncProvider">
        <ToolRecordSyncProvider />
      </ChromeErrorBoundary>
      <ChromeErrorBoundary label="GlobalCommandPalette">
        <GlobalCommandPalette />
      </ChromeErrorBoundary>
      <ChromeErrorBoundary label="ServiceWorkerRegistrar">
        <ServiceWorkerRegistrar />
      </ChromeErrorBoundary>
      {/* Sign-in and sign-out report through toasts; without a mounted
          toaster every one of those messages was dropped silently. */}
      <Toaster position="top-center" richColors closeButton />
    </CategoryDockProvider>
  )
}
