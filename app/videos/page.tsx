import type { Metadata } from "next"
import { DebateVideosPage } from "@/components/debate/videos/DebateVideosPage"

export const metadata: Metadata = {
  title: "DEARLY Videos",
  description: "Debate Education And Research Library YouTube",
}

export default function Home() {
  return <DebateVideosPage />
}
