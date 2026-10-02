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
<<<<<<< HEAD
          `debate-videos`, which renders it itself as a section of the
          statistics branch (second, below the per-season topics timeline). It
          used to arrive here as `topicAreasSlot` because the definitions lived
          in this package; the slot stays supported on `LecturesPage`, but
          nothing passes it now. */}
=======
          `debate-videos`, which renders it itself right after the topics by year on the
          statistics branch. It used to arrive here as `topicAreasSlot`
          because the definitions lived in this package; the slot stays
          supported on `LecturesPage`, but nothing passes it now. */}
>>>>>>> 4f64a47c28aece6099be039946fa263e7e98ec38
      <LecturesPage dockSlot={<CategoryDock embedded />} />
    </Suspense>
  )
}
