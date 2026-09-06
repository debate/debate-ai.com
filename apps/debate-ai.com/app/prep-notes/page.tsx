import type { Metadata } from "next"
import { Suspense } from "react"
import { PrepNotesPanel } from "debate-team-collaboration"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Prep Notes",
  description: "Live prep notes across every flow, grouped by status",
}

export default function PrepNotesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/prep-notes" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <PrepNotesPanel />
      </Suspense>
    </ToolPage>
  )
}
