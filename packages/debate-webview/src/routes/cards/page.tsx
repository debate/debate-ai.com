import { Suspense } from "react"
import { SearchInterface } from "@debate-ai/research-evidence"
import { ReasonDocsSidebarPanels } from "@debate-ai/reason-docs/docs/ReasonDocsSidebarPanels"
import { ChromeErrorBoundary } from "../../lib/ui/layout/chrome-error-boundary"

/**
 * The CARDS search screen.
 *
 * Bounded to the viewport rather than left to grow with its content, the same
 * way `/reason-editor` is (`ReasonEditorScreen`) and for the same reason: this
 * is a three-column workspace whose columns each scroll on their own. Without
 * a definite height here the `h-full` inside `SearchInterface` has nothing to
 * resolve against — `AppSidebarShell`'s wrapper is `min-h-screen`, so its own
 * height is content-driven — and every column grew to fit its content instead,
 * leaving one page-length scroll that moved the result list and the open card
 * together.
 *
 * The Files / Topics / Tabs panels open as a second sidebar *inside* the
 * page, between the app sidebar and the search (`showsCardsPagePanel`). The
 * app sidebar used to be trimmed down to these panels on this route, which
 * swapped out the tree the reader had just clicked Cards in; now it stays
 * as it is on every other destination, and the panels get the page's full
 * height to divide between them. Below `md` the column is not drawn — the
 * mobile drawer shows the panels above the tree instead.
 *
 * The padding clears the app dock, which is fixed top-left below `lg` and a
 * fixed bar along the bottom on phones.
 */
export default function SearchPage() {
  return (
    <div className="h-dvh flex flex-col overflow-hidden pt-14 lg:pt-0 pb-20 lg:pb-0">
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Card files"
          className="hidden w-64 shrink-0 flex-col overflow-hidden border-r md:flex"
          data-testid="cards-docs-panel"
        >
          <ChromeErrorBoundary label="ReasonDocsSidebarPanels">
            <ReasonDocsSidebarPanels className="min-h-0 flex-1" fill />
          </ChromeErrorBoundary>
        </aside>
        <div className="min-w-0 flex-1">
          <Suspense>
            <SearchInterface />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
