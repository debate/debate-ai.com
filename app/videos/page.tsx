import type { Metadata } from "next"
import { Suspense } from "react"
import { DebateVideosPage } from "@/components/debate/DebateVideos/panels/DebateVideosPanel"

export const metadata: Metadata = {
  title: "DEARLY: Debate Educational Archive of Rounds & Lectures on YouTube",
  description: "Debate Education Archive of Rounds & Lectures on YouTube",
}

export default function Home() {
  return (
    <Suspense>
      <DebateVideosPage />
    </Suspense>
  )
}
