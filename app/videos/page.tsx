import type { Metadata } from "next"
import { Suspense } from "react"
import { DebateVideosPage } from "@/components/debate/DebateVideos/panels/DebateVideosPanel"

export const metadata: Metadata = {
  title: "DEARLY Videos",
  description: "Debate Education And Research Library YouTube",
}

export default function Home() {
  return (
    <Suspense>
      <DebateVideosPage />
    </Suspense>
  )
}
