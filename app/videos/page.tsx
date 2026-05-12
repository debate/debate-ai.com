import type { Metadata } from "next"
import { Suspense } from "react"
import { DebateVideosPage } from "@/components/debate/DebateVideos/panels/DebateVideosPanel"

export const metadata: Metadata = {
  title: "LEARN: Lectures from Educators, Archive of Rounds & Notes",
  description: "Lectures from Educators, Archive of Rounds & Notes",
}

export default function Home() {
  return (
    <Suspense>
      <DebateVideosPage />
    </Suspense>
  )
}
