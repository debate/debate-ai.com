import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"

import { ResearchHub } from "@/components/research/ResearchHub"

export const metadata: Metadata = {
  title: "Research",
  description:
    "Squad research workspace: topic coverage, evidence library, task routing, quests, leaderboards and peer review",
}

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/cards"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to shared cards"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-lg font-semibold">Research Workspace</h1>
      </div>
      <Suspense>
        <ResearchHub />
      </Suspense>
    </div>
  )
}
