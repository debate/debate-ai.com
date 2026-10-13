"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, ChevronRight, Settings } from "lucide-react"
import { LibrarySidebarTree } from "@debate/videos"

import { ChromeErrorBoundary } from "../../../lib/ui/layout/chrome-error-boundary"
import { showsCardsPagePanel, showsReasonDocsPanels } from "../../../lib/reason-docs/sidebar-routes"
import { isDocsPath } from "../../../lib/layout/frame-navigation"
import { CategoryDock } from "../CategoryDock"
import { ReasonDocsSidebarPanels } from "../../reason-docs/ReasonDocsSidebarPanels"

/**
 * Where the help docs (`debate-help-docs`' docs layout) portal their page
 * tree into this column on `/docs`, so the docs' navigation is a section of
 * the app sidebar rather than a second sidebar beside it.
 */
export const DOCS_SIDEBAR_SLOT_ID = "app-sidebar-docs-slot"

/**
 * The contents of the app's sidebar column (`AppSidebarShell`): the same
 * dock and tree the `/videos` column holds, with whatever the page needs
 * merged in as sections of it. Each region renders in its own error boundary
 * — this renders from the root layout, so a throw in any one region must
 * cost only that region, not the page (see `chrome-error-boundary.tsx`):
 *
 * - **The embedded dock** at the top, sticky as the column scrolls.
 * - **The REASON docs panels** on `/reason-editor` (`showsReasonDocsPanels`).
 *   `/research/cards` opens them as a second column inside the page instead
 *   (`showsCardsPagePanel`), so this column stays the same there as on every
 *   other destination.
 * - **The library tree** — Videos (Lectures is one of its rows) and the tool
 *   sections — on every route. The site links that used to sit under it as a footer
 *   row are a submenu of the account menu now (`nav-user.tsx`).
 * - **The help docs' section**, at the bottom of the column, below the tool
 *   sections' Insights category and just above the account menu pinned at
 *   the foot. On `/docs` the docs portal their page tree into
 *   {@link DOCS_SIDEBAR_SLOT_ID}; everywhere else it is a collapsed Docs
 *   row ({@link DocsSidebarRow}) that opens `/docs`.
 * - **Settings** ({@link SettingsSidebarRow}), right under Docs on every
 *   route, so both always close the list of sections.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const docsPanels = showsReasonDocsPanels(pathname) && !showsCardsPagePanel(pathname)

  return (
    <>
      <ChromeErrorBoundary label="CategoryDock">
        <CategoryDock embedded />
      </ChromeErrorBoundary>
      {docsPanels && (
        <ChromeErrorBoundary label="ReasonDocsSidebarPanels">
          <ReasonDocsSidebarPanels className="shrink-0" />
        </ChromeErrorBoundary>
      )}
      <ChromeErrorBoundary label="LibrarySidebarTree">
        <LibrarySidebarTree />
      </ChromeErrorBoundary>
      {isDocsPath(pathname) ? (
        <div id={DOCS_SIDEBAR_SLOT_ID} className="shrink-0" />
      ) : (
        <DocsSidebarRow />
      )}
      <SettingsSidebarRow active={isSettingsPath(pathname)} />
    </>
  )
}

/**
 * The Docs section, collapsed, for routes outside `/docs`: the same header
 * row `debate-help-docs`' `app-sidebar-docs-tree.tsx` draws there, linking to
 * the docs, so the section is always in the sidebar.
 */
const SECTION_ROW =
  "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-accent hover:text-foreground"

function DocsSidebarRow() {
  return (
    <nav aria-label="Docs" className="flex shrink-0 flex-col gap-1 text-sm">
      <Link
        href="/docs"
        className={SECTION_ROW}
      >
        <BookOpen className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">Docs</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </nav>
  )
}

function isSettingsPath(pathname: string | null | undefined): boolean {
  return pathname === "/settings" || !!pathname?.startsWith("/settings/")
}

/** The Settings row under Docs, on every route; highlighted on `/settings`. */
function SettingsSidebarRow({ active }: { active: boolean }) {
  return (
    <nav aria-label="Settings" className="flex shrink-0 flex-col gap-1 text-sm">
      <Link
        href="/settings"
        aria-current={active ? "page" : undefined}
        className={`${SECTION_ROW} ${active ? "bg-accent text-foreground" : ""}`}
      >
        <Settings className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">Settings</span>
      </Link>
    </nav>
  )
}
