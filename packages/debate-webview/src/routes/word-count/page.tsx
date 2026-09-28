import { Suspense } from "react"
import { WordCountRoundsPanel } from "debate-practice-rounds"
import { WordLimitPresetsPanel } from "debate-round"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function WordCountPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/word-count" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <WordCountRoundsPanel />
      </Suspense>
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground sm:px-6">
          Manage word limit presets
        </summary>
        <WordLimitPresetsPanel />
      </details>
    </ToolPage>
  )
}
