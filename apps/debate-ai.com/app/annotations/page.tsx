import type { Metadata } from "next"
import { Suspense } from "react"
import { FlowAnnotationsPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Flow-in-Speech Annotations",
  description: "Drop timestamped flow annotations while watching a streamed or recorded round, and jump back to them",
}

export default function AnnotationsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/annotations" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <FlowAnnotationsPanel />
      </Suspense>
    </ToolPage>
  )
}
