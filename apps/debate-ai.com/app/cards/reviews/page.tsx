import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { ReviewQueueWithIdentity } from "@/components/research/ReviewQueueWithIdentity"

export const metadata: Metadata = {
  title: "Review Queue",
  description: "Move a submitted card through peer review — comment, request changes, approve, and publish",
}

export default function CardsReviewsPage() {
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
        <ReviewQueueWithIdentity />
      </Suspense>
    </div>
  )
}
