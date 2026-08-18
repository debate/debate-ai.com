import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { PrepRoomPanel } from "debate-card-search"

export const metadata: Metadata = {
  title: "Collaboration Prep Room",
  description: "A topic's shared prep space: evidence, draft blocks, and routed research tasks",
}

export default function CardsPrepRoomPage() {
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
        <PrepRoomPanel />
      </Suspense>
    </div>
  )
}
