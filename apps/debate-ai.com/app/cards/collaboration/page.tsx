import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { SprintNotesPanel } from "debate-card-search"

export const metadata: Metadata = {
  title: "Team Collaboration Mode",
  description: "Leave live prep notes on a shared topic sprint, grouped by topic",
}

export default function CardsCollaborationPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4">
        <Link
          href="/cards"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to card search"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <Suspense>
        <SprintNotesPanel />
      </Suspense>
    </div>
  )
}
