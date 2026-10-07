"use client"

import { ChromeErrorBoundary } from "../../../lib/ui/layout/chrome-error-boundary"
import { NavUser } from "./nav-user"

/**
 * The account menu as the sidebar's foot slot, in its own error boundary.
 * `AppSidebarShell` pins it under every tool page's sidebar, and the video
 * library's pages hand it to `@debate/videos` as `accountSlot`, so the account
 * row (with the site links submenu) is the same on both.
 */
export function SidebarAccount() {
  return (
    <ChromeErrorBoundary label="NavUser">
      <NavUser />
    </ChromeErrorBoundary>
  )
}
