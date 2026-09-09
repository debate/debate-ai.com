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

import { CategoryDockProvider, PersistentVideoPlayer, VideoPlayerFrameBridge } from "debate-videos"
import { CategoryDock } from "@/components/layout/CategoryDock"
import { AppSidebarShell } from "@/components/layout/AppSidebarShell"
import { AppFrameProvider, AppFrameSurface } from "@/components/layout/AppFrameProvider"
import { ReasonDocsProvider } from "@/components/reason-docs/ReasonDocsProvider"
import { OneTap } from "@/components/layout/OneTap"
import { ToolRecordSyncProvider } from "@/components/layout/ToolRecordSyncProvider"
import { ServiceWorkerRegistrar } from "@/components/layout/ServiceWorkerRegistrar"
import { useIsFramedDocument } from "@/lib/layout/use-framed-document"
import { Toaster } from "sonner"

export function AppShell({ children }: { children: React.ReactNode }) {
  const embedded = useIsFramedDocument()

  if (embedded) {
    return (
      <CategoryDockProvider>
        <ReasonDocsProvider>
          {/* The frame is the viewport here, so the page scrolls itself. */}
          <div className="min-h-screen w-full overflow-x-hidden">{children}</div>
          {/* Mirrors picks made in this frame (a video card, the queue) back
              to the player mounted in the shell. */}
          <VideoPlayerFrameBridge />
          {/* The tool panels run in this document, so the account mirror for
              their localStorage stores has to be switched on here too. */}
          <ToolRecordSyncProvider />
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
            <CategoryDock />
            <AppSidebarShell>
              <AppFrameSurface>{children}</AppFrameSurface>
            </AppSidebarShell>
          </div>
        </AppFrameProvider>
      </ReasonDocsProvider>
      <div data-app-chrome>
        <PersistentVideoPlayer />
        <OneTap />
      </div>
      <VideoPlayerFrameBridge />
      <ToolRecordSyncProvider />
      <ServiceWorkerRegistrar />
      {/* Sign-in and sign-out report through toasts; without a mounted
          toaster every one of those messages was dropped silently. */}
      <Toaster position="top-center" richColors closeButton />
    </CategoryDockProvider>
  )
}
