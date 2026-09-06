import type { Metadata } from "next"
import { Suspense } from "react"
import ResearchAgentEmbed from "./ResearchAgentEmbed"

export const metadata: Metadata = {
  title: "REASON Docs",
  description: "Research Editor for Annotated Summaries in Outline Notation",
}

export default function EditorPage() {
  return (
    <div className="h-screen flex flex-col pb-20 lg:pb-0">
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={null}>
          <ResearchAgentEmbed />
        </Suspense>
      </div>
    </div>
  )
}
