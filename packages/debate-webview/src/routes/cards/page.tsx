import { Suspense } from "react"
import { SearchInterface } from "@debate/research-evidence"
import { ToolSyncBadge } from "../../components/tools/ToolSyncBadge"

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
 * A slim strip above the workspace carries the account-sync badge and "Save
 * now" (`ToolSyncBadge`) for the collections filed under `/research/cards`.
 * The search workspace has no `ToolPageHeader` of its own, so without the
 * strip it was the one tool with no sign of whether its data had reached the
 * account. The badge renders nothing while signed-out data has nothing to
 * show, and the strip collapses with it.
 *
 * The padding clears the app dock, which is fixed top-left below `lg` and a
 * fixed bar along the bottom on phones.
 */
export default function SearchPage() {
  return (
    <div className="h-dvh flex flex-col overflow-hidden pt-14 lg:pt-0 pb-20 lg:pb-0">
      <div className="flex shrink-0 items-center justify-end gap-2 px-3 pt-2 empty:hidden" data-cards-sync-strip>
        <ToolSyncBadge href="/research/cards" />
      </div>
      <Suspense>
        <SearchInterface />
      </Suspense>
    </div>
  )
}
