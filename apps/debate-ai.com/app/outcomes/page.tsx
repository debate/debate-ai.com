import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { VulnerabilityChartsPanel, RoundToolsCrossLinks } from "debate-practice-rounds"

export const metadata: Metadata = {
  title: "AI Response-Outcome Charts",
  description: "Per-side exposure and the most vulnerable arguments in each round's flow",
}

export default function OutcomesPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/debate"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to debate flow"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <RoundToolsCrossLinks currentHref="/outcomes" />
      </div>
      <Suspense>
        <VulnerabilityChartsPanel />
      </Suspense>
    </div>
  )
}
