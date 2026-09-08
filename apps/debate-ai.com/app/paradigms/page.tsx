import type { Metadata } from "next"
import { Suspense } from "react"
import { JudgeParadigmPickerPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Judge Paradigm Picker",
  description: "Pick a built-in or custom AI judge paradigm for a practice round",
}

export default function ParadigmsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/paradigms" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <JudgeParadigmPickerPanel />
      </Suspense>
    </ToolPage>
  )
}
