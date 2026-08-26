import type { Metadata } from "next"
import { NewsStreamPanel } from "debate-card-search"

export const metadata: Metadata = {
  title: "News Stream",
  description: "What's new across the whole product, newest first",
}

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-background">
      <NewsStreamPanel />
    </div>
  )
}
