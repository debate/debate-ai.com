import { Suspense } from "react"
import { CoachMaterialsPanel } from "debate-speech-writer"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

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
