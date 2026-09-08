import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { ContributorProfileWithIdentity } from "@/components/research/ContributorProfileWithIdentity"

interface PageProps {
  params: Promise<{
    contributorId: string
  }>
}

/**
 * Next has already percent-decoded the route segment, so a second decode is
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { contributorId } = await params
  const decoded = decodeContributorId(contributorId)

  return {
    title: `${decoded} — Contributor Profile`,
    description: `Leaderboard rank, tier, badges, streak, and award history for ${decoded}`,
  }
}

export default async function ContributorProfilePage({ params }: PageProps) {
  const { contributorId } = await params

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
