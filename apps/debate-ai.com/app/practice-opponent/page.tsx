import type { Metadata } from "next"
import { Suspense } from "react"
import { OpponentPersonaPickerPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Opponent Persona Picker",
  description: "Pick the AI practice-opponent style for a session",
}

export default function PracticeOpponentPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice-opponent" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <OpponentPersonaPickerPanel />
      </Suspense>
    </ToolPage>
  )
}
