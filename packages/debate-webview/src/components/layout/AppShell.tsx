"use client"

/**
 * @fileoverview The one client component that decides whether this document
 * is the app shell or a page running inside it.
 *
 * The shell owns the chrome — the dock, the tool sidebar, the persistent
 * video player, toasts — and renders the routed page as an ordinary React
 * child in the content column. If some other page frames this app, the
 * framed document renders its page and nothing else: no second dock and no
 * nested sidebar.
 */

import type React from "react"
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { CategoryDockProvider, PersistentVideoPlayer, SlowSpreadButton } from "@debate/videos"
import { CategoryDock } from "./CategoryDock"
import { AppSidebarShell } from "./AppSidebarShell"
import { DocsAppChrome } from "./DocsAppChrome"
import { ReasonDocsProvider } from "../reason-docs/ReasonDocsProvider"
import { OneTap } from "./OneTap"
import { ToolRecordSyncProvider } from "./ToolRecordSyncProvider"
import { DebaterActivityListener } from "./DebaterActivityListener"
import { SignInPromptProvider } from "./SignInPromptProvider"
import { GlobalCommandPalette } from "./GlobalCommandPalette"
import { PlanLimitDialog } from "../pricing/PlanLimitDialog"
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar"
import { useIsFramedDocument } from "../../lib/layout/use-framed-document"
import { isDocsPath } from "../../lib/layout/frame-navigation"
import { MixpanelProvider } from "../analytics/MixpanelProvider"
import { ChromeErrorBoundary } from "../../lib/ui/layout/chrome-error-boundary"
import { Toaster } from "sonner"

export function AppShell({ children }: { children: React.ReactNode }) {
  const embedded = useIsFramedDocument()
  const pathname = usePathname()

  // Leaving /docs is always a real page load (see `docsExitTarget` in
  // `frame-navigation.ts`). `DocsAppChrome` turns link clicks out of the docs
  // into one; this catches the client-router navigations that are not link
  // clicks (the dock's menus, its Alt+<n> shortcuts), so a document that
  // started as a docs page never renders an app page under the docs' CSS.
  const docsDocument = useRef(isDocsPath(pathname))
  useEffect(() => {
    if (docsDocument.current && !isDocsPath(pathname)) window.location.reload()
  }, [pathname])

  // The help docs (`app/docs`, from `debate-help-docs`) bring their own
  // navigation — Fumadocs' header, sidebar and search — and their own
  // stylesheet. They get the app's sidebar beside that (`DocsAppChrome`), but
  // none of the rest of the shell: no player, no floating dock.
  if (isDocsPath(pathname)) return <DocsAppChrome>{children}</DocsAppChrome>

  if (embedded) {
    return (
      <CategoryDockProvider>
        <ReasonDocsProvider>
          {/* The frame is the viewport here, so the page scrolls itself. */}
          <div className="min-h-screen w-full overflow-x-hidden">{children}</div>
          {/* The tool panels run in this document, so the account mirror for
              their localStorage stores has to be switched on here too. */}
          <ChromeErrorBoundary label="ToolRecordSyncProvider">
            <ToolRecordSyncProvider />
          </ChromeErrorBoundary>
          {/* XP events come from tools in this document, so the level store
              has to hear them here too. */}
          <ChromeErrorBoundary label="DebaterActivityListener">
            <DebaterActivityListener />
          </ChromeErrorBoundary>
          {/* And the tool that tells a guest their save is browser-only has to
              be able to open its dialog in this document. */}
          <ChromeErrorBoundary label="SignInPromptProvider">
            <SignInPromptProvider />
          </ChromeErrorBoundary>
          {/* A framed document owns its own keyboard focus, so the Ctrl/Cmd-K
              listener has to live here too. */}
          <ChromeErrorBoundary label="GlobalCommandPalette">
            <GlobalCommandPalette />
          </ChromeErrorBoundary>
          {/* The tools that hit a plan limit fetch from this document. */}
          <ChromeErrorBoundary label="PlanLimitDialog">
            <PlanLimitDialog />
          </ChromeErrorBoundary>
          <MixpanelProvider />
          <Toaster position="top-center" richColors closeButton />
        </ReasonDocsProvider>
      </CategoryDockProvider>
    )
  }

  return (
    <CategoryDockProvider>
      {/* The REASON docs tree/tabs live in the sidebar (rendered by
          AppSidebarShell) while the editor that opens them is a page below
          it, so their shared state has to be owned above both. */}
      <ReasonDocsProvider>
        <div className="w-screen h-screen overflow-auto pb-[70px] md:pb-0">
          <ChromeErrorBoundary label="CategoryDock">
            <CategoryDock />
          </ChromeErrorBoundary>
          <AppSidebarShell>{children}</AppSidebarShell>
        </div>
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
      <ChromeErrorBoundary label="ToolRecordSyncProvider">
        <ToolRecordSyncProvider />
      </ChromeErrorBoundary>
      <ChromeErrorBoundary label="DebaterActivityListener">
        <DebaterActivityListener />
      </ChromeErrorBoundary>
      <ChromeErrorBoundary label="SignInPromptProvider">
        <SignInPromptProvider />
      </ChromeErrorBoundary>
      <ChromeErrorBoundary label="GlobalCommandPalette">
        <GlobalCommandPalette />
      </ChromeErrorBoundary>
      {/* The pricing plans, shown only when a daily plan limit is hit. */}
      <ChromeErrorBoundary label="PlanLimitDialog">
        <PlanLimitDialog />
      </ChromeErrorBoundary>
      <ChromeErrorBoundary label="ServiceWorkerRegistrar">
        <ServiceWorkerRegistrar />
      </ChromeErrorBoundary>
      <MixpanelProvider />
      {/* Sign-in and sign-out report through toasts; without a mounted
          toaster every one of those messages was dropped silently. */}
      <Toaster position="top-center" richColors closeButton />
    </CategoryDockProvider>
  )
}
