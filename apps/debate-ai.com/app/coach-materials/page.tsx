import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { CoachMaterialsPanel } from "debate-speech-writer"

export const metadata: Metadata = {
  title: "Team Coach Materials",
  description: "Upload lecture transcripts, camp materials, instructional documents, and practice-round recordings to ground the team coach AI",
}

export default function CoachMaterialsPage() {
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
        <CoachMaterialsPanel />
      </Suspense>
    </div>
  )
}
