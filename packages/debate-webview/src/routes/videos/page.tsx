import { Suspense } from "react"
import { LecturesPage } from "debate-videos"
import { CategoryDock } from "../../components/layout/CategoryDock"
import { TopicAreasExplorer } from "../../components/topics/TopicAreasExplorer"

export default function VideosHome() {
  return (
    <Suspense>
      {/* Sidebar: the app dock and the video library's own nav, nothing else.
          The REASON document panels used to mount here too (`docsSlot`); they
          now show only where the documents are the subject — see
          `lib/reason-docs/sidebar-routes.ts`. */}
      {/* `topicAreasSlot` carries the research-area explorer down to the
          statistics branch, where it is the first stacked section. It is
          passed in rather than imported there because the 44 area definitions
          live in this package, which `debate-videos` must not depend on. */}
      <LecturesPage dockSlot={<CategoryDock embedded />} topicAreasSlot={<TopicAreasExplorer />} />
    </Suspense>
  )
}
