import type { Metadata } from "next"
import { Suspense } from "react"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"
import { NewsPageContent } from "./NewsPageContent"

export const metadata: Metadata = {
  title: "News Stream",
  description: "Product updates and community announcements — Daily Best Card winners and Contributor Awards, in one feed",
}

export default function NewsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/news" backHref="/tools" backLabel="tools" guide="research-collaboration" />
      <div className="mx-auto max-w-2xl">
        <Suspense>
          <NewsPageContent />
        </Suspense>
      </div>
    </ToolPage>
  )
}
