import { Suspense } from "react"
import { CoachHub } from "../../components/coach/CoachHub"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function CoachPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/coach" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <CoachHub />
      </Suspense>
    </ToolPage>
  )
}
