import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { FeaturesPanel } from "../../lib/ui/features/FeaturesPanel"

export const metadata: Metadata = {
  title: "Features",
  description:
    "Every Debate AI tool for PF, LD and Policy — evidence research and card cutting, flowing, speech and prep timers, judge and opponent scouting, drills and full rounds against an AI — grouped by category and searchable by name, route or keyword",
}

export default function FeaturesPage() {
  return (
    // No page padding: the panel's hero is full-bleed, so its aurora backdrop
    // and grid have to reach the edges. The Back link floats over the hero
    // instead of pushing it down.
    <div className="relative min-h-screen bg-background">
      <div className="absolute top-3 left-3 z-20 sm:top-5 sm:left-5">
        <Link
          href="/videos"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-card/80 backdrop-blur-sm hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to lectures"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <Suspense>
        <FeaturesPanel />
      </Suspense>
    </div>
  )
}
