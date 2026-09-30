import type { Metadata } from "next"

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

export { default } from "debate-webview/routes/cards/leaderboard/[contributorId]/page"
