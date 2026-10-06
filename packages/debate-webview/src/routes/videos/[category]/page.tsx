import { Suspense } from "react"
import { LecturesPage } from "@debate/videos"
import { ToolSyncBadge } from "../../../components/tools/ToolSyncBadge"
import { CategoryDock } from "../../../components/layout/CategoryDock"

export default function VideosCategory() {
  return (
    <Suspense>
      {/* Sidebar: the app dock and the video library's own nav, nothing else.
          The REASON document panels used to mount here too (`docsSlot`); they
          now show only where the documents are the subject — see
          `lib/reason-docs/sidebar-routes.ts`. */}
      {/* Same badge as `/videos`: a category is just another view of the one
          library, and its sync status is the library's. */}
      <LecturesPage dockSlot={<CategoryDock embedded />} headerActionsSlot={<ToolSyncBadge href="/videos" />} />
    </Suspense>
  )
}
