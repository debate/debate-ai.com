"use client"

import { ChromeErrorBoundary } from "../../../lib/ui/layout/chrome-error-boundary"
import { NavUser } from "./nav-user"
import { SidebarPinnedLinks } from "./sidebar-pinned-links"

/**
 * The account menu as the sidebar's foot slot, in its own error boundary.
 * `AppSidebarShell` pins it under every tool page's sidebar, and the video
 * library's pages hand it to `@debate/videos` as `accountSlot`, so the account
 * row (with the site links submenu) is the same on both. Docs and Settings
 * sit pinned above it (`SidebarPinnedLinks`), so they show on every view
 * without opening the menu.
 */
export function SidebarAccount() {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <ChromeErrorBoundary label="SidebarPinnedLinks">
        <SidebarPinnedLinks />
      </ChromeErrorBoundary>
      <ChromeErrorBoundary label="NavUser">
        <NavUser />
      </ChromeErrorBoundary>
    </div>
  )
}
