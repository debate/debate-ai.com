import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { FeaturesPanel } from "../../lib/ui/features/FeaturesPanel"

export const metadata: Metadata = {
  title: "Features",
  description: "Every feature in the app, grouped by category and searchable by name, route, or keyword",
}

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4">
        <Link
          href="/videos"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
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
