import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { DailyBestCardPanel } from "debate-card-search"

export const metadata: Metadata = {
  title: "Daily Best Card Challenge",
  description: "Today's highest-helpfulness card, plus every past day's winner",
}

export default function CardsBestCardPage() {
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
        <DailyBestCardPanel />
      </Suspense>
    </div>
  )
}
