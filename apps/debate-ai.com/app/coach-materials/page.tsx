import type { Metadata } from "next"
import { Suspense } from "react"
import { CoachMaterialsPanel } from "debate-speech-writer"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Coach Materials",
  description: "Upload grounding materials for the team coach AI and preview which ones answer a question",
}

export default function CoachMaterialsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/coach-materials" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <CoachMaterialsPanel />
      </Suspense>
    </ToolPage>
  )
}
