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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { contributorId } = await params
  const decoded = decodeURIComponent(contributorId)

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

  const decoded = decodeURIComponent(contributorId)

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
