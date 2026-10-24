"use client"

import { ChromeErrorBoundary } from "../../../lib/ui/layout/chrome-error-boundary"
import { NavUser } from "./nav-user"
import { SidebarSettingsButton } from "./sidebar-settings-button"

/**
 * The account menu as the sidebar's foot slot, in its own error boundary.
 * `AppSidebarShell` pins it under every tool page's sidebar, and the video
 * library's pages hand it to `@debate-ai/videos` as `accountSlot`, so the account
 * row (with the site links submenu) is the same on both. A Settings button
 * ends the row (`SidebarSettingsButton`), so it sits right beside the
 * layout's hide-sidebar button on every view.
 */
export function SidebarAccount() {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="min-w-0 flex-1">
        <ChromeErrorBoundary label="NavUser">
          <NavUser />
        </ChromeErrorBoundary>
      </div>
      <ChromeErrorBoundary label="SidebarSettingsButton">
        <SidebarSettingsButton />
      </ChromeErrorBoundary>
    </div>
  )
}
