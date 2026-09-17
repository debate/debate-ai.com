import { Suspense } from "react"
import { SearchInterface } from "debate-research-evidence"

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
 * The padding clears the app dock, which is fixed top-left below `lg` and a
 * fixed bar along the bottom on phones.
 */
export default function SearchPage() {
  return (
    <div className="h-dvh flex flex-col overflow-hidden pt-14 lg:pt-0 pb-20 lg:pb-0">
      <Suspense>
        <SearchInterface />
      </Suspense>
    </div>
  )
}
