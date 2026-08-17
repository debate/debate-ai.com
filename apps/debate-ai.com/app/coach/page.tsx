import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"

import { CoachHub } from "@/components/coach/CoachHub"

export const metadata: Metadata = {
  title: "Coach",
  description:
    "Round coaching workspace: argument tree, flow summary, coaching prompts, drills, scouting, briefings and practice rounds",
}

export default function CoachPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/debate"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to the round workspace"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-lg font-semibold">Coach Workspace</h1>
      </div>
      <Suspense>
        <CoachHub />
      </Suspense>
    </div>
  )
}
