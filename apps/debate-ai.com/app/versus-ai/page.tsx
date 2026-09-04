import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { AiVersusRoundPanel as DebatePracticeVsAi } from "debate-practice-rounds"

export const metadata: Metadata = {
  title: "Practice vs AI",
  description: "Practice a full round against an AI opponent, format and side of your choice",
}

/**
 * Practice vs AI — pick an opponent persona, set the topic, stance and phase
 * clocks, then debate a full timed round and get an AI scorecard.
 *
 * The screens come from `debate-practice-vs-ai`, ported from the upstream
 * Vite/React client; the round itself runs against this app's
 * `/api/vsbot/*` routes, which wrap that same package's ported Go backend.
 * The session user is passed down so the round's resume key is per-account
 * and the scorecard shows the right name and avatar.
 */
export default async function VersusAiPage() {
  const session = await getSession()

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4">
        <Link
          href="/debate"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          aria-label="Back to debate flow"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <Suspense>
        <DebatePracticeVsAi
          userId={session?.user?.id}
          userDisplayName={session?.user?.name}
          userAvatar={session?.user?.image}
        />
      </Suspense>
    </div>
  )
}
