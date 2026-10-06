"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { ToolSidebarFooter } from "@debate/videos"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from "../../../lib/ui/primitives/sidebar"
import { ChromeErrorBoundary } from "../../../lib/ui/layout/chrome-error-boundary"
import { showsCardsOnlySidebar, showsReasonDocsPanels } from "../../../lib/reason-docs/sidebar-routes"
import { CategoryDock } from "../CategoryDock"
import { ReasonDocsSidebarPanels } from "../../reason-docs/ReasonDocsSidebarPanels"
import { NavApps } from "./nav-apps"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"
import { SidebarBrand } from "./sidebar-brand"

/** Hidden while the sidebar is collapsed to its 3rem icon rail. */
const EXPANDED_ONLY = "group-data-[collapsible=icon]:hidden"

/**
 * The app's tool sidebar, composed on shadcn's sidebar-07 block: brand in the
 * header, the tool sections as collapsible `NavMain` groups, the account menu
 * in the footer, and a rail that collapses the whole column to icons.
 *
 * It carries the same regions the drag-resizable column did, each still in
 * its own error boundary — this renders from the root layout, so a throw in
 * any one region must cost only that region, not the page (see
 * `chrome-error-boundary.tsx`):
 *
 * - **The embedded dock** at the top, as before. It needs the column's full
 *   width, so it hides at icon width and {@link NavApps} stands in for it.
 * - **The REASON docs panels** on `/research/cards` and `/reason-editor`
 *   (`showsReasonDocsPanels`). On `/research/cards` they are the whole column
 *   (`showsCardsOnlySidebar`): no tool sections, no footer links, and the
 *   panels `fill` the leftover height so each scrolls inside its own share.
 * - **The tool sections and footer links** everywhere else.
 */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const cardsOnly = showsCardsOnlySidebar(pathname)

  return (
    <Sidebar collapsible="icon" data-app-chrome {...props}>
      <SidebarHeader>
        {/* Side by side when expanded; stacked at icon width, where the
            trigger is how you get the column back. */}
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:w-full">
            <SidebarBrand />
          </div>
          <SidebarTrigger className="shrink-0" />
        </div>
        <div className={EXPANDED_ONLY}>
          <ChromeErrorBoundary label="CategoryDock">
            <CategoryDock embedded />
          </ChromeErrorBoundary>
        </div>
      </SidebarHeader>
      <SidebarContent className={cardsOnly ? "overflow-hidden" : undefined}>
        <NavApps />
        {showsReasonDocsPanels(pathname) && (
          <div className={`${EXPANDED_ONLY} px-2 ${cardsOnly ? "flex min-h-0 flex-1 flex-col" : ""}`}>
            <ChromeErrorBoundary label="ReasonDocsSidebarPanels">
              <ReasonDocsSidebarPanels
                className={cardsOnly ? "min-h-0 flex-1" : "shrink-0"}
                fill={cardsOnly}
              />
            </ChromeErrorBoundary>
          </div>
        )}
        {!cardsOnly && (
          <ChromeErrorBoundary label="NavMain">
            <NavMain />
          </ChromeErrorBoundary>
        )}
      </SidebarContent>
      <SidebarFooter>
        {!cardsOnly && (
          <div className={`${EXPANDED_ONLY} px-2`}>
            <ChromeErrorBoundary label="ToolSidebarFooter">
              <ToolSidebarFooter />
            </ChromeErrorBoundary>
          </div>
        )}
        <ChromeErrorBoundary label="NavUser">
          <NavUser />
        </ChromeErrorBoundary>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
