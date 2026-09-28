"use client"

import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { notFound, useParams } from "next/navigation"
import { ContributorProfileWithIdentity } from "../../../../components/research/ContributorProfileWithIdentity"

/**
 * The router has already percent-decoded the route segment, so a second decode is
 * only for links that double-encoded it — and `decodeURIComponent` throws on
 * an escape it cannot parse, which a contributor name containing a literal
 * `%` produces. Falling back to the segment as given keeps such a name a 200
 * instead of a 500.
 */
function decodeContributorId(contributorId: string): string {
  try {
    return decodeURIComponent(contributorId)
  } catch {
    return contributorId
  }
}

export default function ContributorProfilePage() {
  const { contributorId } = useParams<{ contributorId: string }>()

  if (!contributorId?.trim()) {
    notFound()
  }

  const decoded = decodeContributorId(contributorId)

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4">
        <Link
          href="/cards/leaderboard"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to leaderboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <Suspense>
        <ContributorProfileWithIdentity contributorId={decoded} />
      </Suspense>
    </div>
  )
}
