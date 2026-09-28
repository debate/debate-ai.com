import { Suspense } from "react"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"
import { NewsPageContent } from "./NewsPageContent"

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
