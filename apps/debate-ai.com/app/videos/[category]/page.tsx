import type { Metadata } from "next"
import { Suspense } from "react"
import { LecturesPage } from "@/components/debate/DebateVideos/panels/LecturesPage"

export const metadata: Metadata = {
  title: "LEARN: Lectures from Educators, Archive of Rounds & Notes",
  description: "Lectures from Educators, Archive of Rounds & Notes",
}

export default function VideosCategory() {
  return (
    <Suspense>
      <LecturesPage />
    </Suspense>
  )
}
