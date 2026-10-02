import { Suspense } from "react"
import { LecturesPage } from "@debate/videos"
import { CategoryDock } from "../../components/layout/CategoryDock"

export default function VideosHome() {
  return (
    <Suspense>
      {/* Sidebar: the app dock and the video library's own nav, nothing else.
          The REASON document panels used to mount here too (`docsSlot`); they
          now show only where the documents are the subject — see
          `lib/reason-docs/sidebar-routes.ts`. */}
      {/* The research-area explorer and its 44 area definitions moved into
          `debate-videos`, which renders it itself as the first section of the
          statistics branch. It used to arrive here as `topicAreasSlot`
          because the definitions lived in this package; the slot stays
          supported on `LecturesPage`, but nothing passes it now. */}
      <LecturesPage dockSlot={<CategoryDock embedded />} />
    </Suspense>
  )
}
