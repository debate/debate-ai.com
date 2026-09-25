"use client"

import { Sidebar, type SidebarProps } from "react-reason-editor-sidebar"

import { CategoryDock } from "../layout/CategoryDock"
import { ChromeErrorBoundary } from "../../lib/ui/layout/chrome-error-boundary"

/**
 * The REASON workspace's own sidebar with the app dock hosted at the top of
 * it — the `SidebarComponent` `/doc` injects into `ReasonDocs` in place of
 * `react-reason-editor-sidebar`'s `Sidebar`.
 *
 * `/doc` used to render two sidebars side by side: the app's generic tool
 * column (dock, Coaching/Research nav tree, site footer) wrapped around a
 * page whose own sidebar is the files tree and the "Open Tabs" list. The
 * generic one is gone on this route (`hostsOwnSidebarDock`, in
 * `lib/sidebar-routes`) — which would have left the workspace with no dock at
 * all, the floating instance being suppressed wherever a sidebar-hosted one
 * is on screen. So the dock moves into the sidebar that remains, above the
 * editor's own toolbar, in the band the upstream `<aside>` leaves empty for
 * the header qwksearch's own app renders there (its `pt-14`, cancelled below
 * so the dock occupies that space instead of stacking under it).
 *
 * Only the desktop sidebar: below `md` the editor renders this component
 * inside a slide-over sheet, and the dock's own mobile instance is already
 * fixed to the bottom of the viewport, so a copy in the sheet would be the
 * second one.
 */
export function SidebarWithAppDock(props: SidebarProps) {
  if (props.isMobile) return <Sidebar {...props} />

  return (
    // The `<aside>` below is `h-screen`, and stays a direct flex child here so
    // that height is a basis the dock's row can shrink it against rather than
    // a viewport's worth of column pushing the sidebar's footer off screen.
    <div className="flex h-screen flex-col [&>aside]:pt-2">
      {/* Bounded like the dock in the app's own sidebar is: a throw in the
          dock leaves the workspace its files tree rather than taking the
          whole editor down with it. */}
      <ChromeErrorBoundary label="CategoryDock">
        <CategoryDock embedded />
      </ChromeErrorBoundary>
      <Sidebar {...props} />
    </div>
  )
}
