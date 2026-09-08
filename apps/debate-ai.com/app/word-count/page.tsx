import type { Metadata } from "next"
import { Suspense } from "react"
import { WordCountRoundsPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Word-Count Speeches",
  description: "Practice speeches bounded by a maximum word count instead of a time limit",
}

export default function WordCountPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/word-count" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <WordCountRoundsPanel />
      </Suspense>
    </ToolPage>
  )
}
