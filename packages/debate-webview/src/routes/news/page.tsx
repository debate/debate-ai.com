import { Suspense } from "react"
import { NewsAndForums, type NewsAndForumsSectionId } from "../../components/news/NewsAndForums"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * `/news` — News & Forums: the News Stream and the forums, one tab each.
 * Outside Next the old `/practice/forums` route mounts this too, opening on
 * the Forums tab (the Next app redirects it to `?section=forums` instead).
 */
export function NewsAndForumsPage({ initialSection }: { initialSection?: NewsAndForumsSectionId }) {
  return (
    <ToolPage>
      <ToolPageHeader href="/news" backHref="/debate" backLabel="round workspace" guide="research-collaboration" />
      <Suspense>
        <NewsAndForums initialSection={initialSection} />
      </Suspense>
    </ToolPage>
  )
}

export default function NewsPage() {
  return <NewsAndForumsPage />
}
