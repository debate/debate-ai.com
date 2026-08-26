import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { NewsStreamPanel } from "debate-card-search"

export const metadata: Metadata = {
  title: "News Stream",
  description: "Product updates and community announcements — Daily Best Card winners and Contributor Awards, in one feed",
}

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/tools"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to tools"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">News Stream</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Product updates and community announcements, newest first.
          </p>
        </div>
        <Suspense>
          <NewsStreamPanel />
        </Suspense>
      </div>
    </div>
  )
}
