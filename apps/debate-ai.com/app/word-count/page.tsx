import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { WordCountRoundsPanel } from "debate-practice-rounds"

export const metadata: Metadata = {
  title: "Word-Count Speeches",
  description: "Practice speeches bounded by a maximum word count instead of a time limit",
}

export default function WordCountPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4">
        <Link
          href="/debate"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to debate flow"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <Suspense>
        <WordCountRoundsPanel />
      </Suspense>
    </div>
  )
}
