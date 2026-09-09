import type { Metadata } from "next"
import { Suspense } from "react"
import { LecturesPage } from "debate-videos"
import { CategoryDock } from "@/components/layout/CategoryDock"

export const metadata: Metadata = {
  title: "LEARN: Lectures from Educators, Archive of Rounds & Notes",
  description: "Lectures from Educators, Archive of Rounds & Notes",
}

export default function VideosCategory() {
  return (
    <Suspense>
      {/* Sidebar: the app dock and the video library's own nav, nothing else.
          The REASON document panels used to mount here too (`docsSlot`); they
          now show only where the documents are the subject — see
          `lib/reason-docs/sidebar-routes.ts`. */}
      <LecturesPage dockSlot={<CategoryDock embedded />} />
    </Suspense>
  )
}
