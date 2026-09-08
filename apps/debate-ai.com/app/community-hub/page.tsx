import type { Metadata } from "next"
import { Suspense } from "react"
import { CommunityHubPageContent } from "./CommunityHubPageContent"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Community Research Hub",
  description: "A searchable directory of every shared research, collaboration, and pre-round/practice space",
}

export default function CommunityHubPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/community-hub" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <CommunityHubPageContent />
      </Suspense>
    </ToolPage>
  )
}
