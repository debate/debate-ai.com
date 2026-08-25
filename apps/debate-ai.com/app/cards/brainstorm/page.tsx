import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { BrainstormBoardWithIdentity } from "@/components/research/BrainstormBoardWithIdentity"

export const metadata: Metadata = {
  title: "Team Brainstorm Assist",
  description: "Submit and upvote squad ideas for an argument block, grouped into boards by category",
}

export default function CardsBrainstormPage() {
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
        <BrainstormBoardWithIdentity />
      </Suspense>
    </div>
  )
}
