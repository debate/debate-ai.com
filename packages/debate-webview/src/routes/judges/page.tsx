import { Suspense } from "react"
import { JudgeProfilesPanel } from "debate-speech-writer"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function JudgesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/judges" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <JudgeProfilesPanel />
      </Suspense>
    </ToolPage>
  )
}
