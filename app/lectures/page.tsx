import type { Metadata } from "next"
import { Suspense } from "react"
import { LecturesPage } from "@/components/debate/DebateVideos/panels/LecturesPage"

export const metadata: Metadata = {
  title: "Lectures - Debate AI",
  description: "Debate lecture videos and terminology dictionary",
}

export default function Home() {
  return (
    <Suspense>
      <LecturesPage />
    </Suspense>
  )
}
